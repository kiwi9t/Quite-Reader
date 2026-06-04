export type LogLevel = "debug" | "info" | "warn" | "error";

export function logEvent(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {}
): void {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  };

  const line = JSON.stringify(redactSecrets(entry));

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    output[key] = /api[-_]?key|authorization|token|secret/i.test(key)
      ? "[REDACTED]"
      : redactSecrets(item);
  }

  return output;
}
