// src/server.ts
//
// Node entry point: adapts node:http to the fetch handler in ./http/app.
// Node 入口：把 node:http 适配到 ./http/app 中的 fetch handler。

import { Buffer } from "node:buffer";
import * as http from "node:http";
import { Readable } from "node:stream";

import { getEnv, isPostgresUrl, loadEnvFile } from "./config/env";
import { createApp } from "./http/app";
import { logEvent } from "./http/logger";
import { configureCacheStore, type CacheStore } from "./persistence/cacheStore";
import { createPostgresCacheStore } from "./persistence/postgresCacheStore";

async function main(): Promise<void> {
  loadEnvFile();
  configureCacheStore(await createCacheStore());

  const app = createApp();

  const server = http.createServer(async (req, res) => {
    try {
      const response = await app(toWebRequest(req), {
        remoteAddress: req.socket.remoteAddress,
      });

      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      // The app turns its own errors into JSON; this only catches adapter bugs.
      // app 会把自身错误转成 JSON；这里只兜底适配层自身的异常。
      logEvent("error", "adapter_failed", {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      }
      res.end(JSON.stringify({ ok: false, error: { code: "INTERNAL_ERROR" } }));
    }
  });

  const port = Number(getEnv("PORT") ?? 3000);

  server.listen(port, () => {
    logEvent("info", "server_started", { port });
  });
}

/**
 * DATABASE_URL starting with postgres:// uses Postgres (e.g. Supabase);
 * anything else uses the local SQLite file through Prisma.
 *
 * DATABASE_URL 以 postgres:// 开头时使用 Postgres（如 Supabase），
 * 否则通过 Prisma 使用本地 SQLite 文件。
 */
async function createCacheStore(): Promise<CacheStore> {
  const databaseUrl = getEnv("DATABASE_URL");

  if (databaseUrl && isPostgresUrl(databaseUrl)) {
    return createPostgresCacheStore(databaseUrl);
  }

  const { createPrismaCacheStore } = await import(
    "./persistence/prismaCacheStore"
  );
  return createPrismaCacheStore();
}

function toWebRequest(req: http.IncomingMessage): Request {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
    // Required by Node's fetch implementation for streaming request bodies.
    duplex: "half",
  } as RequestInit);
}

void main();
