// src/llm/deepseekLLM.ts
//
// DeepSeek uses an OpenAI-compatible chat completions API.
// Reference: https://platform.deepseek.com/api-docs/

import type {
  LLMInvokeOptions,
  LLMMessage,
  LLMResponse,
  MinimalLLMClient,
} from "./types";
import { LLMRateLimitError } from "./guardedLLM";

interface DeepSeekLLMOptions {
  apiKey: string;
  model: string;
  /** Defaults to https://api.deepseek.com */
  baseUrl?: string;
}

interface ChatCompletionResponseBody {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface BalanceResponseBody {
  is_available?: boolean;
  balance_infos?: Array<{
    currency?: string;
    total_balance?: string;
  }>;
  error?: {
    message?: string;
  };
}

export interface DeepSeekKeyStatus {
  /** Whether the account currently has enough balance to make API calls. */
  isAvailable: boolean;
  balances: Array<{ currency: string; totalBalance: string }>;
}

export class DeepSeekLLM implements MinimalLLMClient {
  private readonly baseUrl: string;

  constructor(private readonly options: DeepSeekLLMOptions) {
    this.baseUrl = (options.baseUrl ?? "https://api.deepseek.com").replace(/\/$/, "");
  }

  async invoke(
    messages: LLMMessage[],
    options: LLMInvokeOptions = {}
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: options.signal,
      body: JSON.stringify({
        model: this.options.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const body = await readJsonSafely<ChatCompletionResponseBody>(response);

    if (response.status === 429) {
      const retryAfterRaw = response.headers.get("Retry-After");
      const retryAfterSec = retryAfterRaw ? parseInt(retryAfterRaw, 10) : 15;
      const retryAfterMs = (isNaN(retryAfterSec) ? 15 : retryAfterSec) * 1_000;
      throw new LLMRateLimitError(retryAfterMs);
    }

    if (!response.ok) {
      throw new Error(
        `DeepSeek request failed (${response.status}): ${
          body.error?.message ?? response.statusText
        }`
      );
    }

    const content = body.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("DeepSeek response did not contain text output.");
    }

    return { content };
  }

  /**
   * Check that the API key is accepted, using the balance endpoint.
   * This does not consume tokens.
   *
   * 通过余额接口检查 API key 是否有效，不消耗 token。
   */
  async checkKey(options: LLMInvokeOptions = {}): Promise<DeepSeekKeyStatus> {
    const response = await fetch(`${this.baseUrl}/user/balance`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        Accept: "application/json",
      },
      signal: options.signal,
    });

    const body = await readJsonSafely<BalanceResponseBody>(response);

    if (!response.ok) {
      throw new Error(
        `DeepSeek request failed (${response.status}): ${
          body.error?.message ?? response.statusText
        }`
      );
    }

    return {
      isAvailable: body.is_available === true,
      balances: (body.balance_infos ?? []).map((info) => ({
        currency: info.currency ?? "",
        totalBalance: info.total_balance ?? "",
      })),
    };
  }
}

/**
 * Parse a JSON body without throwing on HTML/empty error pages,
 * so a non-JSON 401/502 is reported as a provider error, not a bad request.
 *
 * 解析 JSON body，遇到 HTML / 空错误页不抛异常，
 * 避免非 JSON 的 401/502 被误报为请求体错误。
 */
async function readJsonSafely<T extends object>(response: Response): Promise<Partial<T>> {
  try {
    return (await response.json()) as Partial<T>;
  } catch {
    return {};
  }
}
