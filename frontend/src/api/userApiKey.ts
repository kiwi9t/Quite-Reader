// Stores the reader's own DeepSeek API key in this browser only.
// By default the key lives in sessionStorage (cleared when the tab closes);
// "remember on this device" moves it to localStorage.
//
// 只在当前浏览器保存用户自己的 DeepSeek API key。
// 默认存于 sessionStorage（关闭标签页即清除）；勾选“在此设备记住”后存于 localStorage。

const STORAGE_KEY = "quietReader.deepseekApiKey";

export interface StoredApiKey {
  apiKey: string;
  remember: boolean;
}

export function loadDeepSeekApiKey(): StoredApiKey | null {
  const remembered = safeGet(() => window.localStorage);
  if (remembered) return { apiKey: remembered, remember: true };

  const session = safeGet(() => window.sessionStorage);
  if (session) return { apiKey: session, remember: false };

  return null;
}

export function saveDeepSeekApiKey(apiKey: string, remember: boolean): void {
  clearDeepSeekApiKey();
  const target = remember ? () => window.localStorage : () => window.sessionStorage;
  try {
    target().setItem(STORAGE_KEY, apiKey);
  } catch {
    // Storage blocked (private mode, disabled cookies): keep the key in memory only.
  }
}

export function clearDeepSeekApiKey(): void {
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      storage().removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/** Show only the start and end of a key, e.g. "sk-a…9f3c". */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 10) return "••••";
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}

function safeGet(storage: () => Storage): string | null {
  try {
    const value = storage().getItem(STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}
