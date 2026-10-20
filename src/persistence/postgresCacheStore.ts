// src/persistence/postgresCacheStore.ts
//
// Postgres cache store (Supabase). Tables live in the `quiet_reader` schema,
// created by supabase/migrations. Works in Node and in Deno (Edge Functions).
//
// Postgres 缓存存储（Supabase）。表位于 `quiet_reader` schema，
// 由 supabase/migrations 创建。可在 Node 和 Deno（Edge Functions）中运行。

import postgres from "postgres";

import type { CacheStore, StoredChapter } from "./cacheStore";

export function createPostgresCacheStore(databaseUrl: string): CacheStore {
  const sql = postgres(databaseUrl, {
    // Supabase's transaction pooler does not support prepared statements.
    // Supabase 的事务模式连接池不支持 prepared statements。
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });

  return {
    async getStats() {
      const [row] = await sql<
        {
          user_profiles: number;
          books: number;
          chapters: number;
          chapter_analyses: number;
          non_spoiler_contexts: number;
          reading_progress_records: number;
        }[]
      >`
        select
          (select count(*)::int from quiet_reader.user_profile_cache) as user_profiles,
          (select count(*)::int from quiet_reader.book) as books,
          (select count(*)::int from quiet_reader.chapter) as chapters,
          (select count(*)::int from quiet_reader.chapter_analysis_cache) as chapter_analyses,
          (select count(*)::int from quiet_reader.non_spoiler_context_cache) as non_spoiler_contexts,
          (select count(*)::int from quiet_reader.reading_progress_record) as reading_progress_records
      `;

      return {
        userProfiles: row.user_profiles,
        books: row.books,
        chapters: row.chapters,
        chapterAnalyses: row.chapter_analyses,
        nonSpoilerContexts: row.non_spoiler_contexts,
        readingProgressRecords: row.reading_progress_records,
      };
    },

    async findUserProfileJson(userInputHash) {
      const rows = await sql<{ profile_json: string }[]>`
        select profile_json from quiet_reader.user_profile_cache
        where user_input_hash = ${userInputHash}
      `;
      return rows[0]?.profile_json ?? null;
    },

    async saveUserProfile(params) {
      await sql`
        insert into quiet_reader.user_profile_cache
          (user_input_hash, user_input_json, profile_json)
        values (${params.userInputHash}, ${params.userInputJson}, ${params.profileJson})
        on conflict (user_input_hash) do update set
          user_input_json = excluded.user_input_json,
          profile_json = excluded.profile_json,
          updated_at = now()
      `;
    },

    async findChapterAnalysisJson(params) {
      const rows = await sql<{ analysis_json: string }[]>`
        select analysis_json from quiet_reader.chapter_analysis_cache
        where chapter_hash = ${params.chapterHash}
          and user_profile_hash = ${params.userProfileHash}
      `;
      return rows[0]?.analysis_json ?? null;
    },

    async saveChapterAnalysis(params) {
      await sql`
        insert into quiet_reader.chapter_analysis_cache
          (chapter_hash, user_profile_hash, analysis_json)
        values (${params.chapterHash}, ${params.userProfileHash}, ${params.analysisJson})
        on conflict (chapter_hash, user_profile_hash) do update set
          analysis_json = excluded.analysis_json,
          updated_at = now()
      `;
    },

    async findNonSpoilerContextJson(params) {
      const rows = await sql<{ context_json: string }[]>`
        select context_json from quiet_reader.non_spoiler_context_cache
        where chapter_hash = ${params.chapterHash}
          and reading_progress_hash = ${params.readingProgressHash}
      `;
      return rows[0]?.context_json ?? null;
    },

    async saveNonSpoilerContext(params) {
      await sql`
        insert into quiet_reader.non_spoiler_context_cache
          (chapter_hash, reading_progress_hash, context_json)
        values (${params.chapterHash}, ${params.readingProgressHash}, ${params.contextJson})
        on conflict (chapter_hash, reading_progress_hash) do update set
          context_json = excluded.context_json,
          updated_at = now()
      `;
    },

    async saveReadingProgress(record) {
      await sql`
        insert into quiet_reader.reading_progress_record (
          reading_progress_hash, book_title, current_chapter_index,
          current_chapter_title, safe_previous_summary, progress_json
        ) values (
          ${record.readingProgressHash}, ${record.bookTitle},
          ${record.currentChapterIndex}, ${record.currentChapterTitle},
          ${record.safePreviousSummary ?? null}, ${record.progressJson}
        )
        on conflict (reading_progress_hash) do update set
          book_title = excluded.book_title,
          current_chapter_index = excluded.current_chapter_index,
          current_chapter_title = excluded.current_chapter_title,
          safe_previous_summary = excluded.safe_previous_summary,
          progress_json = excluded.progress_json,
          updated_at = now()
      `;
    },

    async findBook(contentHash) {
      const books = await sql<
        {
          content_hash: string;
          filename: string;
          title: string;
          author: string | null;
          source_type: string;
          metadata_json: string | null;
        }[]
      >`
        select content_hash, filename, title, author, source_type, metadata_json
        from quiet_reader.book
        where content_hash = ${contentHash}
      `;
      const book = books[0];

      if (!book) {
        return null;
      }

      const chapters = await sql<
        {
          chapter_hash: string;
          source_id: string;
          chapter_index: number;
          title: string;
          content: string;
          word_count: number;
          source_href: string | null;
        }[]
      >`
        select chapter_hash, source_id, chapter_index, title, content,
               word_count, source_href
        from quiet_reader.chapter
        where book_hash = ${contentHash}
        order by chapter_index asc
      `;

      return {
        contentHash: book.content_hash,
        filename: book.filename,
        title: book.title,
        author: book.author ?? undefined,
        sourceType: book.source_type,
        metadataJson: book.metadata_json ?? undefined,
        chapters: chapters.map(
          (chapter): StoredChapter => ({
            chapterHash: chapter.chapter_hash,
            sourceId: chapter.source_id,
            index: chapter.chapter_index,
            title: chapter.title,
            content: chapter.content,
            wordCount: chapter.word_count,
            sourceHref: chapter.source_href ?? undefined,
          })
        ),
      };
    },

    async saveBook(book) {
      await sql.begin(async (tx) => {
        await tx`
          insert into quiet_reader.book (
            content_hash, filename, title, author, source_type, metadata_json
          ) values (
            ${book.contentHash}, ${book.filename}, ${book.title},
            ${book.author ?? null}, ${book.sourceType}, ${book.metadataJson ?? null}
          )
          on conflict (content_hash) do update set
            filename = excluded.filename,
            title = excluded.title,
            author = excluded.author,
            source_type = excluded.source_type,
            metadata_json = excluded.metadata_json,
            updated_at = now()
        `;

        await tx`
          delete from quiet_reader.chapter where book_hash = ${book.contentHash}
        `;

        if (book.chapters.length === 0) {
          return;
        }

        const rows = book.chapters.map((chapter) => ({
          book_hash: book.contentHash,
          chapter_hash: chapter.chapterHash,
          source_id: chapter.sourceId,
          chapter_index: chapter.index,
          title: chapter.title,
          content: chapter.content,
          word_count: chapter.wordCount,
          source_href: chapter.sourceHref ?? null,
        }));

        await tx`insert into quiet_reader.chapter ${tx(rows)}`;
      });
    },
  };
}
