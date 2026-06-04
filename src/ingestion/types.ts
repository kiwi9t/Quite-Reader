// src/ingestion/types.ts
//
// Normalized types for parsed ebook content.
// These are independent of the agent workflow — ingestion produces these types,
// and the workflow consumes them via ChapterInput.
//
// 解析电子书内容的标准化类型。
// 与 Agent 工作流无关——Ingestion 层产出这些类型，工作流通过 ChapterInput 消费它们。

/**
 * A single parsed chapter with normalized plain-text content.
 * 解析后的单章节，包含标准化纯文本内容。
 */
export interface ParsedChapter {
  /**
   * Stable, URL-safe identifier derived from the chapter index and title.
   * 由章节序号和标题衍生的稳定 URL 安全标识符。
   *
   * Format: "ch-001-chapter-title"
   */
  id: string;

  /**
   * 1-based chapter position within the book.
   * 在书中的章节序号，从 1 开始。
   */
  index: number;

  /**
   * Chapter title. Falls back to "Chapter N" if not found in source.
   * 章节标题。如果源文件中无标题，则回退为 "Chapter N"。
   */
  title: string;

  /**
   * Clean plain-text chapter content with original paragraph structure preserved.
   * 保留原始段落结构的纯文本章节内容。
   */
  content: string;

  /**
   * Approximate word count of the content.
   * 内容的近似词数。
   */
  wordCount: number;

  /**
   * Original href or file path of the chapter in the source file, if available.
   * 源文件中章节的原始 href 或文件路径（如有）。
   *
   * For EPUB, this is the spine item href.
   * 对于 EPUB，这是 spine 条目的 href。
   */
  sourceHref?: string;
}

/**
 * A fully parsed book containing ordered chapters.
 * 包含有序章节的完整解析书籍。
 */
export interface ParsedBook {
  /**
   * Book title extracted from file metadata or filename.
   * 从文件元数据或文件名中提取的书名。
   */
  title: string;

  /**
   * Author name, if available.
   * 作者名（如有）。
   */
  author?: string;

  /**
   * Format of the source file.
   * 源文件格式。
   */
  sourceType: "epub" | "txt" | "markdown" | "mobi" | "pdf" | "unknown";

  /**
   * Ordered list of parsed chapters.
   * 有序章节列表。
   */
  chapters: ParsedChapter[];

  /**
   * Additional format-specific metadata.
   * 额外的格式特定元数据。
   */
  metadata?: Record<string, unknown>;
}
