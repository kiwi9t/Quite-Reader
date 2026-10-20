// src/server.ts

import * as http from "node:http";

import { getEnv } from "./config/env";
import { parseBook } from "./ingestion/parseBook";
import { ApiError, toApiError } from "./http/apiError";
import { readBodyWithLimit, readJsonBodyWithLimit } from "./http/body";
import { logEvent } from "./http/logger";
import { InMemoryRateLimiter } from "./http/rateLimiter";
import {
  createRequestId,
  getClientIp,
  type RequestContext,
} from "./http/requestContext";
import {
  createAllAvailableClients,
  createDeepSeekLLM,
  normalizeProvider,
  type LLMProvider,
} from "./llm/createLLMClient";
import { withTimeout } from "./llm/guardedLLM";
import {
  findCachedParsedBook,
  getCacheStats,
  getBookContentHash,
  saveParsedBookCache,
} from "./persistence/cacheRepository";
import { presentReadingPreload } from "./presenters/readingPreloadPresenter";
import {
  MAX_CHAPTER_CONTENT_CHARS,
  MAX_SAFE_PREVIOUS_SUMMARY_CHARS,
  ReadingPreloadInputSchema,
  UploadFilenameSchema,
} from "./schemas/readingSchemas";
import {
  runReadingPreloadWorkflow,
  type ReadingPreloadInput,
} from "./workflow/readingWorkflow";

// Initialize ALL providers that have API keys in .env.
// This lets the frontend switch providers per-request without restarting.
// 初始化所有在 .env 中有 API key 的 provider，
// 支持前端按请求切换 provider 而无需重启服务器。
const allClients = createAllAvailableClients();
let activeProvider = allClients.defaultProvider;

const MAX_JSON_BODY_BYTES = readPositiveIntEnv("MAX_JSON_BODY_BYTES", 256_000);
const MAX_UPLOAD_BYTES = readPositiveIntEnv(
  "MAX_UPLOAD_BYTES",
  20 * 1024 * 1024
);

/**
 * Header carrying the end user's own DeepSeek API key.
 * The key is used for that request only: never logged, cached, or stored.
 *
 * 携带终端用户自己 DeepSeek API key 的请求头。
 * 只用于当次请求：不记录日志、不缓存、不落库。
 */
const USER_DEEPSEEK_KEY_HEADER = "X-DeepSeek-Api-Key";
const USER_API_KEY_PATTERN = /^[A-Za-z0-9._-]{8,256}$/;

const rateLimiter = new InMemoryRateLimiter({
  maxRequests: readPositiveIntEnv("RATE_LIMIT_MAX_REQUESTS", 60),
  windowMs: readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 60_000),
});

/**
 * Parse a request URL and return its pathname and search params.
 * 解析请求 URL，返回路径名和查询参数。
 */
function parseUrl(rawUrl: string): { pathname: string; params: URLSearchParams } {
  const parsed = new URL(rawUrl, "http://localhost");
  return { pathname: parsed.pathname, params: parsed.searchParams };
}

/**
 * Send a JSON response.
 * 发送 JSON 响应。
 */
function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  data: unknown,
  headers: Record<string, string> = {}
): void {
  const allowedOrigin = getEnv("ALLOWED_ORIGIN") ?? "*";

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": `Content-Type, ${USER_DEEPSEEK_KEY_HEADER}`,
    "Vary": "Origin",
    ...headers,
  });

  res.end(JSON.stringify(data, null, 2));
}

function sendApiError(
  res: http.ServerResponse,
  error: ApiError,
  requestId: string
): void {
  sendJson(res, error.statusCode, {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      requestId,
      details: error.details,
    },
  }, { "X-Request-Id": requestId });
}

/**
 * HTTP API server.
 * HTTP API 服务。
 */
const server = http.createServer(async (req, res) => {
  const { pathname } = parseUrl(req.url ?? "/");
  const context: RequestContext = {
    requestId: createRequestId(),
    method: req.method ?? "UNKNOWN",
    path: pathname,
    startedAt: Date.now(),
    ip: getClientIp(req),
  };

  logEvent("info", "request_started", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    ip: context.ip,
  });

  try {
    if (req.method === "OPTIONS") {
      sendJson(
        res,
        200,
        { ok: true },
        { "X-Request-Id": context.requestId }
      );
      return;
    }

    rateLimiter.check(`${context.ip}:${context.path}`);

    if (req.method === "GET" && pathname === "/health") {
      sendJson(
        res,
        200,
        {
          ok: true,
          message: "Reading Assistant API is healthy.",
          llmProvider: activeProvider,
          availableProviders: allClients.availableProviders,
        },
        { "X-Request-Id": context.requestId }
      );
      return;
    }

    /**
     * GET /api/providers
     *
     * Returns which LLM providers have API keys configured and are ready to use.
     * The frontend uses this to grey out unconfigured providers.
     *
     * 返回哪些 LLM provider 已配置 API key 并可用。
     * 前端用它灰显未配置的 provider。
     */
    if (req.method === "GET" && pathname === "/api/providers") {
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            default: allClients.defaultProvider,
            active: activeProvider,
            available: allClients.availableProviders,
            userKeyProviders: allClients.userKeyProviders,
          },
        },
        { "X-Request-Id": context.requestId }
      );
      return;
    }

    /**
     * POST /api/providers/active
     *
     * Switches the active LLM provider for this running server process.
     * This is intentionally a runtime switch, not a process restart.
     *
     * 切换当前运行中的后端默认 LLM provider。
     * 这里是运行时切换，而不是让网页重启进程。
     */
    if (req.method === "POST" && pathname === "/api/providers/active") {
      const body = await readJsonBodyWithLimit<{ provider?: unknown }>(
        req,
        MAX_JSON_BODY_BYTES
      );
      const requestedProvider = parseProvider(body.provider);

      if (!allClients.get(requestedProvider)) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          `Provider "${requestedProvider}" is not configured on this server. ` +
            `Add ${requestedProvider.toUpperCase()}_API_KEY to .env and restart.`
        );
      }

      activeProvider = requestedProvider;
      logEvent("info", "llm_provider_changed", {
        requestId: context.requestId,
        provider: activeProvider,
      });

      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            llmProvider: activeProvider,
            availableProviders: allClients.availableProviders,
          },
        },
        { "X-Request-Id": context.requestId }
      );
      return;
    }

    /**
     * POST /api/providers/deepseek/verify
     *
     * Checks the user's DeepSeek key (sent in X-DeepSeek-Api-Key) against
     * DeepSeek's balance endpoint. No tokens are consumed.
     *
     * 用 DeepSeek 余额接口校验用户的 key（放在 X-DeepSeek-Api-Key 头里），不消耗 token。
     */
    if (req.method === "POST" && pathname === "/api/providers/deepseek/verify") {
      const userApiKey = readUserApiKey(req);
      if (!userApiKey) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          `Send your DeepSeek API key in the ${USER_DEEPSEEK_KEY_HEADER} header.`
        );
      }

      const status = await withTimeout(
        (signal) => createDeepSeekLLM(userApiKey).checkKey({ signal }),
        readPositiveIntEnv("LLM_TIMEOUT_MS", 45_000)
      );

      sendJson(
        res,
        200,
        { ok: true, data: status },
        { "X-Request-Id": context.requestId }
      );
      return;
    }

    if (req.method === "GET" && pathname === "/api/limits") {
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            maxJsonBodyBytes: MAX_JSON_BODY_BYTES,
            maxUploadBytes: MAX_UPLOAD_BYTES,
            maxChapterContentChars: MAX_CHAPTER_CONTENT_CHARS,
            maxSafePreviousSummaryChars: MAX_SAFE_PREVIOUS_SUMMARY_CHARS,
            rateLimit: {
              maxRequests: readPositiveIntEnv("RATE_LIMIT_MAX_REQUESTS", 60),
              windowMs: readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 60_000),
            },
          },
        },
        { "X-Request-Id": context.requestId }
      );
      return;
    }

    if (req.method === "GET" && pathname === "/api/cache/stats") {
      sendJson(
        res,
        200,
        {
          ok: true,
          data: await getCacheStats(),
        },
        { "X-Request-Id": context.requestId }
      );
      return;
    }

    if (req.method === "POST" && pathname === "/api/reading/preload") {
      const input = ReadingPreloadInputSchema.parse(
        await readJsonBodyWithLimit<ReadingPreloadInput>(
          req,
          MAX_JSON_BODY_BYTES
        )
      );

      const { params } = parseUrl(req.url ?? "/api/reading/preload");

      // Allow the frontend to pick a provider per-request.
      // Falls back to the server's default (LLM_PROVIDER env var).
      // 允许前端按请求选择 provider，未指定时回退到服务器默认值。
      const requestedProviderRaw = params.get("provider");
      const requestedProvider = requestedProviderRaw
        ? normalizeProvider(requestedProviderRaw)
        : activeProvider;

      // A user-supplied key takes priority over the server's own key.
      // 用户自带的 key 优先于服务器 .env 中的 key。
      const userApiKey = readUserApiKey(req);
      const llmClient = userApiKey
        ? allClients.withUserApiKey(requestedProvider, userApiKey)
        : allClients.get(requestedProvider);
      if (!llmClient) {
        throw new ApiError(
          400,
          "BAD_REQUEST",
          userApiKey
            ? `Provider "${requestedProvider}" does not accept a user-supplied API key.`
            : `Provider "${requestedProvider}" needs an API key. ` +
                `Enter your own key in the app, or add ` +
                `${requestedProvider.toUpperCase()}_API_KEY to the server .env.`
        );
      }

      const output = await runReadingPreloadWorkflow(input, llmClient);
      const debug = params.get("debug") === "true";
      const viewModel = presentReadingPreload(output.state, debug);

      sendJson(
        res,
        200,
        {
          ok: true,
          data: viewModel,
        },
        { "X-Request-Id": context.requestId }
      );

      return;
    }

    /**
     * POST /api/book/upload?filename=<name>
     *
     * Accepts a raw binary file body and returns the parsed book structure
     * (title, author, chapters). Does NOT invoke agents — pure ingestion.
     *
     * 接受原始二进制文件 body，返回解析后的书籍结构（标题、作者、章节）。
     * 不调用任何 Agent——纯摄取操作。
     */
    if (req.method === "POST" && pathname === "/api/book/upload") {
      const { params } = parseUrl(req.url ?? "/api/book/upload");
      const filename = UploadFilenameSchema.parse(
        params.get("filename") ?? "upload.bin"
      );

      const buffer = await readBodyWithLimit(req, MAX_UPLOAD_BYTES);

      if (buffer.length === 0) {
        throw new ApiError(400, "BAD_REQUEST", "Request body is empty.");
      }

      const contentHash = getBookContentHash(buffer);
      const cachedBook = await findCachedParsedBook(contentHash);
      const book = cachedBook ?? (await parseBook(buffer, filename));

      if (!cachedBook) {
        await saveParsedBookCache({
          contentHash,
          filename,
          book,
        });
      }

      sendJson(
        res,
        200,
        {
          ok: true,
          data: book,
        },
        { "X-Request-Id": context.requestId }
      );

      return;
    }

    throw new ApiError(404, "NOT_FOUND", "Not found.");
  } catch (error) {
    const apiError = toApiError(error);

    logEvent(apiError.statusCode >= 500 ? "error" : "warn", "request_failed", {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      statusCode: apiError.statusCode,
      code: apiError.code,
      durationMs: Date.now() - context.startedAt,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: sanitizeErrorMessage(error),
    });

    sendApiError(res, apiError, context.requestId);
    return;
  } finally {
    logEvent("info", "request_finished", {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - context.startedAt,
    });
  }
});

const port = Number(getEnv("PORT") ?? 3000);

server.listen(port, () => {
  logEvent("info", "server_started", {
    port,
    defaultProvider: allClients.defaultProvider,
    availableProviders: allClients.availableProviders,
  });
});

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = getEnv(name);

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Read and validate the user-supplied DeepSeek key header, if any.
 * 读取并校验用户提供的 DeepSeek key 请求头（如有）。
 */
function readUserApiKey(req: http.IncomingMessage): string | undefined {
  const raw = req.headers[USER_DEEPSEEK_KEY_HEADER.toLowerCase()];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();

  if (!value) {
    return undefined;
  }

  if (!USER_API_KEY_PATTERN.test(value)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "The DeepSeek API key format looks invalid."
    );
  }

  return value;
}

function parseProvider(value: unknown): LLMProvider {
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Provider is required.");
  }

  const provider = normalizeProvider(value);
  if (provider !== value) {
    throw new ApiError(400, "VALIDATION_ERROR", "Provider is not supported.");
  }

  return provider;
}

function sanitizeErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return error.message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/key=([A-Za-z0-9._-]+)/gi, "key=[REDACTED]")
    .replace(/sk-[A-Za-z0-9]{6,}/g, "sk-[REDACTED]")
    .slice(0, 500);
}
