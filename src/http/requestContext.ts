import * as http from "node:http";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  startedAt: number;
  ip: string;
}

export function createRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function getClientIp(req: http.IncomingMessage): string {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return req.socket.remoteAddress ?? "unknown";
}
