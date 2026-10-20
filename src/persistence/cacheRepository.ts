import type { Buffer } from "node:buffer";

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
import { getCacheStore, type CacheStats, type StoredChapter } from "./cacheStore";
import { hashBuffer, hashJson, stableStringify } from "./hash";

export type { CacheStats };

export async function getCacheStats(): Promise<CacheStats> {
  return getCacheStore().getStats();
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
  const profileJson = await getCacheStore().findUserProfileJson(userInputHash);

  if (!profileJson) {
    return null;
  }

  return UserProfileSchema.parse(JSON.parse(profileJson));
}

export async function saveUserProfileCache(params: {
  userInputHash: string;
  userInput: UserInput;
  userProfile: UserProfile;
}): Promise<void> {
  await getCacheStore().saveUserProfile({
    userInputHash: params.userInputHash,
    userInputJson: stableStringify(params.userInput),
    profileJson: stableStringify(params.userProfile),
  });
}

export async function findCachedChapterAnalysis(params: {
  chapterHash: string;
  userProfileHash: string;
}): Promise<ChapterAnalysisResult | null> {
  const analysisJson = await getCacheStore().findChapterAnalysisJson(params);

  if (!analysisJson) {
    return null;
  }

  return ChapterAnalysisResultSchema.parse(JSON.parse(analysisJson));
}

export async function saveChapterAnalysisCache(params: {
  chapterHash: string;
  userProfileHash: string;
  analysisResult: ChapterAnalysisResult;
}): Promise<void> {
  await getCacheStore().saveChapterAnalysis({
    chapterHash: params.chapterHash,
    userProfileHash: params.userProfileHash,
    analysisJson: stableStringify(params.analysisResult),
  });
}

export async function findCachedNonSpoilerContext(params: {
  chapterHash: string;
  readingProgressHash: string;
}): Promise<NonSpoilerContextResult | null> {
  const contextJson = await getCacheStore().findNonSpoilerContextJson(params);

  if (!contextJson) {
    return null;
  }

  return NonSpoilerContextResultSchema.parse(JSON.parse(contextJson));
}

export async function saveNonSpoilerContextCache(params: {
  chapterHash: string;
  readingProgressHash: string;
  nonSpoilerContext: NonSpoilerContextResult;
}): Promise<void> {
  await getCacheStore().saveNonSpoilerContext({
    chapterHash: params.chapterHash,
    readingProgressHash: params.readingProgressHash,
    contextJson: stableStringify(params.nonSpoilerContext),
  });
}

export async function saveReadingProgress(
  readingProgress: ReadingProgress
): Promise<string> {
  const readingProgressHash = getReadingProgressHash(readingProgress);

  await getCacheStore().saveReadingProgress({
    readingProgressHash,
    bookTitle: readingProgress.bookTitle,
    currentChapterIndex: readingProgress.currentChapterIndex,
    currentChapterTitle: readingProgress.currentChapterTitle,
    safePreviousSummary: readingProgress.safePreviousSummary,
    progressJson: stableStringify(readingProgress),
  });

  return readingProgressHash;
}

export async function findCachedParsedBook(
  contentHash: string
): Promise<ParsedBook | null> {
  const book = await getCacheStore().findBook(contentHash);

  if (!book) {
    return null;
  }

  return {
    title: book.title,
    author: book.author,
    sourceType: book.sourceType as ParsedBook["sourceType"],
    chapters: book.chapters.map((chapter) => ({
      id: chapter.sourceId,
      index: chapter.index,
      title: chapter.title,
      content: chapter.content,
      wordCount: chapter.wordCount,
      sourceHref: chapter.sourceHref,
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
  await getCacheStore().saveBook({
    contentHash: params.contentHash,
    filename: params.filename,
    title: params.book.title,
    author: params.book.author,
    sourceType: params.book.sourceType,
    metadataJson: params.book.metadata
      ? stableStringify(params.book.metadata)
      : undefined,
    chapters: params.book.chapters.map((chapter) =>
      toStoredChapter(params.contentHash, chapter)
    ),
  });
}

function toStoredChapter(bookHash: string, chapter: ParsedChapter): StoredChapter {
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
