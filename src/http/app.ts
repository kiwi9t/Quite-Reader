// src/http/app.ts
//
// HTTP routes as a Web-standard fetch handler: (Request) => Promise<Response>.
// The same handler runs under Node (src/server.ts) and under Deno in a
// Supabase Edge Function (src/edge/supabaseFunction.ts).
//
// 以 Web 标准 fetch handler 的形式实现的 HTTP 路由：(Request) => Promise<Response>。
// 同一个 handler 既跑在 Node（src/server.ts），也跑在 Supabase Edge Function 的 Deno 中
// （src/edge/supabaseFunction.ts）。

import { getEnv } from "../config/env";
import { parseBook } from "../ingestion/parseBook";
import {
  createAllAvailableClients,
  createDeepSeekLLM,
  normalizeProvider,
  type LLMProvider,
} from "../llm/createLLMClient";
import { withTimeout } from "../llm/guardedLLM";
import {
  findCachedParsedBook,
  getBookContentHash,
  getCacheStats,
  saveParsedBookCache,
} from "../persistence/cacheRepository";
import { presentReadingPreload } from "../presenters/readingPreloadPresenter";
import {
  MAX_CHAPTER_CONTENT_CHARS,
  MAX_SAFE_PREVIOUS_SUMMARY_CHARS,
  ReadingPreloadInputSchema,
  UploadFilenameSchema,
} from "../schemas/readingSchemas";
import {
  runReadingPreloadWorkflow,
  type ReadingPreloadInput,
} from "../workflow/readingWorkflow";
import { ApiError, toApiError } from "./apiError";
import { readBodyWithLimit, readJsonBodyWithLimit } from "./body";
import { logEvent } from "./logger";
import { InMemoryRateLimiter } from "./rateLimiter";
import {
  createRequestId,
  getClientIp,
  type RequestContext,
} from "./requestContext";

/**
 * Header carrying the end user's own DeepSeek API key.
 * The key is used for that request only: never logged, cached, or stored.
 *
 * 携带终端用户自己 DeepSeek API key 的请求头。
 * 只用于当次请求：不记录日志、不缓存、不落库。
 */
const USER_DEEPSEEK_KEY_HEADER = "X-DeepSeek-Api-Key";
const USER_API_KEY_PATTERN = /^[A-Za-z0-9._-]{8,256}$/;

export interface AppOptions {
  /**
   * Path prefix to strip before routing. Supabase passes the function name
   * as the first path segment, e.g. "/quiet-reader/health".
   *
   * 路由前要去掉的路径前缀。Supabase 会把函数名作为第一段路径传进来，
   * 例如 "/quiet-reader/health"。
   */
  basePath?: string;
}

export interface RequestInfo {
  remoteAddress?: string;
}

export type AppHandler = (
  request: Request,
  info?: RequestInfo
) => Promise<Response>;

export function createApp(options: AppOptions = {}): AppHandler {
  // Initialize ALL providers that have API keys in the environment.
  // This lets the frontend switch providers per-request without restarting.
  // 初始化所有在环境变量中有 API key 的 provider，
  // 支持前端按请求切换 provider 而无需重启服务器。
  const allClients = createAllAvailableClients();
  let activeProvider = allClients.defaultProvider;

  const maxJsonBodyBytes = readPositiveIntEnv("MAX_JSON_BODY_BYTES", 256_000);
  const maxUploadBytes = readPositiveIntEnv(
    "MAX_UPLOAD_BYTES",
    20 * 1024 * 1024
  );
  const rateLimit = {
    maxRequests: readPositiveIntEnv("RATE_LIMIT_MAX_REQUESTS", 60),
    windowMs: readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 60_000),
  };
  const rateLimiter = new InMemoryRateLimiter(rateLimit);

  async function route(
    request: Request,
    pathname: string,
    params: URLSearchParams,
    context: RequestContext
  ): Promise<Response> {
    const json = (data: unknown) =>
      jsonResponse(200, data, { "X-Request-Id": context.requestId });

    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    rateLimiter.check(`${context.ip}:${context.path}`);

    if (request.method === "GET" && pathname === "/health") {
      return json({
        ok: true,
        message: "Reading Assistant API is healthy.",
        llmProvider: activeProvider,
        availableProviders: allClients.availableProviders,
      });
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
    if (request.method === "GET" && pathname === "/api/providers") {
      return json({
        ok: true,
        data: {
          default: allClients.defaultProvider,
          active: activeProvider,
          available: allClients.availableProviders,
          userKeyProviders: allClients.userKeyProviders,
        },
      });
    }

    /**
     * POST /api/providers/active
     *
     * Switches the active LLM provider for this running server process.
     * On Supabase each function instance keeps its own value.
     *
     * 切换当前运行中的后端默认 LLM provider。
     * 在 Supabase 上每个函数实例各自保存这个值。
     */
    if (request.method === "POST" && pathname === "/api/providers/active") {
      const body = await readJsonBodyWithLimit<{ provider?: unknown }>(
        request,
        maxJsonBodyBytes
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

      return json({
        ok: true,
        data: {
          llmProvider: activeProvider,
          availableProviders: allClients.availableProviders,
        },
      });
    }

    /**
     * POST /api/providers/deepseek/verify
     *
     * Checks the user's DeepSeek key (sent in X-DeepSeek-Api-Key) against
     * DeepSeek's balance endpoint. No tokens are consumed.
     *
     * 用 DeepSeek 余额接口校验用户的 key（放在 X-DeepSeek-Api-Key 头里），不消耗 token。
     */
    if (
      request.method === "POST" &&
      pathname === "/api/providers/deepseek/verify"
    ) {
      const userApiKey = readUserApiKey(request);
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

      return json({ ok: true, data: status });
    }

    if (request.method === "GET" && pathname === "/api/limits") {
      return json({
        ok: true,
        data: {
          maxJsonBodyBytes,
          maxUploadBytes,
          maxChapterContentChars: MAX_CHAPTER_CONTENT_CHARS,
          maxSafePreviousSummaryChars: MAX_SAFE_PREVIOUS_SUMMARY_CHARS,
          rateLimit,
        },
      });
    }

    if (request.method === "GET" && pathname === "/api/cache/stats") {
      return json({ ok: true, data: await getCacheStats() });
    }

    if (request.method === "POST" && pathname === "/api/reading/preload") {
      const input = ReadingPreloadInputSchema.parse(
        await readJsonBodyWithLimit<ReadingPreloadInput>(
          request,
          maxJsonBodyBytes
        )
      );

      // Allow the frontend to pick a provider per-request.
      // Falls back to the server's default (LLM_PROVIDER env var).
      // 允许前端按请求选择 provider，未指定时回退到服务器默认值。
      const requestedProviderRaw = params.get("provider");
      const requestedProvider = requestedProviderRaw
        ? normalizeProvider(requestedProviderRaw)
        : activeProvider;

      // A user-supplied key takes priority over the server's own key.
      // 用户自带的 key 优先于服务器 .env 中的 key。
      const userApiKey = readUserApiKey(request);
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

      return json({
        ok: true,
        data: presentReadingPreload(output.state, debug),
      });
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
    if (request.method === "POST" && pathname === "/api/book/upload") {
      const filename = UploadFilenameSchema.parse(
        params.get("filename") ?? "upload.bin"
      );

      const buffer = await readBodyWithLimit(request, maxUploadBytes);

      if (buffer.length === 0) {
        throw new ApiError(400, "BAD_REQUEST", "Request body is empty.");
      }

      const contentHash = getBookContentHash(buffer);
      const cachedBook = await findCachedParsedBook(contentHash);
      const book = cachedBook ?? (await parseBook(buffer, filename));

      if (!cachedBook) {
        await saveParsedBookCache({ contentHash, filename, book });
      }

      return json({ ok: true, data: book });
    }

    throw new ApiError(404, "NOT_FOUND", "Not found.");
  }

  return async (request, info = {}) => {
    const url = new URL(request.url);
    const pathname = stripBasePath(url.pathname, options.basePath);
    const context: RequestContext = {
      requestId: createRequestId(),
      method: request.method,
      path: pathname,
      startedAt: Date.now(),
      ip: getClientIp(request, info.remoteAddress),
    };

    logEvent("info", "request_started", {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      ip: context.ip,
    });

    let response: Response;

    try {
      response = await route(request, pathname, url.searchParams, context);
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

      response = jsonResponse(
        apiError.statusCode,
        {
          ok: false,
          error: {
            code: apiError.code,
            message: apiError.message,
            requestId: context.requestId,
            details: apiError.details,
          },
        },
        { "X-Request-Id": context.requestId }
      );
    }

    logEvent("info", "request_finished", {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      statusCode: response.status,
      durationMs: Date.now() - context.startedAt,
    });

    return response;
  };
}

/**
 * Build a JSON response with CORS headers.
 * 构建带 CORS 头的 JSON 响应。
 */
function jsonResponse(
  status: number,
  data: unknown,
  headers: Record<string, string> = {}
): Response {
  const allowedOrigin = getEnv("ALLOWED_ORIGIN") ?? "*";

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": `Content-Type, ${USER_DEEPSEEK_KEY_HEADER}`,
      "Vary": "Origin",
      ...headers,
    },
  });
}

function stripBasePath(pathname: string, basePath: string | undefined): string {
  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return "/";
  }

  return pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : pathname;
}

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
function readUserApiKey(request: Request): string | undefined {
  const value = request.headers.get(USER_DEEPSEEK_KEY_HEADER)?.trim();

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
