import type {
  LLMInvokeOptions,
  LLMMessage,
  LLMResponse,
  MinimalLLMClient,
} from "./types";
import { LLMRateLimitError } from "./guardedLLM";

interface GeminiLLMOptions {
  apiKey: string;
  model: string;
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    /**
     * "STOP" = normal, "SAFETY" = blocked by safety filter,
     * "RECITATION" = blocked for copyright reasons,
     * "MAX_TOKENS" = truncated, "OTHER" = other block reason.
     */
    finishReason?: string;
  }>;
  /**
   * Present when the entire request is rejected (non-2xx).
   * 整个请求被拒绝时出现（非 2xx）。
   */
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  /**
   * Present when ALL candidates are blocked before generation begins.
   * 所有候选均在生成前被拦截时出现。
   */
  promptFeedback?: {
    blockReason?: string;
  };
}

export class GeminiLLM implements MinimalLLMClient {
  constructor(private readonly options: GeminiLLMOptions) {}

  async invoke(
    messages: LLMMessage[],
    options: LLMInvokeOptions = {}
  ): Promise<LLMResponse> {
    const systemInstruction = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    const userContent = messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.options.model
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.options.apiKey,
        },
        signal: options.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              parts: [{ text: userContent }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            // Disable thinking for gemini-2.5 models.
            // Thinking burns extra tokens on each call, raising rate-limit risk
            // when three agents run sequentially. Structured output generation
            // doesn't need deep reasoning.
            // 禁用 gemini-2.5 的思考模式。
            // 三个 Agent 串行调用时，思考 token 消耗会加速触发限速。
            // 结构化输出生成不需要深度推理。
            ...(this.options.model.includes("gemini-2.5") && {
              thinkingConfig: { thinkingBudget: 0 },
            }),
          },
        }),
      }
    );

    const body = (await response.json()) as GeminiResponseBody;

    // ── Rate limit ───────────────────────────────────────────────────────────
    if (response.status === 429) {
      const retryAfterRaw = response.headers.get("Retry-After");
      const retryAfterSec = retryAfterRaw ? parseInt(retryAfterRaw, 10) : 15;
      const retryAfterMs = (isNaN(retryAfterSec) ? 15 : retryAfterSec) * 1_000;
      throw new LLMRateLimitError(retryAfterMs);
    }

    // ── Other HTTP errors — include status + Gemini's reason in message ──────
    if (!response.ok) {
      const geminiStatus = body.error?.status ?? "";
      const geminiMsg = body.error?.message ?? response.statusText;
      const detail = geminiStatus ? `${geminiStatus}: ${geminiMsg}` : geminiMsg;
      throw new Error(
        `Gemini request failed (${response.status}): ${detail}`
      );
    }

    // ── Request-level content block (SAFETY before generation begins) ────────
    const blockReason = body.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(
        `Gemini request failed (200): prompt blocked by Gemini safety filter — ${blockReason}`
      );
    }

    // ── Output-level content block (SAFETY / RECITATION during generation) ───
    const candidate = body.candidates?.[0];
    const finishReason = candidate?.finishReason;
    if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
      throw new Error(
        `Gemini request failed (200): output blocked — finishReason=${finishReason}`
      );
    }

    const content = extractGeminiText(body);

    if (!content) {
      throw new Error("Gemini response did not contain text output.");
    }

    return { content };
  }
}

function extractGeminiText(body: GeminiResponseBody): string {
  return (
    body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}
