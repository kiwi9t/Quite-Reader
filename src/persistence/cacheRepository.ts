import type {
  ChapterAnalysisResult,
  ChapterInput,
  NonSpoilerContextResult,
  ReadingProgress,
  UserInput,
  UserProfile,
} from "../state";
import type { ParsedBook, ParsedChapter } from "../ingestion/types";
import {
  ChapterAnalysisResultSchema,
  NonSpoilerContextResultSchema,
  UserProfileSchema,
} from "../schemas/readingSchemas";
import { hashBuffer, hashJson, stableStringify } from "./hash";
import { prisma } from "./prisma";

export interface CacheStats {
  userProfiles: number;
  books: number;
  chapters: number;
  chapterAnalyses: number;
  nonSpoilerContexts: number;
  readingProgressRecords: number;
}

export async function getCacheStats(): Promise<CacheStats> {
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
}

export function getUserInputHash(userInput: UserInput): string {
  return hashJson(userInput);
}

export function getUserProfileHash(userProfile: UserProfile): string {
  return hashJson(userProfile);
}

export function getChapterHash(chapterInput: ChapterInput): string {
  return hashJson(chapterInput);
}

export function getReadingProgressHash(
  readingProgress: ReadingProgress
): string {
  return hashJson(readingProgress);
}

export function getBookContentHash(buffer: Buffer): string {
  return hashBuffer(buffer);
}

export async function findCachedUserProfile(
  userInputHash: string
): Promise<UserProfile | null> {
  const cached = await prisma.userProfileCache.findUnique({
    where: { userInputHash },
  });

  if (!cached) {
    return null;
  }

  return UserProfileSchema.parse(JSON.parse(cached.profileJson));
}

export async function saveUserProfileCache(params: {
  userInputHash: string;
  userInput: UserInput;
  userProfile: UserProfile;
}): Promise<void> {
  await prisma.userProfileCache.upsert({
    where: { userInputHash: params.userInputHash },
    create: {
      userInputHash: params.userInputHash,
      userInputJson: stableStringify(params.userInput),
      profileJson: stableStringify(params.userProfile),
    },
    update: {
      userInputJson: stableStringify(params.userInput),
      profileJson: stableStringify(params.userProfile),
    },
  });
}

export async function findCachedChapterAnalysis(params: {
  chapterHash: string;
  userProfileHash: string;
}): Promise<ChapterAnalysisResult | null> {
  const cached = await prisma.chapterAnalysisCache.findUnique({
    where: {
      chapterHash_userProfileHash: params,
    },
  });

  if (!cached) {
    return null;
  }

  return ChapterAnalysisResultSchema.parse(JSON.parse(cached.analysisJson));
}

export async function saveChapterAnalysisCache(params: {
  chapterHash: string;
  userProfileHash: string;
  analysisResult: ChapterAnalysisResult;
}): Promise<void> {
  await prisma.chapterAnalysisCache.upsert({
    where: {
      chapterHash_userProfileHash: {
        chapterHash: params.chapterHash,
        userProfileHash: params.userProfileHash,
      },
    },
    create: {
      chapterHash: params.chapterHash,
      userProfileHash: params.userProfileHash,
      analysisJson: stableStringify(params.analysisResult),
    },
    update: {
      analysisJson: stableStringify(params.analysisResult),
    },
  });
}

export async function findCachedNonSpoilerContext(params: {
  chapterHash: string;
  readingProgressHash: string;
}): Promise<NonSpoilerContextResult | null> {
  const cached = await prisma.nonSpoilerContextCache.findUnique({
    where: {
      chapterHash_readingProgressHash: params,
    },
  });

  if (!cached) {
    return null;
  }

  return NonSpoilerContextResultSchema.parse(JSON.parse(cached.contextJson));
}

export async function saveNonSpoilerContextCache(params: {
  chapterHash: string;
  readingProgressHash: string;
  nonSpoilerContext: NonSpoilerContextResult;
}): Promise<void> {
  await prisma.nonSpoilerContextCache.upsert({
    where: {
      chapterHash_readingProgressHash: {
        chapterHash: params.chapterHash,
        readingProgressHash: params.readingProgressHash,
      },
    },
    create: {
      chapterHash: params.chapterHash,
      readingProgressHash: params.readingProgressHash,
      contextJson: stableStringify(params.nonSpoilerContext),
    },
    update: {
      contextJson: stableStringify(params.nonSpoilerContext),
    },
  });
}

export async function saveReadingProgress(
  readingProgress: ReadingProgress
): Promise<string> {
  const readingProgressHash = getReadingProgressHash(readingProgress);

  await prisma.readingProgressRecord.upsert({
    where: { readingProgressHash },
    create: {
      readingProgressHash,
      bookTitle: readingProgress.bookTitle,
      currentChapterIndex: readingProgress.currentChapterIndex,
      currentChapterTitle: readingProgress.currentChapterTitle,
      safePreviousSummary: readingProgress.safePreviousSummary,
      progressJson: stableStringify(readingProgress),
    },
    update: {
      bookTitle: readingProgress.bookTitle,
      currentChapterIndex: readingProgress.currentChapterIndex,
      currentChapterTitle: readingProgress.currentChapterTitle,
      safePreviousSummary: readingProgress.safePreviousSummary,
      progressJson: stableStringify(readingProgress),
    },
  });

  return readingProgressHash;
}

export async function findCachedParsedBook(
  contentHash: string
): Promise<ParsedBook | null> {
  const book = await prisma.book.findUnique({
    where: { contentHash },
    include: {
      chapters: {
        orderBy: { index: "asc" },
      },
    },
  });

  if (!book) {
    return null;
  }

  return {
    title: book.title,
    author: book.author ?? undefined,
    sourceType: book.sourceType as ParsedBook["sourceType"],
    chapters: book.chapters.map((chapter) => ({
      id: chapter.sourceId,
      index: chapter.index,
      title: chapter.title,
      content: chapter.content,
      wordCount: chapter.wordCount,
      sourceHref: chapter.sourceHref ?? undefined,
    })),
    metadata: book.metadataJson
      ? (JSON.parse(book.metadataJson) as Record<string, unknown>)
      : undefined,
  };
}

export async function saveParsedBookCache(params: {
  contentHash: string;
  filename: string;
  book: ParsedBook;
}): Promise<void> {
  await prisma.book.upsert({
    where: { contentHash: params.contentHash },
    create: {
      contentHash: params.contentHash,
      filename: params.filename,
      title: params.book.title,
      author: params.book.author,
      sourceType: params.book.sourceType,
      metadataJson: params.book.metadata
        ? stableStringify(params.book.metadata)
        : undefined,
      chapters: {
        create: params.book.chapters.map((chapter) =>
          toChapterCreateInput(params.contentHash, chapter)
        ),
      },
    },
    update: {
      filename: params.filename,
      title: params.book.title,
      author: params.book.author,
      sourceType: params.book.sourceType,
      metadataJson: params.book.metadata
        ? stableStringify(params.book.metadata)
        : undefined,
      chapters: {
        deleteMany: {},
        create: params.book.chapters.map((chapter) =>
          toChapterCreateInput(params.contentHash, chapter)
        ),
      },
    },
  });
}

function toChapterCreateInput(bookHash: string, chapter: ParsedChapter) {
  return {
    chapterHash: hashJson({
      bookHash,
      index: chapter.index,
      title: chapter.title,
      content: chapter.content,
    }),
    sourceId: chapter.id,
    index: chapter.index,
    title: chapter.title,
    content: chapter.content,
    wordCount: chapter.wordCount,
    sourceHref: chapter.sourceHref,
  };
}
