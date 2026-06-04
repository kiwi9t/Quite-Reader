import { z } from "zod";

const ConfidenceScoreSchema = z
  .number()
  .min(0)
  .max(100)
  .transform((value) => (value > 1 ? value / 100 : value));

export const MAX_CHAPTER_CONTENT_CHARS = 60_000;
export const MAX_SAFE_PREVIOUS_SUMMARY_CHARS = 8_000;
export const MAX_USER_FEEDBACK_CHARS = 2_000;

export const TestSentenceFeedbackInputSchema = z
  .object({
    sentence: z.string().trim().min(1).max(MAX_USER_FEEDBACK_CHARS),
    userFeedback: z.string().trim().min(1).max(MAX_USER_FEEDBACK_CHARS),
  })
  .strict();

export const UserInputSchema = z
  .object({
    testScore: z.string().trim().max(200),
    selfReportedDifficulties: z.array(z.string().trim().min(1).max(300)).max(20),
    testSentenceFeedback: z.array(TestSentenceFeedbackInputSchema).max(20),
  })
  .strict();

export const ChapterInputSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    content: z.string().trim().min(1).max(MAX_CHAPTER_CONTENT_CHARS),
  })
  .strict();

export const ReadingProgressSchema = z
  .object({
    bookTitle: z.string().trim().min(1).max(500),
    currentChapterIndex: z.number().int().positive().max(100_000),
    currentChapterTitle: z.string().trim().min(1).max(500),
    safePreviousSummary: z
      .string()
      .trim()
      .max(MAX_SAFE_PREVIOUS_SUMMARY_CHARS)
      .optional(),
  })
  .strict();

export const ReadingPreloadInputSchema = z
  .object({
    userInput: UserInputSchema,
    chapterInput: ChapterInputSchema,
    readingProgress: ReadingProgressSchema,
  })
  .strict();

export const UploadFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[^/\\\0]+$/, "Filename must not contain path separators.");

export const UserProfileSchema = z
  .object({
    estimatedVocabularySize: z.number().int().nonnegative(),
    estimatedCEFR: z.string().min(1),
    focusWordTypes: z.array(z.string().min(1)),
    commonErrorTypes: z.array(z.string().min(1)),
    confidence: ConfidenceScoreSchema,
  })
  .strict();

export const SeveritySchema = z.enum(["low", "medium", "high"]);

export const CoreObstacleWordSchema = z
  .object({
    text: z.string().min(1),
    sentence: z.string().min(1),
    meaningInContextZh: z.string().min(1),
    whyItMatters: z.string().min(1),
    wordType: z.string().min(1),
    severity: SeveritySchema,
    guessableFromContext: z.boolean(),
  })
  .strict();

export const ChapterAnalysisResultSchema = z
  .object({
    coreObstacleWords: z.array(CoreObstacleWordSchema),
    skippedGuessableWords: z.array(
      z
        .object({
          text: z.string().min(1),
          reason: z.string().min(1),
        })
        .strict()
    ),
    filteringSummary: z.string().min(1),
  })
  .strict();

export const NonSpoilerContextCategorySchema = z.enum([
  "historical_geographical",
  "cultural_reference",
  "idiom_or_expression",
  "character_relationship",
  "setting_or_worldbuilding",
  "literary_style",
  "other",
]);

export const NonSpoilerContextItemSchema = z
  .object({
    topic: z.string().min(1),
    category: NonSpoilerContextCategorySchema,
    explanationZh: z.string().min(1),
    whyUsefulNow: z.string().min(1),
    spoilerSafetyConfidence: ConfidenceScoreSchema,
  })
  .strict();

export const NonSpoilerContextResultSchema = z
  .object({
    // 500 chars gives Gemini enough room; the prompt still asks for concise output.
    // 200 was too tight — Gemini consistently exceeded it, burning all retries.
    nonSpoilerGuideZh: z.string().min(1).max(500),
    contextItems: z.array(NonSpoilerContextItemSchema),
    skippedPotentialSpoilers: z.array(
      z
        .object({
          topic: z.string().min(1),
          reason: z.string().min(1),
        })
        .strict()
    ),
    timelineBoundaryNote: z.string().min(1),
  })
  .strict();
