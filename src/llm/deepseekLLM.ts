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
        // Every agent asks for one JSON object. JSON mode makes DeepSeek always
        // return parseable JSON, so we stop paying for full retries caused by
        // stray Markdown fences or prose around the object.
        // 所有 Agent 都要求返回 JSON；开启 JSON 模式可避免因格式问题整轮重试。
        response_format: { type: "json_object" },
      }),
    });

    const body = (await response.json()) as ChatCompletionResponseBody;

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
}
