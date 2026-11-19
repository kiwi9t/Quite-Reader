import { loadEnvFile } from "../config/env";

loadEnvFile();

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Use a Postgres connection string, e.g. the Supabase Session pooler URL " +
        "(postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres)."
    );
  }

  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      "DATABASE_URL must be a Postgres connection string (postgresql://...). SQLite file: URLs are no longer supported."
    );
  }

  return url;
}
