// src/workflow/readingWorkflow.ts

import {
  initialReadingState,
  type ChapterInput,
  type ReadingAsstState,
  type ReadingProgress,
  type UserInput,
} from "../state";

import {
  userProfilerAgentNode,
} from "../agents/userProfilerAgent";

import {
  parserAnalyzerAgentNode,
} from "../agents/parserAnalyzerAgent";

import {
  nonSpoilerContextAgentNode,
} from "../agents/nonSpoilerContextAgent";
import type { MinimalLLMClient } from "../llm/types";
import {
  findCachedChapterAnalysis,
  findCachedNonSpoilerContext,
  findCachedUserProfile,
  getChapterHash,
  getUserInputHash,
  getUserProfileHash,
  saveChapterAnalysisCache,
  saveNonSpoilerContextCache,
  saveReadingProgress,
  saveUserProfileCache,
} from "../persistence/cacheRepository";

/**
 * Unified LLM client type used by all workflow nodes.
 * 所有工作流节点共用的 LLM 客户端类型。
 */
export type WorkflowLLMClient = MinimalLLMClient;

/**
 * Input payload for the reading preload workflow.
 * 阅读预加载工作流的输入。
 *
 * This is what the frontend sends before the user enters a chapter.
 * 这是前端在用户进入某章前发送给后端的数据。
 */
export interface ReadingPreloadInput {
  /**
   * Raw user input used for profiling.
   * 用于用户画像的原始输入。
   */
  userInput: UserInput;

  /**
   * Current chapter content.
   * 当前章节内容。
   */
  chapterInput: ChapterInput;

  /**
   * User's current reading progress.
   * 用户当前阅读进度。
   */
  readingProgress: ReadingProgress;
}

/**
 * API-friendly output for the frontend reading UX.
 * 面向前端阅读体验的 API 输出。
 */
export interface ReadingPreloadOutput {
  /**
   * Non-spoiler preview shown at the top of the chapter.
   * 章节顶部展示的无剧透前瞻。
   */
  nonSpoilerPreview: string;

  /**
   * Vocabulary cards shown before or during reading.
   * 阅读前或阅读中展示的核心词汇卡片。
   */
  vocabularyCards: Array<{
    text: string;
    meaningInContextZh: string;
    sentence: string;
    wordType: string;
    severity: "low" | "medium" | "high";
    whyItMatters: string;
  }>;

  /**
   * Full final workflow state, useful for debugging or future features.
   * 完整最终状态，便于调试或后续功能扩展。
   */
  state: ReadingAsstState;
}

/**
 * Merge a partial node update into the workflow state.
 * 将单个节点返回的局部更新合并进工作流状态。
 */
function mergeState(
  state: ReadingAsstState,
  patch: Partial<ReadingAsstState>
): ReadingAsstState {
  return {
    ...state,
    ...patch,
  };
}

/**
 * Build the initial state from API input.
 * 根据 API 输入构造初始状态。
 */
export function buildInitialWorkflowState(
  input: ReadingPreloadInput
): ReadingAsstState {
  return {
    ...initialReadingState,

    userInput: input.userInput,

    chapterInput: input.chapterInput,

    readingProgress: input.readingProgress,
  };
}

/**
 * Run the full reading preload workflow.
 * 执行完整的章节预加载工作流。
 *
 * Graph:
 * 图结构：
 *
 * START
 *   -> UserProfilerAgent
 *   -> ParserAnalyzerAgent + NonSpoilerContextAgent (in parallel)
 *   -> END
 */
export async function runReadingPreloadWorkflow(
  input: ReadingPreloadInput,
  llm: WorkflowLLMClient
): Promise<ReadingPreloadOutput> {
  let state = buildInitialWorkflowState(input);
  const userInputHash = getUserInputHash(input.userInput);
  const chapterHash = getChapterHash(input.chapterInput);

  /**
   * Edge 1:
   * START -> UserProfilerAgent
   *
   * 第 1 条边：
   * START -> 用户画像构建器
   */
  const cachedUserProfile = await findCachedUserProfile(userInputHash);
  const profilePatch = cachedUserProfile
    ? { userProfile: cachedUserProfile }
    : await userProfilerAgentNode(state, llm);
  state = mergeState(state, profilePatch);

  if (!state.userProfile) {
    throw new Error("Workflow finished without userProfile.");
  }

  if (!cachedUserProfile) {
    await saveUserProfileCache({
      userInputHash,
      userInput: input.userInput,
      userProfile: state.userProfile,
    });
  }

  const userProfileHash = getUserProfileHash(state.userProfile);

  /**
   * Edges 2 and 3 run in parallel:
   * UserProfilerAgent -> ParserAnalyzerAgent
   * UserProfilerAgent -> NonSpoilerContextAgent
   *
   * Both only need the user profile and the chapter, so there is no reason to
   * wait for the vocabulary analysis before asking for the background context.
   *
   * 第 2、3 条边并行执行：两个 Agent 都只依赖用户画像和章节内容，
   * 同时调用可以把等待时间从「两次 LLM 调用之和」缩短到「较慢的那一次」。
   */
  const profiledState = state;

  const analysisTask = (async () => {
    const cachedAnalysis = await findCachedChapterAnalysis({
      chapterHash,
      userProfileHash,
    });

    if (cachedAnalysis) {
      return cachedAnalysis;
    }

    const patch = await parserAnalyzerAgentNode(profiledState, llm);

    if (!patch.analysisResult) {
      throw new Error("Workflow finished without analysisResult.");
    }

    await saveChapterAnalysisCache({
      chapterHash,
      userProfileHash,
      analysisResult: patch.analysisResult,
    });

    return patch.analysisResult;
  })();

  const contextTask = (async () => {
    const readingProgressHash = await saveReadingProgress(input.readingProgress);
    const cachedContext = await findCachedNonSpoilerContext({
      chapterHash,
      readingProgressHash,
    });

    if (cachedContext) {
      return cachedContext;
    }

    const patch = await nonSpoilerContextAgentNode(profiledState, llm);

    if (!patch.nonSpoilerContext) {
      throw new Error("Workflow finished without nonSpoilerContext.");
    }

    await saveNonSpoilerContextCache({
      chapterHash,
      readingProgressHash,
      nonSpoilerContext: patch.nonSpoilerContext,
    });

    return patch.nonSpoilerContext;
  })();

  // Attach handlers to both before awaiting so a failure in one branch never
  // becomes an unhandled rejection while we wait on the other.
  const [analysisSettled, contextSettled] = await Promise.allSettled([
    analysisTask,
    contextTask,
  ]);

  if (analysisSettled.status === "rejected") {
    throw analysisSettled.reason;
  }

  if (contextSettled.status === "rejected") {
    throw contextSettled.reason;
  }

  const analysisResult = analysisSettled.value;
  const nonSpoilerContext = contextSettled.value;

  state = mergeState(state, {
    analysisResult,
    nonSpoilerContext,
  });

  return {
    nonSpoilerPreview: nonSpoilerContext.nonSpoilerGuideZh,

    vocabularyCards: analysisResult.coreObstacleWords.map((word) => ({
      text: word.text,
      meaningInContextZh: word.meaningInContextZh,
      sentence: word.sentence,
      wordType: word.wordType,
      severity: word.severity,
      whyItMatters: word.whyItMatters,
    })),

    state,
  };
}
