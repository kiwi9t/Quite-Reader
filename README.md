# Quiet Reader

Quiet Reader is a pre-reading assistant for people reading English books as a second language.

Upload an EPUB, TXT, or Markdown book, choose a chapter, and Quiet Reader prepares a short spoiler-safe preview before you read: vocabulary cards, useful background context, and explanations adapted to the reader's English level.

Quiet Reader 是一个面向英语二语读者的章节预习助手。上传书籍，选择章节，它会在你正式阅读前生成词汇卡片、无剧透背景知识和个性化解释。

---

## Why This Exists

Reading a novel in another language is often interrupted by dictionary lookups. One unknown word is fine; dozens of them break the rhythm.

Quiet Reader tries to move that friction before the reading session. Instead of explaining every difficult-looking word, it focuses on the words and context that are most likely to block comprehension in this specific chapter, for this specific reader.

---

## Features

- Upload and parse `.epub`, `.txt`, and `.md` books
- Auto-split books into chapters
- Generate personalized vocabulary cards from chapter context
- Provide spoiler-safe background knowledge for the current chapter
- Adapt explanations to the reader's level, test score, and self-reported difficulties
- Cache parsed books and agent outputs with SQLite + Prisma locally, or Supabase Postgres in the cloud
- Switch between `mock`, OpenAI, Gemini, and DeepSeek providers
- Readers can bring their own DeepSeek API key (stored only in their browser)
- Deploys to Railway (Node) or Supabase (Edge Function + Postgres)
- React/Vite frontend with a TypeScript Node API backend

---

## Demo Flow

1. Enter your English level or test score.
2. Upload a book file.
3. Select the chapter you are about to read.
4. Generate a pre-reading preview.
5. Read vocabulary cards and background context before opening the chapter.

The `mock` provider works without an API key, so you can try the full UI locally before connecting a real LLM.

---

## Architecture

Quiet Reader runs a sequential three-agent workflow:

```text
User input + chapter text
        |
        v
UserProfilerAgent
Builds a language profile from the reader's level and difficulties.
        |
        v
ParserAnalyzerAgent
Finds chapter-specific words that are likely to block comprehension.
        |
        v
NonSpoilerContextAgent
Generates helpful background context without revealing future plot.
        |
        v
Vocabulary cards + spoiler-safe preview
```

The backend stores reusable results in SQLite. Repeated requests for the same chapter and reader profile can return from cache instead of calling the LLM again.

---

## Tech Stack

- **Frontend:** React, Vite, TypeScript
- **Backend:** Node.js, TypeScript, native HTTP server
- **Database/cache:** SQLite, Prisma, `better-sqlite3` (local); Postgres via `postgres` (Supabase)
- **Validation:** Zod
- **LLM providers:** mock, OpenAI, Gemini, DeepSeek
- **Book ingestion:** EPUB, TXT, Markdown

---

## Project Structure

```text
.
├── src/
│   ├── agents/          # Three-agent reading workflow
│   ├── config/          # Environment loading
│   ├── http/            # Request parsing, errors, logging, rate limiting
│   ├── ingestion/       # EPUB/TXT/Markdown parsing
│   ├── llm/             # Provider clients and structured output helpers
│   ├── edge/            # Supabase Edge Function entry (Deno)
│   ├── persistence/     # Cache repository, SQLite (Prisma) and Postgres stores
│   ├── presenters/      # API response shaping
│   ├── schemas/         # Zod schemas
│   ├── workflow/        # Workflow orchestration
│   └── server.ts        # Node API entry point
├── frontend/            # React/Vite web app
├── prisma/              # Prisma schema (local SQLite)
├── supabase/            # Supabase config, Postgres migration, Edge Function
├── .env.example         # Local environment template
├── .env.cloud.example   # Cloud deployment environment template
├── railway.json         # Railway backend deployment config
└── package.json
```

---

## Local Development

### Requirements

- Node.js 20 or newer
- npm

### 1. Install dependencies

```bash
npm install
npm --prefix frontend install
```

### 2. Create local environment file

```bash
cp .env.example .env
```

For a no-key local demo:

```env
LLM_PROVIDER=mock
DATABASE_URL="file:./prisma/dev.db"
PORT=3000
```

To use a real provider, set `LLM_PROVIDER` to `openai`, `gemini`, or `deepseek`, then add the matching API key.

DeepSeek can also run without a server key: pick DeepSeek in the app and enter your own API key. See [Bring your own DeepSeek key](#bring-your-own-deepseek-key).

### 3. Initialize SQLite

```bash
npm run db:push
```

### 4. Start the backend

```bash
npm run server
```

The API runs at:

```text
http://localhost:3000
```

### 5. Start the frontend

In a second terminal:

```bash
npm --prefix frontend run dev
```

The app runs at:

```text
http://localhost:5173
```

---

## Environment Variables

### Backend

```env
LLM_PROVIDER=mock
DATABASE_URL="file:./prisma/dev.db"
PORT=3000
ALLOWED_ORIGIN=http://localhost:5173

MAX_JSON_BODY_BYTES=256000
MAX_UPLOAD_BYTES=20971520
RATE_LIMIT_MAX_REQUESTS=60
RATE_LIMIT_WINDOW_MS=60000
LLM_TIMEOUT_MS=45000
LLM_MAX_PROMPT_CHARS=90000
LLM_STRUCTURED_MAX_ATTEMPTS=3

OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5-mini

GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

### Frontend

```env
VITE_API_BASE_URL=http://localhost:3000
```

Only variables prefixed with `VITE_` are exposed to the frontend build.

---

## Scripts

### Backend

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Generate Prisma client and initialize SQLite tables
npm run server        # Start the API in development
npm run start         # Cloud start command: init DB, then start API
npm run typecheck     # Run TypeScript checks
```

### Frontend

```bash
npm --prefix frontend run dev       # Start Vite dev server
npm --prefix frontend run build     # Build production frontend
npm --prefix frontend run preview   # Preview production build locally
```

---

## API Overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Check API health and configured LLM providers |
| `GET` | `/api/providers` | List available LLM providers |
| `POST` | `/api/providers/active` | Change the default provider for the running server |
| `POST` | `/api/providers/deepseek/verify` | Check the reader's DeepSeek key (balance endpoint, no tokens used) |
| `GET` | `/api/limits` | Return upload, body, and rate limits |
| `GET` | `/api/cache/stats` | Return cache statistics |
| `POST` | `/api/book/upload?filename=<name>` | Upload and parse a book file |
| `POST` | `/api/reading/preload?provider=<provider>` | Generate vocabulary cards and spoiler-safe preview |

---

## Bring Your Own DeepSeek Key

Readers can use their own DeepSeek account instead of the server owner's:

1. Choose **DeepSeek** in the setup screen.
2. Paste a key from [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys), then **Save**. **Test key** checks it against DeepSeek's balance endpoint without spending tokens.
3. Generate a preview as usual.

How the key is handled:

- It is stored only in the reader's browser: `sessionStorage` by default (cleared when the tab closes), or `localStorage` if "remember on this device" is ticked.
- It is sent to the backend in the `X-DeepSeek-Api-Key` header with each preview request, used for that request's DeepSeek calls, and not logged, cached, or written to the database.
- A user key takes priority over `DEEPSEEK_API_KEY`. If the server has no key and the reader has not entered one, DeepSeek requests are rejected.
- Serve the frontend and backend over HTTPS in production so the key is encrypted in transit.

On a public deployment, leave `DEEPSEEK_API_KEY` unset so every reader pays with their own key.

Choosing a provider in the app is now per browser (sent as `?provider=` with each request); it no longer changes the server default for other readers.

---

## Deploy on Supabase

Supabase runs the backend as an Edge Function and stores the cache in Supabase Postgres. The frontend stays on Vercel.

```text
Vercel frontend  ->  Supabase Edge Function "quiet-reader"  ->  Supabase Postgres (schema quiet_reader)
```

The same API code runs in both places: `src/http/app.ts` is a standard fetch handler, `src/server.ts` serves it on Node, and `src/edge/supabaseFunction.ts` serves it on Deno. `npm run build:edge` bundles it into `supabase/functions/quiet-reader/bundle.js`.

### 1. Link the project

Create a project at [supabase.com](https://supabase.com), then from the repository root:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

The project ref is the `xxxx` in `https://xxxx.supabase.co`.

### 2. Create the tables

```bash
npx supabase db push
```

This applies `supabase/migrations/`. The tables live in a separate `quiet_reader` schema with row level security on and no policies, so the public Supabase REST API cannot read them; only the Edge Function can.

### 3. Set secrets

```bash
npx supabase secrets set LLM_PROVIDER=deepseek ALLOWED_ORIGIN=https://your-frontend-domain.vercel.app
```

Leave `DEEPSEEK_API_KEY` unset so readers use their own key. Any variable from `.env.cloud.example` works here except `DATABASE_URL` and `PORT`: Supabase gives the function `SUPABASE_DB_URL` automatically.

### 4. Deploy the function

```bash
npm install
npm run deploy:supabase
```

Check it:

```bash
curl https://<your-project-ref>.supabase.co/functions/v1/quiet-reader/health
```

### 5. Point the frontend at it

In Vercel, set:

```env
VITE_API_BASE_URL=https://<your-project-ref>.supabase.co/functions/v1/quiet-reader
```

and redeploy the frontend.

### Supabase limits to know

- Edge Functions get about 2 seconds of CPU time per request (waiting on the LLM does not count). Parsing a typical novel-length EPUB takes well under that, but very large files may fail; lower `MAX_UPLOAD_BYTES` if needed.
- Rate limiting and the active provider switch are kept in memory per function instance, so they are looser than on a single Node server.

### Running the Node server against Supabase Postgres

Set `DATABASE_URL` to your Supabase connection string (Project Settings → Database → Connection string, transaction pooler). Any `postgres://` URL makes `npm run start` use Postgres instead of SQLite.

---

## Quick Cloud Deploy (Railway)

The simplest deployment path is:

```text
Railway backend + persistent SQLite volume
Vercel frontend
```

### Backend on Railway

1. Create a Railway project from this GitHub repository.
2. Use the repository root as the service root.
3. Attach a Railway Volume mounted at `/data`.
4. Add environment variables from `.env.cloud.example`.
5. Set the SQLite database path:

```env
DATABASE_URL="file:/data/quiet-reader.db"
```

6. After the frontend is deployed, set:

```env
ALLOWED_ORIGIN=https://your-frontend-domain.vercel.app
```

Railway uses `railway.json` and starts the backend with:

```bash
npm run start
```

### Frontend on Vercel

1. Import this GitHub repository into Vercel.
2. Set the root directory to `frontend`.
3. Set:

```env
VITE_API_BASE_URL=https://your-backend-domain.up.railway.app
```

4. Deploy.

After both services are live, check:

```bash
curl https://your-backend-domain.up.railway.app/health
```

Then open the Vercel URL and upload a small `.txt` file to test the full flow.

---

## Data and Privacy Notes

Quiet Reader parses uploaded books on the backend and stores parsed book/chapter data plus cached agent outputs in SQLite. If you deploy this publicly, review your storage policy and only upload content you have the right to process.

On Supabase the same data goes to Supabase Postgres instead. For a production app with user accounts or long-term libraries, consider adding authentication.

---

## Development Notes

- Do not commit `.env`, local SQLite databases, `node_modules`, or build output.
- `.env.example` is for local development.
- `.env.cloud.example` is a deployment template; put real secrets in Railway/Vercel/Supabase dashboards, not in Git.
- The `mock` provider is useful for UI testing and demos without LLM cost.

---

## License

ISC
