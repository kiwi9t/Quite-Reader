# Quiet Reader

**Quiet Reader** is a pre-reading companion for second-language readers of English books.

**Quiet Reader** 是一个面向英文书籍外语阅读者的预习助手。

---

## The Problem / 痛点

Reading a novel in a second language is a constant stop-and-go: you follow the story, hit an unfamiliar word, reach for a dictionary, and lose the thread. Do it enough times and the experience becomes exhausting rather than enjoyable.

用外语读小说是一种持续的打断：你跟着情节走，撞上一个不认识的词，掏出词典查，等你找回状态，情绪和节奏早已断了。次数多了，阅读变成了一件苦差事。

**Quiet Reader solves this with a "pre-read" step.**

Before you open a chapter, Quiet Reader analyzes the text and prepares three things for you:

1. **Vocabulary cards** — only the words likely to block *your* comprehension, explained in context, not as dictionary entries.
2. **Spoiler-free background** — cultural, historical, and contextual knowledge you need for this chapter, without giving away anything that happens next.
3. **Personalized explanations** — adapted to your English level and the reading difficulties you struggle with most.

**Quiet Reader 用"预读"解决这个问题。**

在你打开章节前，Quiet Reader 分析文本并为你准备好三件事：

1. **词汇卡片** — 只筛选出真正可能阻碍*你*理解的词，用上下文解释，而不是词典释义。
2. **无剧透背景知识** — 帮助你读懂当前章节所需的文化、历史与语境知识，但绝不透露后续情节。
3. **个性化解释** — 根据你的英语水平和自述难点量身定制。

---

## How It Works: The Agent Architecture / 工作原理：Agent 架构

Quiet Reader runs a sequential three-agent workflow every time you request a chapter preview. Each agent has a single responsibility and passes its output to the next.

每次请求章节预览时，Quiet Reader 运行一个顺序三 Agent 工作流。每个 Agent 有单一职责，将输出传递给下一个。

```
START
  │
  ▼
[UserProfilerAgent]
  Converts your exam score and self-reported difficulties
  into a structured language profile (CEFR level, vocabulary size,
  weak word types, common error patterns).
  将你的考试成绩和自述难点转换为结构化语言画像
  （CEFR 等级、词汇量估计、薄弱词类、常见理解错误）。
  │
  ▼
[ParserAnalyzerAgent]
  Reads the chapter and your profile, then selects only the
  "core obstacle words" — words whose absence would break your
  understanding of that sentence. Guessable or decorative words
  are filtered out.
  读取章节与你的画像，仅筛选出"核心障碍词"——
  缺少这个词你就无法理解那句话的词。
  可以猜出来的词或装饰性词汇会被过滤掉。
  │
  ▼
[NonSpoilerContextAgent]
  Provides background context (cultural, historical, character
  relationships, setting) using strict timeline isolation — it
  knows the full book but is only allowed to use what exists
  up to your current chapter.
  提供背景知识（文化、历史、人物关系、世界观设定），
  遵守严格的时间线隔离规则——它知道全书内容，
  但只能使用截止到当前章节已存在的信息。
  │
  ▼
END → vocabulary cards + spoiler-free preview
       词汇卡片 + 无剧透预览
```

**State and caching.** All three agents share a typed workflow state. Each agent's output is cached to SQLite (keyed by a hash of the chapter content + user profile), so repeated requests for the same chapter return instantly.

**状态与缓存。** 三个 Agent 共享一个类型化工作流状态。每个 Agent 的输出都被缓存到 SQLite（以章节内容 + 用户画像的哈希为键），对同一章节的重复请求会即时返回。

**Spoiler detection.** NonSpoilerContextAgent's output is post-processed by a phrase-level spoiler risk detector before it reaches the user. If risky phrases are found, the output is rejected and the agent retries.

**剧透检测。** NonSpoilerContextAgent 的输出在到达用户前，会经过短语级剧透风险检测器的后处理。如果发现风险短语，输出会被拒绝，Agent 重试。

---

## Features / 功能

- Upload EPUB, TXT, and Markdown books; chapters are auto-split and cached
- Three-agent sequential workflow: user profiling → vocabulary filtering → spoiler-free context
- Per-user vocabulary cards adapted to your English level and self-reported difficulties
- Spoiler-safe background knowledge with strict timeline isolation and post-generation detection
- SQLite cache via Prisma — repeated requests for the same chapter are free
- Switchable LLM providers at runtime: mock (no key needed), OpenAI, Gemini, DeepSeek
- React/Vite bilingual frontend

---

## Tech Stack

- **Backend:** Node.js, TypeScript, native HTTP server
- **Frontend:** React, Vite, TypeScript
- **Database / cache:** SQLite with Prisma ORM
- **LLM providers:** mock, OpenAI, Gemini, DeepSeek
- **Book ingestion:** EPUB, TXT, Markdown parsing

---

## Project Structure

```
.
├── src/
│   ├── agents/             # UserProfilerAgent, ParserAnalyzerAgent, NonSpoilerContextAgent
│   ├── workflow/           # readingWorkflow.ts — orchestrates the three agents
│   ├── ingestion/          # EPUB / TXT / Markdown parsers and chapter splitter
│   ├── llm/                # LLM client abstraction (mock, OpenAI, Gemini, DeepSeek)
│   ├── persistence/        # SQLite cache repository via Prisma
│   ├── schemas/            # Zod schemas for structured LLM output
│   ├── http/               # Request handling, rate limiting, error types
│   └── server.ts           # HTTP server entry point
├── frontend/               # React/Vite frontend
├── prisma/                 # Prisma schema and SQLite database config
├── .env.example
├── package.json
└── frontend/package.json
```

---

## Getting Started

### 1. Install backend dependencies

```bash
npm install
```

### 2. Install frontend dependencies

```bash
cd frontend && npm install && cd ..
```

### 3. Create environment file

```bash
cp .env.example .env
```

For a local demo with no API key:

```env
LLM_PROVIDER=mock
PORT=3000
```

To use a real model, set `LLM_PROVIDER` to `openai`, `gemini`, or `deepseek` and add the matching key.

### 4. Initialize the database

```bash
npm run db:push
```

### 5. Start the backend

```bash
npm run server
# → http://localhost:3000
```

### 6. Start the frontend

```bash
cd frontend && npm run dev
# → http://localhost:5173
```

---

## Environment Variables

```env
LLM_PROVIDER=mock
DATABASE_URL="file:./prisma/dev.db"
PORT=3000

GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com

OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

`mock` is always available with no API key required.

---

## Scripts

**Backend:**

```bash
npm run db:push       # sync Prisma schema to SQLite
npm run db:generate   # regenerate Prisma client
npm run server        # start backend
npm run typecheck     # TypeScript check
```

**Frontend:**

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server status and available providers |
| `GET` | `/api/providers` | List configured LLM providers |
| `POST` | `/api/providers/active` | Switch active provider |
| `GET` | `/api/limits` | Upload / rate limits |
| `GET` | `/api/cache/stats` | Cache hit statistics |
| `POST` | `/api/book/upload?filename=<name>` | Upload and parse a book |
| `POST` | `/api/reading/preload?provider=<provider>` | Run the three-agent workflow and return vocabulary cards + preview |

---

## GitHub Notes

Do not commit `.env`, local databases, build output, or `node_modules` — they are in `.gitignore`.

Safe to commit: source code, `package.json`, `package-lock.json`, `.env.example`, Prisma schema, frontend source files.

---

## License

ISC
