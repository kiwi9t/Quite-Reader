# Quiet Reader / Vocab Reader Agent

Quiet Reader is a spoiler-free reading assistant for language learners. Upload a book, choose a chapter, and the app generates a short pre-reading preview with useful vocabulary, safe context, and learner-aware explanations.

Quiet Reader 是一个面向外语阅读者的无剧透阅读助手。你可以上传书籍，选择章节，然后让系统在正式阅读前生成词汇预习、无剧透背景和个性化解释。

## Features

- Upload and parse EPUB, TXT, and Markdown books
- Split books into chapters and cache parsed content with SQLite/Prisma
- Generate spoiler-free pre-reading previews
- Adapt vocabulary explanations to the reader's level and self-reported difficulties
- Switch between supported LLM providers at runtime
- Run without API keys using the built-in mock provider
- React/Vite frontend with a bilingual Quiet Reader interface

## Tech Stack

- Backend: Node.js, TypeScript, native HTTP server
- Frontend: React, Vite, TypeScript
- Database/cache: SQLite with Prisma
- LLM providers: mock, OpenAI, Gemini, DeepSeek
- Book ingestion: EPUB, TXT, Markdown parsing

## Project Structure

```text
.
├── src/                    # Backend API, ingestion, agents, LLM clients
├── frontend/               # React/Vite frontend
├── prisma/                 # Prisma schema and local SQLite database config
├── .env.example            # Example environment variables
├── package.json            # Backend scripts and dependencies
└── frontend/package.json   # Frontend scripts and dependencies
```

## Getting Started

### 1. Install backend dependencies

```bash
npm install
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 3. Create environment file

Copy the example environment file:

```bash
cp .env.example .env
```

For a local demo, you can keep:

```env
LLM_PROVIDER=mock
PORT=3000
```

To use a real model, set `LLM_PROVIDER` to `openai`, `gemini`, or `deepseek`, then add the matching API key in `.env`.

### 4. Initialize the local database

```bash
npm run db:push
```

### 5. Start the backend

```bash
npm run server
```

The backend runs at:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

### 6. Start the frontend

Open a second terminal:

```bash
cd frontend
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173
```

Open that URL in your browser.

## Environment Variables

The project reads `.env` from the project root.

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
OPENAI_MODEL=gpt-5-mini
```

`mock` is always available and does not require an API key.

## Useful Scripts

Backend:

```bash
npm run db:generate
npm run db:push
npm run server
npm run typecheck
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

## API Overview

- `GET /health` checks server status and available LLM providers
- `GET /api/providers` lists configured providers
- `POST /api/providers/active` switches the active provider
- `GET /api/limits` returns upload/body/rate limits
- `GET /api/cache/stats` returns cache statistics
- `POST /api/book/upload?filename=<name>` uploads and parses a book
- `POST /api/reading/preload?provider=<provider>` generates the reading preview

## GitHub Notes

Do not commit `.env`, local databases, build output, or `node_modules`. They are already ignored in `.gitignore`.

Safe to commit:

- Source code
- `package.json` and `package-lock.json`
- `.env.example`
- Prisma schema
- Frontend source files

Ignored:

- `.env`
- `node_modules/`
- `frontend/node_modules/`
- `frontend/dist/`
- `prisma/dev.db`

## License

This project currently uses the `ISC` license from `package.json`.
