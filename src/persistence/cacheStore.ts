// src/persistence/cacheStore.ts
//
// Storage backend for the cache repository. The Node server picks SQLite
// (Prisma) or Postgres; the Supabase Edge Function always uses Postgres.
//
// 缓存仓库的存储后端。Node 服务器可选 SQLite（Prisma）或 Postgres；
// Supabase Edge Function 固定使用 Postgres。

export interface CacheStats {
  userProfiles: number;
  books: number;
  chapters: number;
  chapterAnalyses: number;
  nonSpoilerContexts: number;
  readingProgressRecords: number;
}

export interface StoredChapter {
  chapterHash: string;
  sourceId: string;
  index: number;
  title: string;
  content: string;
  wordCount: number;
  sourceHref?: string;
}

export interface StoredBook {
  contentHash: string;
  filename: string;
  title: string;
  author?: string;
  sourceType: string;
  metadataJson?: string;
  chapters: StoredChapter[];
}

export interface StoredReadingProgress {
  readingProgressHash: string;
  bookTitle: string;
  currentChapterIndex: number;
  currentChapterTitle: string;
  safePreviousSummary?: string;
  progressJson: string;
}

export interface CacheStore {
  getStats(): Promise<CacheStats>;

  findUserProfileJson(userInputHash: string): Promise<string | null>;
  saveUserProfile(params: {
    userInputHash: string;
    userInputJson: string;
    profileJson: string;
  }): Promise<void>;

  findChapterAnalysisJson(params: {
    chapterHash: string;
    userProfileHash: string;
  }): Promise<string | null>;
  saveChapterAnalysis(params: {
    chapterHash: string;
    userProfileHash: string;
    analysisJson: string;
  }): Promise<void>;

  findNonSpoilerContextJson(params: {
    chapterHash: string;
    readingProgressHash: string;
  }): Promise<string | null>;
  saveNonSpoilerContext(params: {
    chapterHash: string;
    readingProgressHash: string;
    contextJson: string;
  }): Promise<void>;

  saveReadingProgress(record: StoredReadingProgress): Promise<void>;

  findBook(contentHash: string): Promise<StoredBook | null>;
  saveBook(book: StoredBook): Promise<void>;
}

let activeStore: CacheStore | undefined;

export function configureCacheStore(store: CacheStore): void {
  activeStore = store;
}

export function getCacheStore(): CacheStore {
  if (!activeStore) {
    throw new Error("Cache store is not configured. Call configureCacheStore() at startup.");
  }

  return activeStore;
}
