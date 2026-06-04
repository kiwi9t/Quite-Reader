// src/ingestion/parseText.ts
//
// Parser for plain .txt files.
// Delegates chapter splitting to splitIntoChapters.
//
// 纯文本 .txt 文件解析器。
// 将章节拆分委托给 splitIntoChapters。

import * as path from "node:path";
import { splitIntoChapters } from "./splitChapters";
import type { ParsedBook } from "./types";

/**
 * Parse a plain-text file into a ParsedBook.
 * 将纯文本文件解析为 ParsedBook。
 *
 * @param content  UTF-8 text content of the file  文件的 UTF-8 文本内容
 * @param filename Original filename (used to infer the book title)  原始文件名（用于推断书名）
 */
export function parseText(content: string, filename: string): ParsedBook {
  const title = path.basename(filename, path.extname(filename));
  const chapters = splitIntoChapters(content);

  return {
    title,
    sourceType: "txt",
    chapters,
    metadata: { filename },
  };
}
