// src/ingestion/parseEpub.ts
//
// EPUB parser. Uses the `epub2` package (npm install epub2).
//
// Strategy:
// - Write the uploaded buffer to a temp file (epub2 needs a file path)
// - Walk the EPUB spine in reading order
// - Cross-reference spine items with the TOC for human-readable chapter titles
// - Fall back to the first <h1>/<h2> in the HTML, then to "Chapter N"
// - Strip HTML with htmlToText, normalize with normalizeChapter
// - Delete the temp file in a finally block
//
// EPUB 解析器。使用 `epub2` 包（npm install epub2）。
//
// 策略：
// - 将上传的 buffer 写入临时文件（epub2 需要文件路径）
// - 按阅读顺序遍历 EPUB spine
// - 将 spine 条目与目录交叉引用，获取可读的章节标题
// - 依次回退：HTML 中的第一个 <h1>/<h2>，然后是 "Chapter N"
// - 用 htmlToText 去除 HTML 标签，用 normalizeChapter 标准化
// - 在 finally 块中删除临时文件

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import EPub from "epub2";

import { extractFirstHeading, htmlToText } from "./htmlToText";
import { normalizeChapter } from "./normalizeChapter";
import type { ParsedBook, ParsedChapter } from "./types";

/**
 * Minimum character count for a chapter body to be included.
 * Filters out near-empty navigation or cover pages.
 * 章节正文需要包含的最小字符数。过滤掉几乎为空的导航页或封面页。
 */
const MIN_CHAPTER_CHARS = 100;

/**
 * Parse an EPUB buffer into a ParsedBook.
 * 将 EPUB buffer 解析为 ParsedBook。
 *
 * @param buffer   Raw bytes of the .epub file  .epub 文件的原始字节
 * @param filename Original filename (used as title fallback)  原始文件名（用作标题回退）
 */
export async function parseEpub(
  buffer: Buffer,
  filename: string
): Promise<ParsedBook> {
  // Write to a temp file — epub2 requires a filesystem path
  // 写入临时文件——epub2 需要文件系统路径
  const tmpPath = path.join(
    os.tmpdir(),
    `vocab-epub-${Date.now()}-${Math.random().toString(36).slice(2)}.epub`
  );

  await fs.writeFile(tmpPath, buffer);

  try {
    return await parseEpubFromFile(tmpPath, filename);
  } finally {
    await fs.unlink(tmpPath).catch(() => {
      // Ignore temp file cleanup errors
    });
  }
}

async function parseEpubFromFile(
  filepath: string,
  originalFilename: string
): Promise<ParsedBook> {
  const epub = await EPub.createAsync(filepath, "", "");

  const bookTitle =
    epub.metadata.title?.trim() ||
    path.basename(originalFilename, path.extname(originalFilename));

  const bookAuthor = epub.metadata.creator?.trim() || undefined;

  // Build a lookup: base href (without fragment) -> TOC title
  // 构建查找表：基础 href（不含片段）-> 目录标题
  const hrefToTocTitle = buildHrefToTocTitle(epub.toc ?? []);

  const chapters: ParsedChapter[] = [];

  for (const item of epub.flow) {
    let html: string;

    try {
      html = await epub.getChapterAsync(item.id);
    } catch {
      // Some spine items may be unreadable (CSS, images); skip them
      // 某些 spine 条目可能无法读取（CSS、图片等），跳过
      continue;
    }

    const text = htmlToText(html);

    // Skip near-empty pages (covers, navigation, separators)
    // 跳过几乎为空的页面（封面、导航页、分隔页）
    if (text.replace(/\s/g, "").length < MIN_CHAPTER_CHARS) {
      continue;
    }

    // Resolve chapter title: TOC > HTML heading > spine item title > fallback
    // 解析章节标题：目录 > HTML 标题 > spine 条目标题 > 回退
    const href = item.href ?? "";
    const baseHref = href.split("#")[0];
    const chapterTitle =
      hrefToTocTitle.get(baseHref) ??
      extractFirstHeading(html) ??
      item.title?.trim() ??
      "";

    chapters.push(
      normalizeChapter(chapters.length + 1, chapterTitle, text, href)
    );
  }

  if (chapters.length === 0) {
    throw new Error(
      `No readable chapters found in EPUB: ${originalFilename}`
    );
  }

  return {
    title: bookTitle,
    ...(bookAuthor ? { author: bookAuthor } : {}),
    sourceType: "epub",
    chapters,
    metadata: {
      language: epub.metadata.language || undefined,
      subject: epub.metadata.subject || undefined,
      description: epub.metadata.description || undefined,
      publisher: epub.metadata.publisher || undefined,
    },
  };
}

/**
 * Build a Map from base href -> TOC title from the EPUB table of contents.
 * The href is stripped of any fragment identifier (#section).
 *
 * 从 EPUB 目录构建 基础 href -> 目录标题 的 Map。
 * href 去除片段标识符（#section）。
 */
function buildHrefToTocTitle(toc: EPub["toc"]): Map<string, string> {
  const map = new Map<string, string>();

  for (const item of toc) {
    if (item.href && item.title) {
      const baseHref = item.href.split("#")[0];
      // First entry wins (avoids sub-sections overwriting their parent)
      // 保留第一个条目（避免子章节覆盖父章节）
      if (!map.has(baseHref)) {
        map.set(baseHref, item.title.trim());
      }
    }
  }

  return map;
}
