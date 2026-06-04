import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { loadEnvFile } from "../config/env";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as new (filename: string) => {
  exec(sql: string): void;
  close(): void;
};

loadEnvFile();

const databaseUrl =
  process.env.DATABASE_URL ?? `file:${path.resolve("prisma/dev.db")}`;
const databasePath = databaseUrl.replace(/^file:/, "");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);

db.exec(`
CREATE TABLE IF NOT EXISTS "UserProfileCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userInputHash" TEXT NOT NULL,
  "userInputJson" TEXT NOT NULL,
  "profileJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Book" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contentHash" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "sourceType" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Chapter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookId" TEXT NOT NULL,
  "chapterHash" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "wordCount" INTEGER NOT NULL,
  "sourceHref" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Chapter_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ChapterAnalysisCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chapterHash" TEXT NOT NULL,
  "userProfileHash" TEXT NOT NULL,
  "analysisJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "NonSpoilerContextCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chapterHash" TEXT NOT NULL,
  "readingProgressHash" TEXT NOT NULL,
  "contextJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "ReadingProgressRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "readingProgressHash" TEXT NOT NULL,
  "bookTitle" TEXT NOT NULL,
  "currentChapterIndex" INTEGER NOT NULL,
  "currentChapterTitle" TEXT NOT NULL,
  "safePreviousSummary" TEXT,
  "progressJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS
  "UserProfileCache_userInputHash_key"
  ON "UserProfileCache"("userInputHash");

CREATE UNIQUE INDEX IF NOT EXISTS
  "Book_contentHash_key"
  ON "Book"("contentHash");

CREATE UNIQUE INDEX IF NOT EXISTS
  "Chapter_chapterHash_key"
  ON "Chapter"("chapterHash");

CREATE UNIQUE INDEX IF NOT EXISTS
  "Chapter_bookId_index_key"
  ON "Chapter"("bookId", "index");

CREATE UNIQUE INDEX IF NOT EXISTS
  "ChapterAnalysisCache_chapterHash_userProfileHash_key"
  ON "ChapterAnalysisCache"("chapterHash", "userProfileHash");

CREATE UNIQUE INDEX IF NOT EXISTS
  "NonSpoilerContextCache_chapterHash_readingProgressHash_key"
  ON "NonSpoilerContextCache"("chapterHash", "readingProgressHash");

CREATE UNIQUE INDEX IF NOT EXISTS
  "ReadingProgressRecord_readingProgressHash_key"
  ON "ReadingProgressRecord"("readingProgressHash");
`);

db.close();

console.log(`SQLite persistence schema is ready at ${databasePath}`);
