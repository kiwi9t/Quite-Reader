import { Buffer } from "node:buffer";
import { ApiError } from "./apiError";

export async function readBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<Buffer> {
  const declaredBytes = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw bodyTooLarge(maxBytes);
  }

  if (!request.body) {
    return Buffer.alloc(0);
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw bodyTooLarge(maxBytes);
    }

    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

export async function readJsonBodyWithLimit<T>(
  request: Request,
  maxBytes: number
): Promise<T> {
  const body = await readBodyWithLimit(request, maxBytes);
  const rawBody = body.toString("utf-8");

  if (!rawBody.trim()) {
    throw new ApiError(400, "BAD_REQUEST", "Request body is empty.");
  }

  return JSON.parse(rawBody) as T;
}

function bodyTooLarge(maxBytes: number): ApiError {
  return new ApiError(413, "BODY_TOO_LARGE", "Request body is too large.", {
    maxBytes,
  });
}
