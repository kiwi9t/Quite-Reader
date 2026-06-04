import {
  ApiClientError,
  type ApiEnvelope,
  type ApiSuccessEnvelope,
} from "../types/api";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const json = (await response.json()) as ApiEnvelope<T> | T;

  if (isApiEnvelope<T>(json)) {
    if (!json.ok) {
      throw new ApiClientError(
        json.error.code,
        json.error.message,
        json.error.requestId,
        json.error.details
      );
    }

    return json.data;
  }

  if (!response.ok) {
    throw new ApiClientError(
      "HTTP_ERROR",
      `Request failed with status ${response.status}.`
    );
  }

  return json as T;
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "ok" in value;
}

export function unwrapSuccess<T>(value: ApiSuccessEnvelope<T>): T {
  return value.data;
}
