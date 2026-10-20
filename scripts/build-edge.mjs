// Bundle src/edge/supabaseFunction.ts and its npm dependencies into one ESM
// file that Supabase Edge Functions (Deno) can run without an import map.
//
// 把 src/edge/supabaseFunction.ts 及其 npm 依赖打包成一个 ESM 文件，
// 让 Supabase Edge Functions（Deno）无需 import map 即可运行。

import { readFile } from "node:fs/promises";

import { build } from "esbuild";

/**
 * Deno disables Object.prototype.__proto__, and epub2 reads
 * `this.__proto__.constructor`. Rewrite it to the standard equivalent.
 * Fails the build if epub2 changes, so the patch is never silently skipped.
 *
 * Deno 禁用了 Object.prototype.__proto__，而 epub2 会读取
 * `this.__proto__.constructor`，这里改写为等价的标准写法。
 * epub2 代码变化时构建直接失败，避免补丁被悄悄跳过。
 */
const denoProtoPatch = {
  name: "epub2-deno-proto",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /node_modules[\\/]epub2[\\/]lib[\\/]epub\.js$/ }, async (args) => {
      const source = await readFile(args.path, "utf8");
      const patched = source.replaceAll("this.__proto__", "Object.getPrototypeOf(this)");

      if (patched === source) {
        throw new Error(`epub2 patch did not apply to ${args.path}; check build-edge.mjs.`);
      }

      return { contents: patched, loader: "js" };
    });
  },
};

await build({
  entryPoints: ["src/edge/supabaseFunction.ts"],
  outfile: "supabase/functions/quiet-reader/bundle.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "es2022",
  legalComments: "none",
  logLevel: "info",
  plugins: [denoProtoPatch],
  // CommonJS dependencies (epub2, adm-zip, xml2js) call require() on Node
  // built-ins; Deno provides those through node:module's createRequire.
  // CommonJS 依赖（epub2、adm-zip、xml2js）会 require Node 内置模块；
  // Deno 通过 node:module 的 createRequire 提供这些模块。
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      'import __process from "node:process";',
      'import { Buffer as __Buffer } from "node:buffer";',
      "const require = __createRequire(import.meta.url);",
      "globalThis.process ??= __process;",
      "globalThis.Buffer ??= __Buffer;",
    ].join("\n"),
  },
});
