// src/llm/mockLLM.ts

import type { LLMMessage } from "./types";

/**
 * Mock LLM client for local workflow testing.
 * 本地测试用的模拟 LLM 客户端。
 *
 * It returns different JSON based on the system prompt.
 * 它会根据 system prompt 返回不同的 JSON。
 */
export const mockLLM = {
  async invoke(messages: LLMMessage[]) {
    const systemPrompt = messages.find((m) => m.role === "system")?.content ?? "";

    if (
      systemPrompt.includes(
        "You are UserProfilerAgent, a language profiling agent"
      )
    ) {
      return {
        content: JSON.stringify({
          estimatedVocabularySize: 6000,
          estimatedCEFR: "B1-B2",
          focusWordTypes: ["core verbs", "abstract verbs", "connectors"],
          commonErrorTypes: ["unknown_core_verb", "long_sentence_parsing"],
          confidence: 0.72,
        }),
      };
    }

    if (
      systemPrompt.includes(
        "You are Parser & Content Analyzer Agent for a second-language ebook reading companion system"
      )
    ) {
      return {
        content: JSON.stringify({
          coreObstacleWords: [
            {
              text: "reluctant",
              sentence:
                "He was reluctant to concede that the proposal had serious flaws.",
              meaningInContextZh: "不情愿的",
              whyItMatters: "它表达人物态度，会影响读者理解人物是否愿意承认问题。",
              wordType: "attitude adjective",
              severity: "medium",
              guessableFromContext: false,
            },
            {
              text: "concede",
              sentence:
                "He was reluctant to concede that the proposal had serious flaws.",
              meaningInContextZh: "承认，尤其是不情愿地承认",
              whyItMatters: "它是句子的核心动作，决定了人物是否承认提案存在问题。",
              wordType: "core verb",
              severity: "high",
              guessableFromContext: false,
            },
          ],
          skippedGuessableWords: [
            {
              text: "proposal",
              reason: "上下文足以判断它指某个计划或提案，不影响主干理解。",
            },
          ],
          filteringSummary:
            "根据用户容易卡在核心动词和抽象表达的画像，优先选择影响主干动作和人物态度的词。",
        }),
      };
    }

    if (
      systemPrompt.includes(
        "You are Non-Spoiler Context Agent for a second-language ebook reading companion system"
      )
    ) {
      return {
        content: JSON.stringify({
          nonSpoilerGuideZh:
            "本章可先关注人物之间的态度变化和场景规则，不需要急着理解所有细节。遇到专有名词时，先看它在当前情节中的功能。",
          contextItems: [
            {
              topic: "boarding school",
              category: "cultural_reference",
              explanationZh:
                "英国寄宿学校常见于成长小说中，学生长期住校，校园规则和师生关系会推动情节。",
              whyUsefulNow: "有助于理解学校场景为什么对人物生活影响很大。",
              spoilerSafetyConfidence: 0.95,
            },
          ],
          skippedPotentialSpoilers: [],
          timelineBoundaryNote:
            "仅基于当前章节、已读摘要和通用文化背景生成，不涉及后续剧情。",
        }),
      };
    }

    throw new Error("Mock LLM could not identify the agent prompt.");
  },
};
