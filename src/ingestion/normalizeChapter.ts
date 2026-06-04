// src/ingestion/normalizeChapter.ts
//
// Utilities for producing a clean, normalized ParsedChapter from raw text.
// Called by every parser (EPUB, TXT, Markdown) to ensure a consistent shape.
//
// 从原始文本生成干净、标准化 ParsedChapter 的工具。
// 所有解析器（EPUB、TXT、Markdown）均调用此模块以保证输出格式一致。

import type { ParsedChapter } from "./types";

/**
 * Count words in a plain-text string.
 * Splits on whitespace; ignores empty tokens.
 *
 * 统计纯文本字符串的词数。
 * 按空白字符分割，忽略空 token。
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Derive a stable, URL-safe chapter id from its 1-based index and title.
 * Format: "ch-001-some-title-slug"
 *
 * 根据章节序号（从 1 开始）和标题生成稳定的 URL 安全章节 id。
 * 格式："ch-001-some-title-slug"
 */
export function makeChapterId(index: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  const paddedIndex = String(index).padStart(3, "0");
  return `ch-${paddedIndex}-${slug || "chapter"}`;
}

/**
 * Build a normalized ParsedChapter from raw parts.
 * 从原始数据构建标准化的 ParsedChapter。
 *
 * @param index      1-based chapter position  章节序号（从 1 开始）
 * @param title      Chapter title (may be empty string)  章节标题（可为空字符串）
 * @param content    Raw plain-text content  原始纯文本内容
 * @param sourceHref Optional source href (EPUB spine item)  可选原始 href（EPUB spine 条目）
 */
export function normalizeChapter(
  index: number,
  title: string,
  content: string,
  sourceHref?: string
): ParsedChapter {
  const resolvedTitle = title.trim() || `Chapter ${index}`;
  const cleanContent = content.trim();

  return {
    id: makeChapterId(index, resolvedTitle),
    index,
    title: resolvedTitle,
    content: cleanContent,
    wordCount: countWords(cleanContent),
    ...(sourceHref !== undefined ? { sourceHref } : {}),
  };
}
