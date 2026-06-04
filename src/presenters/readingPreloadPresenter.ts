// src/presenters/readingPreloadPresenter.ts

import type { ReadingAsstState } from "../state";

/**
 * Frontend-friendly view model for the reading preload screen.
 * 面向前端阅读预加载页面的视图模型。
 */
export interface ReadingPreloadViewModel {
  /**
   * Chapter header section shown at the top of the reading screen.
   * 阅读页面顶部展示的章节头部信息。
   */
  chapterHeader: {
    /** Chapter title from chapterInput. 章节标题。 */
    title: string;
    /** Human-readable progress label, e.g. "Chapter 3 · The Hobbit". 阅读进度标签。 */
    progressLabel: string;
    /** Short non-spoiler preview paragraph. 简短的无剧透导读。 */
    nonSpoilerPreview: string;
  };

  /**
   * Pre-reading card panels shown before the user enters the chapter.
   * 用户进入章节前展示的预读卡片面板。
   */
  previewCards: {
    /**
     * Core obstacle vocabulary cards.
     * 核心障碍词汇卡片。
     */
    vocabulary: Array<{
      /** Stable id for React key / bookmarking. 稳定的唯一标识。 */
      id: string;
      /** The original word or phrase. 原词或短语。 */
      text: string;
      /** Context-specific meaning in Chinese. 结合上下文的中文释义。 */
      meaningInContextZh: string;
      /** Word type (noun, verb, idiom, etc.). 词汇类型。 */
      wordType: string;
      /** How much this word blocks comprehension. 对阅读的阻碍程度。 */
      severity: "low" | "medium" | "high";
      /** Why this word matters for the sentence or paragraph. 为什么影响理解。 */
      whyItMatters: string;
      /** Original sentence the word appeared in. 原文所在句子。 */
      sourceSentence: string;
    }>;

    /**
     * Safe background context cards.
     * 安全背景知识卡片。
     */
    context: Array<{
      /** Stable id for React key. 稳定的唯一标识。 */
      id: string;
      /** The concept, person, place, or expression. 概念、地点、物品或表达。 */
      topic: string;
      /** Category of the background item. 背景知识分类。 */
      category: string;
      /** Non-spoiler explanation in Chinese. 中文无剧透解释。 */
      explanationZh: string;
      /** Why this context is useful for the current chapter. 为什么对理解本章有帮助。 */
      whyUsefulNow: string;
    }>;
  };

  /**
   * Inline annotation data for the reading view.
   * Keyed by word text — used to power hover/tap glossary tooltips.
   * 行内注释数据，用于阅读视图中的悬浮/点击词汇提示。
   */
  inlineAnnotations: Array<{
    /** Stable id. 稳定的唯一标识。 */
    id: string;
    /** The word or phrase to highlight. 需要高亮的词或短语。 */
    text: string;
    /** The sentence it appears in, for tooltip context. 所在句子，用于提示语境。 */
    sentence: string;
    /** Chinese meaning for the tooltip. 提示框中展示的中文释义。 */
    meaningInContextZh: string;
    /** Drives highlight color in the reader. 驱动阅读器中的高亮颜色。 */
    severity: "low" | "medium" | "high";
  }>;

  /**
   * Spoiler-safety metadata shown to the user for transparency.
   * 向用户展示的防剧透安全说明。
   */
  safety: {
    /** Note describing the timeline boundary applied. 说明本次使用的时间线边界。 */
    timelineBoundaryNote: string;
    /** Topics intentionally omitted because they risk spoilers. 因风险被有意省略的话题。 */
    skippedPotentialSpoilers: Array<{
      topic: string;
      reason: string;
    }>;
  };

  /**
   * Full workflow state, included only when debug mode is on.
   * 仅在调试模式下包含的完整工作流状态。
   */
  debug?: {
    state: ReadingAsstState;
  };
}

/**
 * Derive a stable, URL-safe id from a word's text and its position in the list.
 * 根据词文本和位置生成稳定的 URL 安全 id。
 */
function makeVocabId(text: string, index: number): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `vocab-${slug}-${index}`;
}

function makeContextId(topic: string, index: number): string {
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `ctx-${slug}-${index}`;
}

/**
 * Transform the final workflow state into a frontend-friendly view model.
 * 将最终工作流状态转换为面向前端的视图模型。
 *
 * Throws if required state fields are missing (agents did not run).
 * 如果必要字段缺失（Agent 未执行），则抛出错误。
 *
 * @param state   Final ReadingAsstState after all agents have run.
 * @param debug   When true, attaches the raw state to `viewModel.debug`.
 */
export function presentReadingPreload(
  state: ReadingAsstState,
  debug = false
): ReadingPreloadViewModel {
  const { chapterInput, readingProgress, analysisResult, nonSpoilerContext } = state;

  if (!chapterInput) {
    throw new Error("presentReadingPreload: chapterInput is missing from state.");
  }
  if (!readingProgress) {
    throw new Error("presentReadingPreload: readingProgress is missing from state.");
  }
  if (!analysisResult) {
    throw new Error("presentReadingPreload: analysisResult is missing from state.");
  }
  if (!nonSpoilerContext) {
    throw new Error("presentReadingPreload: nonSpoilerContext is missing from state.");
  }

  // ── chapterHeader ──────────────────────────────────────────────
  const progressLabel =
    `Chapter ${readingProgress.currentChapterIndex} · ${readingProgress.bookTitle}`;

  // ── vocabulary cards ──────────────────────────────────────────
  const vocabulary = analysisResult.coreObstacleWords.map((word, i) => ({
    id: makeVocabId(word.text, i),
    text: word.text,
    meaningInContextZh: word.meaningInContextZh,
    wordType: word.wordType,
    severity: word.severity,
    whyItMatters: word.whyItMatters,
    sourceSentence: word.sentence,
  }));

  // ── context cards ─────────────────────────────────────────────
  const context = nonSpoilerContext.contextItems.map((item, i) => ({
    id: makeContextId(item.topic, i),
    topic: item.topic,
    category: item.category,
    explanationZh: item.explanationZh,
    whyUsefulNow: item.whyUsefulNow,
  }));

  // ── inline annotations (mirrors vocabulary, subset useful for reader view) ─
  const inlineAnnotations = analysisResult.coreObstacleWords.map((word, i) => ({
    id: makeVocabId(word.text, i),
    text: word.text,
    sentence: word.sentence,
    meaningInContextZh: word.meaningInContextZh,
    severity: word.severity,
  }));

  // ── assemble ──────────────────────────────────────────────────
  const viewModel: ReadingPreloadViewModel = {
    chapterHeader: {
      title: chapterInput.title,
      progressLabel,
      nonSpoilerPreview: nonSpoilerContext.nonSpoilerGuideZh,
    },
    previewCards: {
      vocabulary,
      context,
    },
    inlineAnnotations,
    safety: {
      timelineBoundaryNote: nonSpoilerContext.timelineBoundaryNote,
      skippedPotentialSpoilers: nonSpoilerContext.skippedPotentialSpoilers,
    },
  };

  if (debug) {
    viewModel.debug = { state };
  }

  return viewModel;
}
