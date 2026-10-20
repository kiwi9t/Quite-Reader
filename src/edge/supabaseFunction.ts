// src/edge/supabaseFunction.ts
//
// Supabase Edge Function entry point (Deno). Built into
// supabase/functions/quiet-reader/bundle.js by `npm run build:edge`.
//
// Supabase Edge Function 入口（Deno）。由 `npm run build:edge`
// 打包为 supabase/functions/quiet-reader/bundle.js。

import { getEnv, requireEnv } from "../config/env";
import { createApp } from "../http/app";
import { configureCacheStore } from "../persistence/cacheStore";
import { createPostgresCacheStore } from "../persistence/postgresCacheStore";

declare const Deno: {
  serve(
    handler: (
      request: Request,
      info: { remoteAddr?: { hostname?: string } }
    ) => Response | Promise<Response>
  ): unknown;
};

/**
 * Must match the function's folder name under supabase/functions/.
 * 必须与 supabase/functions/ 下的函数目录名一致。
 */
const FUNCTION_NAME = "quiet-reader";

// Supabase injects SUPABASE_DB_URL into every Edge Function.
// QUIET_READER_DATABASE_URL lets you point at a different database.
// Supabase 会给每个 Edge Function 注入 SUPABASE_DB_URL；
// QUIET_READER_DATABASE_URL 可用于指向别的数据库。
configureCacheStore(
  createPostgresCacheStore(
    getEnv("QUIET_READER_DATABASE_URL") ?? requireEnv("SUPABASE_DB_URL")
  )
);

const app = createApp({ basePath: `/${FUNCTION_NAME}` });

Deno.serve((request, info) =>
  app(request, { remoteAddress: info?.remoteAddr?.hostname })
);
