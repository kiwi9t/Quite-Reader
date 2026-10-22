// src/persistence/cacheStore.ts
//
// Storage backend for the cache repository. DATABASE_URL picks it:
// a postgres:// URL (e.g. Supabase) uses Postgres, anything else uses the
// SQLite file through Prisma.
//
// 缓存仓库的存储后端，由 DATABASE_URL 决定：
// postgres:// 开头（如 Supabase）使用 Postgres，否则通过 Prisma 使用 SQLite 文件。

import { getEnv, isPostgresUrl, loadEnvFile } from "../config/env";

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

let storePromise: Promise<CacheStore> | undefined;

export function getCacheStore(): Promise<CacheStore> {
  storePromise ??= createCacheStore();
  return storePromise;
}

async function createCacheStore(): Promise<CacheStore> {
  loadEnvFile();
  const databaseUrl = getEnv("DATABASE_URL");

  if (databaseUrl && isPostgresUrl(databaseUrl)) {
    const { createPostgresCacheStore } = await import("./postgresCacheStore");
    return createPostgresCacheStore(databaseUrl);
  }

  // Imported lazily so a Postgres deployment never opens a SQLite file.
  // 延迟导入，Postgres 部署时不会打开 SQLite 文件。
  const { createPrismaCacheStore } = await import("./prismaCacheStore");
  return createPrismaCacheStore();
}
