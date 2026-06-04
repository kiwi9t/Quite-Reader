import { requestJson } from "./client";

export type ProviderName = "gemini" | "deepseek";

export interface ProvidersResponse {
  default: string;
  active?: string;
  available: string[];
}

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
