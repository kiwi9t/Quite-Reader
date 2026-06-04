/**
 * test-providers.cjs
 *
 * Standalone provider integration test.
 * Reads .env, checks key presence, sends a minimal prompt,
 * and prints results WITHOUT revealing any API key value.
 *
 * Safe to run: never logs values for *_API_KEY variables.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// ── 1. Load .env ────────────────────────────────────────────────────────────

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    console.error("[env] .env file not found at", envPath);
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const raw = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = raw;
    }
  }
}

// Accept --env-path=... flag, or default to cwd/.env
const envArgMatch = process.argv.find(a => a.startsWith("--env-path="));
const envFilePath = envArgMatch
  ? envArgMatch.split("=").slice(1).join("=")
  : path.resolve(process.cwd(), ".env");

loadEnv(envFilePath);

// ── 2. Safe env reporter ─────────────────────────────────────────────────────

function safeGet(name) {
  const v = (process.env[name] || "").trim();
  if (!v) return { present: false, nonEmpty: false, value: null };
  if (name.endsWith("_API_KEY")) return { present: true, nonEmpty: true, value: "[REDACTED]" };
  return { present: true, nonEmpty: true, value: v };
}

const provider = safeGet("LLM_PROVIDER").value || "mock";

console.log("\n=== Provider environment ===");
for (const k of [
  "LLM_PROVIDER", "GEMINI_MODEL", "GEMINI_API_KEY",
  "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_API_KEY",
]) {
  const r = safeGet(k);
  const display = r.nonEmpty ? (name => name.endsWith("_API_KEY") ? "[REDACTED]" : r.value)(k) : "(not set)";
  console.log(`  ${k}: ${display}`);
}
console.log(`\nActive provider: ${provider}\n`);

// ── 3. Minimal test payload ──────────────────────────────────────────────────

const TEST_SYSTEM = "You are a concise assistant. Reply in JSON only.";
const TEST_USER   = 'Return exactly this JSON: {"ok": true, "provider": "test"}';

// ── 4. Gemini call ───────────────────────────────────────────────────────────

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model  = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

  if (!apiKey) {
    console.log("[gemini] GEMINI_API_KEY not set — skipping.");
    return;
  }

  console.log(`[gemini] Sending test request (model: ${model}) ...`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: TEST_SYSTEM }] },
      contents: [{ parts: [{ text: TEST_USER }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error(`[gemini] ❌ HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`);
    return;
  }

  const text = body?.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("").trim();
  console.log("[gemini] Raw response text:", text);

  try {
    const parsed = JSON.parse(text);
    console.log("[gemini] ✅ Parsed JSON:", JSON.stringify(parsed));
  } catch {
    console.warn("[gemini] ⚠️  Response is not valid JSON.");
  }
}

// ── 5. DeepSeek call ─────────────────────────────────────────────────────────

async function testDeepSeek() {
  const apiKey  = process.env.DEEPSEEK_API_KEY;
  const model   = (process.env.DEEPSEEK_MODEL   || "deepseek-v4-flash").trim();
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");

  if (!apiKey) {
    console.log("[deepseek] DEEPSEEK_API_KEY not set — skipping.");
    return;
  }

  console.log(`[deepseek] Sending test request (model: ${model}, base: ${baseUrl}) ...`);

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system",  content: TEST_SYSTEM },
        { role: "user",    content: TEST_USER   },
      ],
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error(`[deepseek] ❌ HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`);
    return;
  }

  const text = body?.choices?.[0]?.message?.content?.trim();
  console.log("[deepseek] Raw response text:", text);

  try {
    const parsed = JSON.parse(text);
    console.log("[deepseek] ✅ Parsed JSON:", JSON.stringify(parsed));
  } catch {
    console.warn("[deepseek] ⚠️  Response is not valid JSON.");
  }
}

// ── 6. Run ───────────────────────────────────────────────────────────────────

(async () => {
  if (provider === "gemini") {
    await testGemini();
  } else if (provider === "deepseek") {
    await testDeepSeek();
  } else {
    console.log(`Provider is "${provider}" — no real API call needed.`);
    console.log("To test Gemini:   set LLM_PROVIDER=gemini in .env");
    console.log("To test DeepSeek: set LLM_PROVIDER=deepseek in .env");
  }
})();
