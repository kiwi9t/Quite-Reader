import type { LLMMessage, LLMResponse, MinimalLLMClient } from "./types";

export class LLMTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms.`);
    this.name = "LLMTimeoutError";
  }
}

export class LLMBudgetError extends Error {
  constructor(readonly promptChars: number, readonly maxPromptChars: number) {
    super(
      `LLM prompt is too large (${promptChars} chars, max ${maxPromptChars}).`
    );
    this.name = "LLMBudgetError";
  }
}

/**
 * Thrown when an LLM provider returns HTTP 429 (rate limit).
 * structuredOutput uses this to add backoff before retrying.
 *
 * 当 LLM provider 返回 HTTP 429 时抛出。
 * structuredOutput 用它在重试前加退避等待。
 */
export class LLMRateLimitError extends Error {
  constructor(
    /** How long to wait before retrying, in milliseconds. 重试前的等待时长（毫秒）。 */
    readonly retryAfterMs: number
  ) {
    super(`LLM provider rate-limited the request. Retry after ${retryAfterMs}ms.`);
    this.name = "LLMRateLimitError";
  }
}

export function withLLMGuards(
  llm: MinimalLLMClient,
  options: {
    timeoutMs: number;
    maxPromptChars: number;
  }
): MinimalLLMClient {
  return {
    async invoke(messages: LLMMessage[]): Promise<LLMResponse> {
      const promptChars = messages.reduce(
        (sum, message) => sum + message.content.length,
        0
      );

      if (promptChars > options.maxPromptChars) {
        throw new LLMBudgetError(promptChars, options.maxPromptChars);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

      try {
        return await llm.invoke(messages, {
          signal: controller.signal,
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          throw new LLMTimeoutError(options.timeoutMs);
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
