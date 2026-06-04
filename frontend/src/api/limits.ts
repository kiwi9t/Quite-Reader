import { API_BASE_URL } from "./client";
import type { ApiEnvelope, LimitsResponse } from "../types/api";

export async function getLimits(): Promise<LimitsResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/limits`);

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as ApiEnvelope<LimitsResponse>;
    return json.ok ? json.data : null;
  } catch {
    return null;
  }
}
