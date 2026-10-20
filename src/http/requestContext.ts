export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  startedAt: number;
  ip: string;
}

export function createRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function getClientIp(request: Request, remoteAddress?: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor?.trim()) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return remoteAddress ?? "unknown";
}
