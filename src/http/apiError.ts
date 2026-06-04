import { z } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "BODY_TOO_LARGE"
  | "INTERNAL_ERROR"
  | "LLM_BILLING_ERROR"
  | "LLM_OUTPUT_ERROR"
  | "LLM_PROVIDER_ERROR"
  | "LLM_RATE_LIMITED"
  | "LLM_TIMEOUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR";

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof SyntaxError) {
    return new ApiError(400, "BAD_REQUEST", "Request body is not valid JSON.");
  }

  if (error instanceof Error && error.name === "AgentOutputValidationError") {
    return new ApiError(
      502,
      "LLM_OUTPUT_ERROR",
      "The language model returned an invalid response."
    );
  }

  if (error instanceof Error && error.name === "LLMTimeoutError") {
    return new ApiError(504, "LLM_TIMEOUT", "The language model timed out.");
  }

  if (error instanceof Error && error.name === "LLMRateLimitError") {
    const retryAfterMs = (error as { retryAfterMs?: number }).retryAfterMs ?? 15_000;
    const waitSec = Math.ceil(retryAfterMs / 1_000);
    return new ApiError(
      429,
      "RATE_LIMITED",
      `The language model provider is rate-limiting requests. Please wait ${waitSec}s and try again.`,
      { retryAfterMs, retryAfterSec: waitSec }
    );
  }

  if (error instanceof Error && error.name === "LLMBudgetError") {
    return new ApiError(
      413,
      "BODY_TOO_LARGE",
      "The chapter is too large to process safely."
    );
  }

  if (
    error instanceof Error &&
    /^(Gemini|DeepSeek|OpenAI) request failed/.test(error.message)
  ) {
    // Extract HTTP status code and reason from the error message so the
    // frontend and server logs have actionable detail.
    // 从错误消息中提取 HTTP 状态码和原因，让前端和日志有可操作的细节。
    const statusMatch = error.message.match(/\((\d+)\)/);
    const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

    // Strip anything that looks like an API key before surfacing to client.
    // 对客户端暴露前去掉任何看起来像 API key 的内容。
    const safeDetail = error.message
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
      .replace(/key=([A-Za-z0-9._-]+)/gi, "key=[REDACTED]")
      .slice(0, 300);

    if (httpStatus === 429) {
      const retryAfterSec = extractRetryAfterSeconds(error.message);
      return new ApiError(
        429,
        "LLM_RATE_LIMITED",
        retryAfterSec
          ? `The language model provider quota was reached. Please wait ${retryAfterSec}s and try again.`
          : "The language model provider quota was reached. Please wait a moment and try again.",
        {
          httpStatus,
          retryAfterSec,
          detail: safeDetail,
        }
      );
    }

    if (httpStatus === 402) {
      return new ApiError(
        402,
        "LLM_BILLING_ERROR",
        "The language model provider account has insufficient balance or billing access.",
        {
          httpStatus,
          detail: safeDetail,
        }
      );
    }

    return new ApiError(
      502,
      "LLM_PROVIDER_ERROR",
      "The configured language model provider rejected the request.",
      { httpStatus, detail: safeDetail }
    );
  }

  return new ApiError(500, "INTERNAL_ERROR", "Internal server error.");
}

function extractRetryAfterSeconds(message: string): number | undefined {
  const retryMatch = message.match(/retry\s+in\s+([0-9.]+)s/i);

  if (!retryMatch) {
    return undefined;
  }

  const seconds = Math.ceil(Number(retryMatch[1]));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}
