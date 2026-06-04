export interface ApiSuccessEnvelope<T> {
  ok: true;
  data: T;
  cache?: unknown;
}

export interface ApiErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface HealthResponse {
  ok: true;
  message: string;
  llmProvider: string;
  availableProviders?: string[];
}

export interface LimitsResponse {
  maxJsonBodyBytes?: number;
  maxUploadBytes?: number;
  maxChapterContentChars?: number;
  maxSafePreviousSummaryChars?: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}
