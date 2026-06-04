import { getEnv, loadEnvFile, requireEnv } from "../config/env";
import { DeepSeekLLM } from "./deepseekLLM";
import { GeminiLLM } from "./geminiLLM";
import { withLLMGuards } from "./guardedLLM";
import { mockLLM } from "./mockLLM";
import { OpenAILLM } from "./openaiLLM";
import type { MinimalLLMClient } from "./types";

export type LLMProvider = "mock" | "openai" | "gemini" | "deepseek";

export interface CreatedLLMClient {
  provider: LLMProvider;
  client: MinimalLLMClient;
}

/**
 * All providers whose API keys are present in the environment.
 * Used by the server to support per-request provider switching without restart.
 *
 * 所有在环境变量中配置了 API key 的 provider。
 * 服务器用它支持无需重启的按请求切换 provider。
 */
export interface AvailableClients {
  /** Provider set via LLM_PROVIDER env var — the default when no ?provider= is given. */
  defaultProvider: LLMProvider;
  /** All providers that have a valid API key in .env. mock is always present. */
  availableProviders: LLMProvider[];
  /** Look up a ready-to-use client by provider name. */
  get(provider: LLMProvider): MinimalLLMClient | undefined;
}

/**
 * Initialize every provider for which an API key exists in .env.
 * Call once at server startup; the returned object is safe to share across requests.
 *
 * 初始化所有在 .env 中有 API key 的 provider。
 * 服务器启动时调用一次，返回的对象可安全地在请求间共享。
 */
export function createAllAvailableClients(): AvailableClients {
  loadEnvFile();

  const timeoutMs = readPositiveIntEnv("LLM_TIMEOUT_MS", 45_000);
  const maxPromptChars = readPositiveIntEnv("LLM_MAX_PROMPT_CHARS", 90_000);
  const defaultProvider = normalizeProvider(getEnv("LLM_PROVIDER"));

  const clientMap = new Map<LLMProvider, MinimalLLMClient>();

  // mock — always available, no key required
  clientMap.set("mock", withLLMGuards(mockLLM, { timeoutMs, maxPromptChars }));

  const geminiKey = getEnv("GEMINI_API_KEY");
  if (geminiKey) {
    clientMap.set(
      "gemini",
      withLLMGuards(
        new GeminiLLM({
          apiKey: geminiKey,
          model: getEnv("GEMINI_MODEL") ?? "gemini-2.5-flash",
        }),
        { timeoutMs, maxPromptChars }
      )
    );
  }

  const deepseekKey = getEnv("DEEPSEEK_API_KEY");
  if (deepseekKey) {
    clientMap.set(
      "deepseek",
      withLLMGuards(
        new DeepSeekLLM({
          apiKey: deepseekKey,
          model: getEnv("DEEPSEEK_MODEL") ?? "deepseek-v4-flash",
          baseUrl: getEnv("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
        }),
        { timeoutMs, maxPromptChars }
      )
    );
  }

  const openaiKey = getEnv("OPENAI_API_KEY");
  if (openaiKey) {
    clientMap.set(
      "openai",
      withLLMGuards(
        new OpenAILLM({
          apiKey: openaiKey,
          model: getEnv("OPENAI_MODEL") ?? "gpt-5-mini",
        }),
        { timeoutMs, maxPromptChars }
      )
    );
  }

  return {
    defaultProvider,
    availableProviders: [...clientMap.keys()],
    get(provider: LLMProvider) {
      return clientMap.get(provider);
    },
  };
}

/**
 * Legacy single-provider factory — kept for backward compatibility.
 * Prefer createAllAvailableClients() for new code.
 */
export function createLLMClient(): CreatedLLMClient {
  const all = createAllAvailableClients();
  const client = all.get(all.defaultProvider);
  if (!client) {
    throw new Error(
      `Default provider "${all.defaultProvider}" is not configured. Check your .env file.`
    );
  }
  return { provider: all.defaultProvider, client };
}

export function normalizeProvider(value: string | undefined): LLMProvider {
  if (
    value === "openai" ||
    value === "gemini" ||
    value === "deepseek" ||
    value === "mock"
  ) {
    return value;
  }
  return "mock";
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = getEnv(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
