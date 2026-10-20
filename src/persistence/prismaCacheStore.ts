// src/persistence/prismaCacheStore.ts
//
// SQLite cache store backed by Prisma + better-sqlite3 (local dev, Railway).
// SQLite 缓存存储，基于 Prisma + better-sqlite3（本地开发、Railway）。

import type { CacheStore, StoredChapter } from "./cacheStore";
import { prisma } from "./prisma";

export function createPrismaCacheStore(): CacheStore {
  return {
    async getStats() {
      const [
        userProfiles,
        books,
        chapters,
        chapterAnalyses,
        nonSpoilerContexts,
        readingProgressRecords,
      ] = await Promise.all([
        prisma.userProfileCache.count(),
        prisma.book.count(),
        prisma.chapter.count(),
        prisma.chapterAnalysisCache.count(),
        prisma.nonSpoilerContextCache.count(),
        prisma.readingProgressRecord.count(),
      ]);

      return {
        userProfiles,
        books,
        chapters,
        chapterAnalyses,
        nonSpoilerContexts,
        readingProgressRecords,
      };
    },

    async findUserProfileJson(userInputHash) {
      const cached = await prisma.userProfileCache.findUnique({
        where: { userInputHash },
      });
      return cached?.profileJson ?? null;
    },

    async saveUserProfile(params) {
      await prisma.userProfileCache.upsert({
        where: { userInputHash: params.userInputHash },
        create: params,
        update: {
          userInputJson: params.userInputJson,
          profileJson: params.profileJson,
        },
      });
    },

    async findChapterAnalysisJson(params) {
      const cached = await prisma.chapterAnalysisCache.findUnique({
        where: { chapterHash_userProfileHash: params },
      });
      return cached?.analysisJson ?? null;
    },

    async saveChapterAnalysis(params) {
      await prisma.chapterAnalysisCache.upsert({
        where: {
          chapterHash_userProfileHash: {
            chapterHash: params.chapterHash,
            userProfileHash: params.userProfileHash,
          },
        },
        create: params,
        update: { analysisJson: params.analysisJson },
      });
    },

    async findNonSpoilerContextJson(params) {
      const cached = await prisma.nonSpoilerContextCache.findUnique({
        where: { chapterHash_readingProgressHash: params },
      });
      return cached?.contextJson ?? null;
    },

    async saveNonSpoilerContext(params) {
      await prisma.nonSpoilerContextCache.upsert({
        where: {
          chapterHash_readingProgressHash: {
            chapterHash: params.chapterHash,
            readingProgressHash: params.readingProgressHash,
          },
        },
        create: params,
        update: { contextJson: params.contextJson },
      });
    },

    async saveReadingProgress(record) {
      const { readingProgressHash, ...fields } = record;
      await prisma.readingProgressRecord.upsert({
        where: { readingProgressHash },
        create: record,
        update: fields,
      });
    },

    async findBook(contentHash) {
      const book = await prisma.book.findUnique({
        where: { contentHash },
        include: { chapters: { orderBy: { index: "asc" } } },
      });

      if (!book) {
        return null;
      }

      return {
        contentHash: book.contentHash,
        filename: book.filename,
        title: book.title,
        author: book.author ?? undefined,
        sourceType: book.sourceType,
        metadataJson: book.metadataJson ?? undefined,
        chapters: book.chapters.map(
          (chapter): StoredChapter => ({
            chapterHash: chapter.chapterHash,
            sourceId: chapter.sourceId,
            index: chapter.index,
            title: chapter.title,
            content: chapter.content,
            wordCount: chapter.wordCount,
            sourceHref: chapter.sourceHref ?? undefined,
          })
        ),
      };
    },

    async saveBook(book) {
      const { chapters, contentHash, ...fields } = book;
      await prisma.book.upsert({
        where: { contentHash },
        create: {
          contentHash,
          ...fields,
          chapters: { create: chapters },
        },
        update: {
          ...fields,
          chapters: { deleteMany: {}, create: chapters },
        },
      });
    },
  };
}
