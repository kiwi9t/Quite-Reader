// src/ingestion/parseMarkdown.ts
//
// Parser for Markdown (.md / .markdown) files.
// Splits on ATX headings (# and ##) to detect chapter boundaries.
//
// Markdown（.md / .markdown）文件解析器。
// 以 ATX 标题（# 和 ##）为边界拆分章节。

import * as path from "node:path";
import { normalizeChapter } from "./normalizeChapter";
import type { ParsedBook, ParsedChapter } from "./types";

/**
 * Regex that matches a line starting with one or two `#` characters.
 * Used as a look-ahead split point.
 * 匹配以一个或两个 `#` 字符开头的行，用作前瞻分割点。
 */
const H1_OR_H2_RE = /^#{1,2} .+$/m;

/**
 * Parse a Markdown file into a ParsedBook.
 * 将 Markdown 文件解析为 ParsedBook。
 *
 * @param content  UTF-8 Markdown content  UTF-8 Markdown 内容
 * @param filename Original filename (used to infer the book title)  原始文件名（用于推断书名）
 */
export function parseMarkdown(content: string, filename: string): ParsedBook {
  const title = path.basename(filename, path.extname(filename));
  const chapters = splitMarkdownChapters(content, title);

  return {
    title,
    sourceType: "markdown",
    chapters,
    metadata: { filename },
  };
}

/**
 * Split Markdown content into chapters on h1/h2 headings.
 * If no headings are found, returns the full content as a single chapter.
 *
 * 以 h1/h2 标题为边界拆分 Markdown 内容为章节。
 * 如果未找到标题，则将全部内容作为单个章节返回。
 */
function splitMarkdownChapters(content: string, fallbackTitle: string): ParsedChapter[] {
  // Split on heading lines but keep the heading itself in the part that follows
  const parts = content.split(/(?=^#{1,2} .+$)/m);
  const chapters: ParsedChapter[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^(#{1,2}) (.+)$/m);

    if (headingMatch) {
      const chapterTitle = headingMatch[2].trim();
      // Body is everything after the heading line
      const headingEnd = trimmed.indexOf(headingMatch[0]) + headingMatch[0].length;
      const body = trimmed.slice(headingEnd).trim();

      if (body.length > 0) {
        chapters.push(
          normalizeChapter(chapters.length + 1, chapterTitle, body)
        );
      }
    } else {
      // Content before the first heading — treat as an introductory section
      if (trimmed.length > 0) {
        chapters.push(
          normalizeChapter(chapters.length + 1, fallbackTitle, trimmed)
        );
      }
    }
  }

  if (chapters.length === 0) {
    return [normalizeChapter(1, fallbackTitle, content)];
  }

  return chapters;
}
