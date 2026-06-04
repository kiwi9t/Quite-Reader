export interface TestSentenceFeedback {
  sentence: string;
  userFeedback: string;
}

export interface UserInput {
  testScore: string;
  selfReportedDifficulties: string[];
  testSentenceFeedback: TestSentenceFeedback[];
}

export interface ChapterInput {
  title: string;
  content: string;
}

export interface ReadingProgress {
  bookTitle: string;
  currentChapterIndex: number;
  currentChapterTitle: string;
  safePreviousSummary?: string;
}

export interface ReadingPreloadRequest {
  userInput: UserInput;
  chapterInput: ChapterInput;
  readingProgress: ReadingProgress;
}

export interface ReadingPreloadViewModel {
  chapterHeader: {
    title: string;
    progressLabel: string;
    nonSpoilerPreview: string;
  };
  previewCards: {
    vocabulary: Array<{
      id: string;
      text: string;
      meaningInContextZh: string;
      wordType: string;
      severity: "low" | "medium" | "high";
      whyItMatters: string;
      sourceSentence: string;
    }>;
    context: Array<{
      id: string;
      topic: string;
      category: string;
      explanationZh: string;
      whyUsefulNow: string;
    }>;
  };
  inlineAnnotations: Array<{
    id: string;
    text: string;
    sentence: string;
    meaningInContextZh: string;
    severity: "low" | "medium" | "high";
  }>;
  safety: {
    timelineBoundaryNote: string;
    skippedPotentialSpoilers: Array<{
      topic: string;
      reason: string;
    }>;
  };
  debug?: unknown;
}
