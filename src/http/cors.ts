import { getEnv } from "../config/env";

/**
 * Resolve the Access-Control-Allow-Origin value for a request.
 * ALLOWED_ORIGIN may be "*", a single origin, or a comma-separated list.
 * Entries may contain "*" as a wildcard, e.g. https://quite-reader-*.vercel.app
 * so Vercel preview deployments are allowed too.
 */
export function resolveAllowedOrigin(requestOrigin: string | undefined): string {
  const configured = (getEnv("ALLOWED_ORIGIN") ?? "*")
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (configured.length === 0 || configured.includes("*")) {
    return "*";
  }

  if (requestOrigin) {
    const match = configured.find((pattern) => originMatches(pattern, requestOrigin));
    if (match) {
      return requestOrigin;
    }
  }

  // Not allowed (or no Origin header): return the first configured origin,
  // which the browser will reject for any other caller.
  return configured[0];
}

function originMatches(pattern: string, origin: string): boolean {
  if (!pattern.includes("*")) {
    return pattern === origin;
  }

  const regex = new RegExp(
    "^" +
      pattern
        .split("*")
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join("[a-z0-9-]*") +
      "$",
    "i"
  );
  return regex.test(origin);
}
