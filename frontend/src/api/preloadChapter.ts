import { requestJson } from "./client";
import type {
  ReadingPreloadRequest,
  ReadingPreloadViewModel,
} from "../types/readingPreload";

type LegacyReadingPreloadOutput = {
  nonSpoilerPreview: string;
  vocabularyCards: Array<{
    text: string;
    meaningInContextZh: string;
    sentence: string;
    wordType: string;
    severity: "low" | "medium" | "high";
    whyItMatters: string;
  }>;
  state: {
    chapterInput?: { title: string } | null;
    readingProgress?: {
      bookTitle: string;
      currentChapterIndex: number;
    } | null;
    nonSpoilerContext?: {
      contextItems?: Array<{
        topic: string;
        category: string;
        explanationZh: string;
        whyUsefulNow: string;
      }>;
      timelineBoundaryNote?: string;
      skippedPotentialSpoilers?: Array<{
        topic: string;
        reason: string;
      }>;
    } | null;
  };
};

export async function preloadChapter(
  payload: ReadingPreloadRequest,
  options: { cache?: boolean; provider?: string } = {}
): Promise<ReadingPreloadViewModel> {
  const qs = new URLSearchParams();
  if (options.cache === false) qs.set("cache", "false");
  if (options.provider) qs.set("provider", options.provider);
  const path = `/api/reading/preload${qs.toString() ? `?${qs.toString()}` : ""}`;

  devLog("preloadChapter start", {
    bookTitle: payload.readingProgress.bookTitle,
    chapterTitle: payload.chapterInput.title,
    chapterContentLength: payload.chapterInput.content.length,
  });

  const data = await requestJson<ReadingPreloadViewModel | LegacyReadingPreloadOutput>(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const viewModel = isReadingPreloadViewModel(data)
    ? data
    : adaptLegacyPreload(data, payload);

  devLog("preloadChapter success", {
    nonSpoilerPreviewLength:
      viewModel.chapterHeader.nonSpoilerPreview.length,
    vocabularyCount: viewModel.previewCards.vocabulary.length,
    contextCount: viewModel.previewCards.context.length,
    inlineAnnotationsCount: viewModel.inlineAnnotations.length,
  });

  return viewModel;
}

function isReadingPreloadViewModel(
  value: ReadingPreloadViewModel | LegacyReadingPreloadOutput
): value is ReadingPreloadViewModel {
  return "chapterHeader" in value && "previewCards" in value;
}

function adaptLegacyPreload(
  value: LegacyReadingPreloadOutput,
  payload: ReadingPreloadRequest
): ReadingPreloadViewModel {
  const contextItems = value.state.nonSpoilerContext?.contextItems ?? [];
  const progressLabel = `Chapter ${payload.readingProgress.currentChapterIndex} · ${payload.readingProgress.bookTitle}`;

  return {
    chapterHeader: {
      title: payload.chapterInput.title,
      progressLabel,
      nonSpoilerPreview: value.nonSpoilerPreview,
    },
    previewCards: {
      vocabulary: value.vocabularyCards.map((word, index) => ({
        id: makeId("vocab", word.text, index),
        text: word.text,
        meaningInContextZh: word.meaningInContextZh,
        wordType: word.wordType,
        severity: word.severity,
        whyItMatters: word.whyItMatters,
        sourceSentence: word.sentence,
      })),
      context: contextItems.map((item, index) => ({
        id: makeId("ctx", item.topic, index),
        topic: item.topic,
        category: item.category,
        explanationZh: item.explanationZh,
        whyUsefulNow: item.whyUsefulNow,
      })),
    },
    inlineAnnotations: value.vocabularyCards.map((word, index) => ({
      id: makeId("vocab", word.text, index),
      text: word.text,
      sentence: word.sentence,
      meaningInContextZh: word.meaningInContextZh,
      severity: word.severity,
    })),
    safety: {
      timelineBoundaryNote:
        value.state.nonSpoilerContext?.timelineBoundaryNote ??
        "Timeline boundary was applied by the backend.",
      skippedPotentialSpoilers:
        value.state.nonSpoilerContext?.skippedPotentialSpoilers ?? [],
    },
    debug: value.state,
  };
}

function makeId(prefix: string, text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${prefix}-${slug || "item"}-${index}`;
}

function devLog(message: string, data: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.log(`[api] ${message}`, data);
  }
}
