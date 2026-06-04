import { API_BASE_URL } from "./client";
import type { HealthResponse } from "../types/api";

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  const health = (await response.json()) as HealthResponse;

  if (import.meta.env.DEV) {
    console.log("[api] health", {
      provider: health.llmProvider,
    });
  }

  return health;
}
