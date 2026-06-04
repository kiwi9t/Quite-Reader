import * as http from "node:http";
import { ApiError } from "./apiError";

export async function readBodyWithLimit(
  req: http.IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw new ApiError(413, "BODY_TOO_LARGE", "Request body is too large.", {
        maxBytes,
      });
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export async function readJsonBodyWithLimit<T>(
  req: http.IncomingMessage,
  maxBytes: number
): Promise<T> {
  const body = await readBodyWithLimit(req, maxBytes);
  const rawBody = body.toString("utf-8");

  if (!rawBody.trim()) {
    throw new ApiError(400, "BAD_REQUEST", "Request body is empty.");
  }

  return JSON.parse(rawBody) as T;
}
