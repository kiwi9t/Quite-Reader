export interface ParsedChapter {
  id: string;
  index: number;
  title: string;
  content: string;
  wordCount: number;
  sourceHref?: string;
}

export interface ParsedBook {
  title: string;
  author?: string;
  sourceType: string;
  chapters: ParsedChapter[];
  metadata?: Record<string, unknown>;
}
