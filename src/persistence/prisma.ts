import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import * as path from "node:path";
import { loadEnvFile } from "../config/env";

loadEnvFile();
process.env.DATABASE_URL ??= `file:${path.resolve("prisma/dev.db")}`;

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
