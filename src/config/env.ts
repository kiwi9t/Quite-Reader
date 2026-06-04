import * as fs from "node:fs";
import * as path from "node:path";

let loaded = false;

export function loadEnvFile(filePath = path.resolve(process.cwd(), ".env")) {
  if (loaded || !fs.existsSync(filePath)) {
    loaded = true;
    return;
  }

  const envText = fs.readFileSync(filePath, "utf-8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = stripOptionalQuotes(rawValue);

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  loaded = true;
}

export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function stripOptionalQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
