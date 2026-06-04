// src/ingestion/splitChapters.ts
//
// Splits a plain-text document into chapters by detecting heading lines.
// Used by parseText and as a fallback when no structural metadata is available.
//
// 通过检测标题行将纯文本文档拆分为章节。
// 由 parseText 使用，也用于没有结构元数据时的回退处理。

import { normalizeChapter } from "./normalizeChapter";
import type { ParsedChapter } from "./types";

/**
 * Minimum non-whitespace character count for a section body to be kept.
 * Sections shorter than this are merged into the previous section.
 * 保留章节正文所需的最小非空白字符数。短于此值的章节将合并到上一章节。
 */
const MIN_SECTION_BODY_CHARS = 80;

/**
 * Matches explicit chapter/part heading lines.
 * Case-insensitive. Must be the entire (trimmed) line content.
 *
 * 匹配明确的章节/部分标题行。
 * 大小写不敏感，必须是整行（去除空白后）的全部内容。
 *
 * Examples:
 *   Chapter 1
 *   Chapter One
 *   Chapter 1: The Beginning
 *   CHAPTER I
 *   Part 2
 *   Part Two — The Long Road
 *   Prologue
 *   Epilogue
 *   Introduction
 *   Preface
 *   Afterword
 *   Interlude
 */
const CHAPTER_HEADING_RE =
  /^(chapter|part|prologue|epilogue|introduction|preface|afterword|interlude|appendix)(\s+[\w\s–—:,.'-]{0,80})?$/i;

/**
 * Matches Markdown-style ATX headings: # Title or ## Title
 * 匹配 Markdown 风格的 ATX 标题：# Title 或 ## Title
 */
const MARKDOWN_HEADING_RE = /^#{1,2}\s+(.+)$/;

/**
 * Test whether a trimmed line looks like a chapter heading.
 * 测试去除空白后的行是否像章节标题。
 */
function isHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return CHAPTER_HEADING_RE.test(trimmed) || MARKDOWN_HEADING_RE.test(trimmed);
}

/**
 * Extract the display title from a heading line.
 * Strips leading # characters from Markdown headings.
 * 从标题行提取显示标题。去除 Markdown 标题前导的 # 字符。
 */
function headingTitle(line: string): string {
  const trimmed = line.trim();
  const mdMatch = trimmed.match(MARKDOWN_HEADING_RE);
  if (mdMatch) return mdMatch[1].trim();
  return trimmed;
}

interface RawSection {
  title: string;
  bodyLines: string[];
}

/**
 * Split plain text into chapters by detecting heading lines.
 * If no headings are found, the entire text is returned as a single chapter.
 *
 * 通过检测标题行将纯文本拆分为章节。
 * 如果未找到标题，则将整段文本作为单个章节返回。
 */
export function splitIntoChapters(text: string): ParsedChapter[] {
  const lines = text.split(/\r?\n/);
  const sections: RawSection[] = [];
  let current: RawSection | null = null;

  for (const line of lines) {
    if (isHeadingLine(line)) {
      if (current) sections.push(current);
      current = { title: headingTitle(line), bodyLines: [] };
    } else {
      if (!current) {
        // Text before the first heading: treat as a preamble section with no title
        current = { title: "", bodyLines: [] };
      }
      current.bodyLines.push(line);
    }
  }

  if (current) sections.push(current);

  // Filter to sections that have enough body content
  const meaningful = sections.filter(
    (s) =>
      s.bodyLines.join("").replace(/\s/g, "").length >= MIN_SECTION_BODY_CHARS
  );

  // If no structure was found (e.g. plain text with no recognizable headings),
  // return the entire file as one chapter.
  if (meaningful.length === 0) {
    return [normalizeChapter(1, "Chapter 1", text)];
  }

  // If only a preamble was found (title = ""), treat as one chapter
  if (meaningful.length === 1 && !meaningful[0].title) {
    return [normalizeChapter(1, "Chapter 1", meaningful[0].bodyLines.join("\n"))];
  }

  return meaningful.map((s, i) =>
    normalizeChapter(
      i + 1,
      s.title || `Chapter ${i + 1}`,
      s.bodyLines.join("\n")
    )
  );
}
