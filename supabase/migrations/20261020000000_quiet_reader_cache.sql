-- Quiet Reader cache tables (parsed books + agent outputs).
-- Mirrors prisma/schema.prisma, which stays the SQLite schema for local dev.
--
-- Applied automatically by `npm run db:push` (part of `npm run start`) when
-- DATABASE_URL is a postgres:// URL. Safe to re-run.
--
-- The tables live in their own schema, which Supabase does not expose through
-- its REST API. RLS is enabled with no policies as a second lock: only the
-- backend, connecting as the database owner, can read or write them.
--
-- 当 DATABASE_URL 是 postgres:// 时，`npm run db:push`（`npm run start` 的一部分）会自动执行本文件，可重复执行。
-- 表放在独立 schema 中，Supabase 默认不会通过 REST API 暴露它。
-- 同时开启 RLS 且不加任何 policy：只有以数据库 owner 身份连接的后端能读写。

create schema if not exists quiet_reader;

create table if not exists quiet_reader.user_profile_cache (
  user_input_hash text primary key,
  user_input_json text not null,
  profile_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quiet_reader.book (
  content_hash text primary key,
  filename text not null,
  title text not null,
  author text,
  source_type text not null,
  metadata_json text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quiet_reader.chapter (
  book_hash text not null references quiet_reader.book (content_hash) on delete cascade,
  chapter_index integer not null,
  chapter_hash text not null unique,
  source_id text not null,
  title text not null,
  content text not null,
  word_count integer not null,
  source_href text,
  created_at timestamptz not null default now(),
  primary key (book_hash, chapter_index)
);

create table if not exists quiet_reader.chapter_analysis_cache (
  chapter_hash text not null,
  user_profile_hash text not null,
  analysis_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (chapter_hash, user_profile_hash)
);

create table if not exists quiet_reader.non_spoiler_context_cache (
  chapter_hash text not null,
  reading_progress_hash text not null,
  context_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (chapter_hash, reading_progress_hash)
);

create table if not exists quiet_reader.reading_progress_record (
  reading_progress_hash text primary key,
  book_title text not null,
  current_chapter_index integer not null,
  current_chapter_title text not null,
  safe_previous_summary text,
  progress_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quiet_reader.user_profile_cache enable row level security;
alter table quiet_reader.book enable row level security;
alter table quiet_reader.chapter enable row level security;
alter table quiet_reader.chapter_analysis_cache enable row level security;
alter table quiet_reader.non_spoiler_context_cache enable row level security;
alter table quiet_reader.reading_progress_record enable row level security;

-- Supabase's API roles; skipped on a plain Postgres that has no such roles.
-- Supabase 的 API 角色；普通 Postgres 没有这些角色时跳过。
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema quiet_reader from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on schema quiet_reader from authenticated;
  end if;
end
$$;
