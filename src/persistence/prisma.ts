import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl } from "./databaseUrl";

const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
  // Free-tier Postgres (Supabase pooler) has a small connection limit.
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
});

export const prisma = new PrismaClient({ adapter });
