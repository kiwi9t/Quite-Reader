import { requestJson } from "./client";
import type { ParsedBook } from "../types/book";

export async function uploadBook(file: File): Promise<ParsedBook> {
  const filename = encodeURIComponent(file.name || "upload.bin");

  devLog("uploadBook start", {
    filename: file.name || "upload.bin",
    fileSize: file.size,
  });

  const book = await requestJson<ParsedBook>(`/api/book/upload?filename=${filename}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  devLog("uploadBook success", {
    bookTitle: book.title,
    chapterCount: book.chapters.length,
  });

  return book;
}

function devLog(message: string, data: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.log(`[api] ${message}`, data);
  }
}
