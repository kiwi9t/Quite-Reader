// src/ingestion/htmlToText.ts
//
// Converts HTML (from EPUB chapters) into clean plain text,
// preserving paragraph structure while stripping all markup.
//
// 将 HTML（来自 EPUB 章节）转换为干净的纯文本，
// 在去除所有标记的同时保留段落结构。

/**
 * Convert an HTML string to clean plain text.
 * 将 HTML 字符串转换为干净的纯文本。
 *
 * Strategy:
 * 1. Block-level elements (p, div, h1-h6, br, hr, blockquote, li) become line breaks.
 * 2. All remaining tags are stripped.
 * 3. Common HTML entities are decoded.
 * 4. Runs of whitespace are collapsed; runs of blank lines are reduced to one.
 *
 * 策略：
 * 1. 块级元素（p, div, h1-h6, br, hr, blockquote, li）转换为换行。
 * 2. 去除其余所有标签。
 * 3. 解码常见 HTML 实体。
 * 4. 折叠连续空白；多个空行减少为一行。
 */
export function htmlToText(html: string): string {
  return html
    // ── Block elements -> paragraph breaks ──────────────────────────────
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<\/blockquote\s*>/gi, "\n\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n")
    // Headings get a blank line after them
    .replace(/<\/h[1-6]\s*>/gi, "\n\n")

    // ── Strip remaining tags ─────────────────────────────────────────────
    .replace(/<[^>]+>/g, "")

    // ── Decode HTML entities ─────────────────────────────────────────────
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&hellip;/g, "…")
    // Numeric character references: &#8217; or &#x2019;
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )

    // ── Whitespace normalization ─────────────────────────────────────────
    // Collapse horizontal whitespace within a line (but not newlines)
    .replace(/[ \t]+/g, " ")
    // Remove trailing spaces from lines
    .replace(/ +\n/g, "\n")
    .replace(/\n +/g, "\n")
    // Collapse 3+ consecutive newlines to exactly 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract the text of the first h1 or h2 element from HTML.
 * Returns null if no heading is found.
 *
 * 从 HTML 中提取第一个 h1 或 h2 元素的文本。
 * 如果找不到标题则返回 null。
 */
export function extractFirstHeading(html: string): string | null {
  const match = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
  if (!match) return null;
  const text = match[1].replace(/<[^>]+>/g, "").trim();
  return text || null;
}
