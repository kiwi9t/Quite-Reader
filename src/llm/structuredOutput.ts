import { z, type ZodType } from "zod";

import { getEnv } from "../config/env";
import type { LLMMessage, MinimalLLMClient } from "./types";
import { LLMRateLimitError } from "./guardedLLM";

export class AgentOutputValidationError extends Error {
  constructor(
    readonly agentName: string,
    readonly attempts: number,
    readonly lastError: string
  ) {
    super(
      `${agentName} failed to produce valid structured output after ${attempts} attempt(s): ${lastError}`
    );
    this.name = "AgentOutputValidationError";
  }
}

interface InvokeStructuredOutputOptions<T> {
  agentName: string;
  llm: MinimalLLMClient;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  maxAttempts?: number;
  validate?: (value: T, rawContent: string) => string[];
}

export async function invokeWithStructuredOutput<T>({
  agentName,
  llm,
  systemPrompt,
  userPrompt,
  schema,
  maxAttempts = getDefaultMaxAttempts(),
  validate,
}: InvokeStructuredOutputOptions<T>): Promise<T> {
  let lastError = "No response received.";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content:
          attempt === 1
            ? userPrompt
            : `${userPrompt}

Your previous response failed validation:
${lastError}

Return one strictly valid JSON object only. Do not add Markdown, prose, comments, or extra keys.`,
      },
    ];

    try {
      const response = await llm.invoke(messages);

      const json = JSON.parse(response.content) as unknown;
      const parsed = schema.parse(json);
      const customErrors = validate?.(parsed, response.content) ?? [];

      if (customErrors.length > 0) {
        lastError = customErrors.join("; ");
        continue;
      }

      return parsed;
    } catch (error) {
      // ── Rate limit: backoff then retry ──────────────────────────────────
      if (error instanceof LLMRateLimitError) {
        if (attempt < maxAttempts) {
          // Wait for the provider's requested delay, then retry
          await sleep(error.retryAfterMs);
          lastError = `Rate limited by provider (attempt ${attempt}); retried after ${error.retryAfterMs}ms.`;
          continue;
        }
        // Out of retries — surface the rate-limit error directly so the
        // caller can render an actionable message instead of a generic one.
        throw error;
      }

      // ── Other provider-level errors (non-JSON, HTTP 5xx, etc.) ──────────
      // These indicate infra/auth problems; retrying won't help.
      if (isProviderError(error)) {
        throw error;
      }

      // ── JSON parse or Zod validation failure — record and retry ─────────
      lastError = formatStructuredOutputError(error);
    }
  }

  throw new AgentOutputValidationError(agentName, maxAttempts, lastError);
}

/**
 * Returns true for errors thrown by the LLM transport layer
 * (not JSON/schema validation errors).
 * These should not be retried with a corrected prompt.
 */
function isProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    /^(Gemini|DeepSeek|OpenAI) request failed/.test(error.message) ||
    error.name === "LLMTimeoutError" ||
    error.name === "LLMBudgetError"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDefaultMaxAttempts(): number {
  const raw = getEnv("LLM_STRUCTURED_MAX_ATTEMPTS");

  if (!raw) {
    return 3;
  }

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 3;
}

function formatStructuredOutputError(error: unknown): string {
  if (error instanceof SyntaxError) {
    return `Invalid JSON: ${error.message}`;
  }

  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
  }

  return error instanceof Error ? error.message : "Unknown validation error.";
}
