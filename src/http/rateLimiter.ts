import { ApiError } from "./apiError";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly options: {
      maxRequests: number;
      windowMs: number;
    }
  ) {}

  check(key: string): void {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.options.windowMs,
      });
      return;
    }

    bucket.count += 1;

    if (bucket.count > this.options.maxRequests) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests.", {
        retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
      });
    }
  }
}
