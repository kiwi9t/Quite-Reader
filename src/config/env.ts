import * as fs from "node:fs";
import * as path from "node:path";

let loaded = false;

export function loadEnvFile(filePath = path.resolve(process.cwd(), ".env")) {
  if (loaded) {
    return;
  }

  loaded = true;

  let envText: string;

  try {
    envText = fs.readFileSync(filePath, "utf-8");
  } catch {
    // No .env file, or no filesystem access (Supabase Edge Functions read
    // their secrets from the environment instead).
    // 没有 .env 文件，或无文件系统权限（Supabase Edge Functions 直接从环境变量读取密钥）。
    return;
  }

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
}

export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
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
