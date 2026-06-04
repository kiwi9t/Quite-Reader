// src/ingestion/parseBook.ts
//
// Entry-point dispatcher for the ingestion layer.
// Routes to the correct parser based on the file extension.
//
// 摄取层的入口分发器。
// 根据文件扩展名路由到对应的解析器。

import * as path from "node:path";

import { parseEpub } from "./parseEpub";
import { parseMarkdown } from "./parseMarkdown";
import { parseText } from "./parseText";
import type { ParsedBook } from "./types";

/**
 * Parse an uploaded file buffer into a ParsedBook.
 * The correct parser is selected based on the filename extension.
 *
 * 将上传的文件 buffer 解析为 ParsedBook。
 * 根据文件名扩展名选择对应的解析器。
 *
 * Supported formats:
 *   .epub      → EPUB parser (requires epub2 installed)
 *   .md / .markdown → Markdown parser (heading-aware chapter splitting)
 *   .txt       → Plain-text parser (keyword heading detection)
 *   anything else → falls back to plain-text parser
 *
 * 支持的格式：
 *   .epub      → EPUB 解析器（需要安装 epub2）
 *   .md / .markdown → Markdown 解析器（感知标题的章节拆分）
 *   .txt       → 纯文本解析器（关键词标题检测）
 *   其他       → 回退到纯文本解析器
 *
 * @param buffer   Raw file bytes  原始文件字节
 * @param filename Original filename including extension  含扩展名的原始文件名
 */
export async function parseBook(
  buffer: Buffer,
  filename: string
): Promise<ParsedBook> {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case ".epub":
      return parseEpub(buffer, filename);

    case ".md":
    case ".markdown":
      return parseMarkdown(buffer.toString("utf-8"), filename);

    case ".txt":
      return parseText(buffer.toString("utf-8"), filename);

    default:
      // Unknown extension: attempt plain-text parsing, mark as unknown
      // 未知扩展名：尝试纯文本解析，标记为 unknown
      return {
        ...parseText(buffer.toString("utf-8"), filename),
        sourceType: "unknown",
      };
  }
}
