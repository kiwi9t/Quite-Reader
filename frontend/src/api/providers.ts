import { requestJson } from "./client";

export type ProviderName = "gemini" | "deepseek";

export interface ProvidersResponse {
  default: string;
  active?: string;
  available: string[];
  /** Providers that accept the reader's own API key. */
  userKeyProviders?: string[];
}

export interface DeepSeekKeyStatus {
  isAvailable: boolean;
  balances: Array<{ currency: string; totalBalance: string }>;
}

export const USER_DEEPSEEK_KEY_HEADER = "X-DeepSeek-Api-Key";

export interface ActiveProviderResponse {
  llmProvider: ProviderName;
  availableProviders: string[];
}

export async function getProviders(): Promise<ProvidersResponse> {
  return requestJson<ProvidersResponse>("/api/providers");
}

export async function setActiveProvider(
  provider: ProviderName
): Promise<ActiveProviderResponse> {
  return requestJson<ActiveProviderResponse>("/api/providers/active", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider }),
  });
}

export async function verifyDeepSeekKey(apiKey: string): Promise<DeepSeekKeyStatus> {
  return requestJson<DeepSeekKeyStatus>("/api/providers/deepseek/verify", {
    method: "POST",
    headers: {
      [USER_DEEPSEEK_KEY_HEADER]: apiKey,
    },
  });
}
