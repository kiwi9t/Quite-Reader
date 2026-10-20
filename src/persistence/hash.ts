import { createHash } from "node:crypto";
import type { Buffer } from "node:buffer";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashJson(value: unknown): string {
  return hashString(stableStringify(value));
}

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeJson(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const normalized: Record<string, JsonValue | undefined> = {};

    for (const key of Object.keys(input).sort()) {
      const item = input[key];

      if (item !== undefined) {
        normalized[key] = normalizeJson(item);
      }
    }

    return normalized;
  }

  return String(value);
}
