// src/agents/nonSpoilerContextAgent.ts

import type { ReadingAsstState, NonSpoilerContextResult } from "../state";
import type { MinimalLLMClient } from "../llm/types";
import { invokeWithStructuredOutput } from "../llm/structuredOutput";
import { NonSpoilerContextResultSchema } from "../schemas/readingSchemas";

/**
 * System instruction for Non-Spoiler Context Agent.
 * Non-Spoiler Context Agent 的系统级指令。
 *
 * The most important rule is timeline isolation.
 * 最重要的规则是时间线隔离。
 */
export const NON_SPOILER_CONTEXT_SYSTEM_PROMPT = `
You are Non-Spoiler Context Agent for a second-language ebook reading companion system.

Your job is to provide helpful background knowledge for the user's current reading position without revealing any future plot information.

You must obey strict TIMELINE ISOLATION.

Timeline Isolation Rules:

1. The user has only read up to the provided current chapter.
   Treat all later chapters, later character arcs, later deaths, later identities, later betrayals, later romances, later revelations, and later plot twists as forbidden knowledge.

2. Even if you know the full book, you must behave as if future chapters do not exist.

3. You may only use:
   - the current chapter title,
   - the current chapter content provided in the input,
   - the safe previous summary provided in the input,
   - general real-world cultural, historical, geographical, or linguistic background,
   - character relationships that are explicitly visible within the allowed timeline.

4. You must not mention, hint at, foreshadow, or indirectly imply future events.

5. Do not say things like:
   - "This will become important later"
   - "Readers will later discover"
   - "This foreshadows"
   - "Without spoiling too much"
   - "At this point, we do not yet know..."
   - "Later in the story"
   - "This character eventually..."
   - "This is secretly..."
   - "The real reason is..."

6. If a concept cannot be explained safely without future knowledge, skip it and list it in skippedPotentialSpoilers.

7. Character explanations must be limited to what the user can know at the current chapter.

8. Do not speculate about hidden motives, secret identities, future relationships, future deaths, or future plot outcomes.

9. Do not provide a full plot summary. Provide background knowledge only.

10. Keep the Chinese guide concise and useful for reading the current chapter.

Allowed background categories:
- historical_geographical: real-world history, geography, time period, social setting
- cultural_reference: cultural assumptions, school systems, customs, mythology, social norms
- idiom_or_expression: idioms, fixed expressions, culturally loaded phrases
- character_relationship: only relationships visible up to the current chapter
- setting_or_worldbuilding: places, institutions, objects, or rules already introduced
- literary_style: tone, genre convention, narration style, humor, irony
- other: only if necessary

Output requirements:
- Return strictly valid JSON only.
- Do not wrap the JSON in Markdown.
- Do not add comments.
- Write explanations in Chinese.
- Keep nonSpoilerGuideZh within 300 Chinese characters. Aim for 2-4 concise sentences.
- Prefer 3-7 contextItems.

The JSON object must match this shape:

{
  "nonSpoilerGuideZh": string,
  "contextItems": [
    {
      "topic": string,
      "category": "historical_geographical" | "cultural_reference" | "idiom_or_expression" | "character_relationship" | "setting_or_worldbuilding" | "literary_style" | "other",
      "explanationZh": string,
      "whyUsefulNow": string,
      "spoilerSafetyConfidence": number
    }
  ],
  "skippedPotentialSpoilers": [
    {
      "topic": string,
      "reason": string
    }
  ],
  "timelineBoundaryNote": string
}
`;

/**
 * Build the user message for Non-Spoiler Context Agent.
 * 构造发送给 Non-Spoiler Context Agent 的用户消息。
 */
export function buildNonSpoilerContextPrompt(state: ReadingAsstState): string {
  if (!state.userProfile) {
    throw new Error(
      "NonSpoilerContextAgent requires state.userProfile. Run UserProfilerAgent first."
    );
  }

  if (!state.chapterInput) {
    throw new Error(
      "NonSpoilerContextAgent requires state.chapterInput. Provide chapter content first."
    );
  }

  if (!state.readingProgress) {
    throw new Error(
      "NonSpoilerContextAgent requires state.readingProgress. Provide reading progress first."
    );
  }

  return `
Generate non-spoiler background context for this specific user.

STRICT TIMELINE BOUNDARY:
The user has read only up to:
Book: ${state.readingProgress.bookTitle}
Current chapter index: ${state.readingProgress.currentChapterIndex}
Current chapter title: ${state.readingProgress.currentChapterTitle}

You must not mention or imply anything beyond this point.

User language profile:
${JSON.stringify(state.userProfile, null, 2)}

Safe previous summary:
${state.readingProgress.safePreviousSummary ?? "No previous summary provided."}

Current chapter title:
${state.chapterInput.title}

Current chapter content:
${state.chapterInput.content}

Task:
Provide concise Chinese background knowledge that helps the user understand this chapter.
Do not summarize future plot.
Do not foreshadow.
Do not mention later events.
Do not explain secret identities, future deaths, future relationships, or future twists.

Return JSON only.
`;
}

/**
 * Spoiler-risk detector.
 * 剧透风险检测器。
 *
 * Uses precise multi-word phrases to avoid false positives on common words
 * like "later", "death", "eventually" that appear in normal background explanations.
 *
 * 使用精确的多词短语，避免对 "later"、"死亡"、"最终" 等常见词产生误报，
 * 这些词在正常背景知识解释中频繁出现。
 *
 * Rule: only flag phrases that are unambiguously about FUTURE plot events,
 * not general cultural/historical/thematic content.
 *
 * 规则：只标记明确指向未来剧情事件的短语，不标记通用背景/历史/主题内容。
 */
export function detectSpoilerRisk(text: string): string[] {
  const lower = text.toLowerCase();

  // ── English: require context words that clearly point to future plot ─────
  const englishPhrases = [
    "later in the story",
    "later in the book",
    "later in the novel",
    "later in the series",
    "later chapters",
    "in a later chapter",
    "will later become",
    "will later reveal",
    "will later turn out",
    "later turns out",
    "later reveals that",
    "we will discover",
    "readers will discover",
    "readers will later",
    "the reader will learn",
    "eventually we learn",
    "eventually reveals",
    "eventually dies",
    "eventually betrays",
    "foreshadow",
    "foreshadowing",
    "this hints at",
    "this hints toward",
    "true identity",
    "real reason is",
    "secret identity",
    "secretly is",
    "betrayal of",
  ];

  // ── Chinese: require phrases that unambiguously reference future plot ────
  // 后来 / 最终 / 死亡 / 揭示 alone are too common; require plot-specific suffix
  const chinesePhrases = [
    "后文揭示",
    "后文会",
    "后续章节会",
    "后续章节将",
    "后续章节揭示",
    "之后的章节",
    "在后来的故事",
    "后来会",
    "后来将",
    "将在后",
    "未来章节会",
    "未来章节将",
    "未来章节揭示",
    "真实身份",
    "真正原因是",
    "秘密身份",
    "伏笔",
    "剧透",
    "之后会",
    "背叛了",
    "背叛主角",
  ];

  const matched: string[] = [];

  for (const phrase of englishPhrases) {
    if (lower.includes(phrase)) matched.push(phrase);
  }

  for (const phrase of chinesePhrases) {
    if (text.includes(phrase)) matched.push(phrase);
  }

  return matched;
}

/**
 * Non-Spoiler Context Agent node.
 * Non-Spoiler Context Agent 节点。
 *
 * It reads:
 * 它读取：
 * - state.userProfile
 * - state.chapterInput
 * - state.readingProgress
 *
 * It writes:
 * 它写入：
 * - state.nonSpoilerContext
 */
export async function nonSpoilerContextAgentNode(
  state: ReadingAsstState,
  llm: MinimalLLMClient
): Promise<Partial<ReadingAsstState>> {
  const userPrompt = buildNonSpoilerContextPrompt(state);

  const nonSpoilerContext =
    await invokeWithStructuredOutput<NonSpoilerContextResult>({
      agentName: "NonSpoilerContextAgent",
      llm,
      systemPrompt: NON_SPOILER_CONTEXT_SYSTEM_PROMPT,
      userPrompt,
      schema: NonSpoilerContextResultSchema,
      validate: (value) => {
        const spoilerRisks = detectSpoilerRisk(getDisplayedContextText(value));

        return spoilerRisks.length > 0
          ? [
              `Potential spoiler risk detected: ${spoilerRisks.join(", ")}`,
            ]
          : [];
      },
    });

  return {
    nonSpoilerContext,
  };
}

function getDisplayedContextText(value: NonSpoilerContextResult): string {
  return [
    value.nonSpoilerGuideZh,
    value.timelineBoundaryNote,
    ...value.contextItems.flatMap((item) => [
      item.topic,
      item.explanationZh,
      item.whyUsefulNow,
    ]),
  ].join("\n");
}
