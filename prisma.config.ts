import { defineConfig } from "@prisma/config";
import * as path from "node:path";

const defaultDatabaseUrl = `file:${path.resolve("prisma/dev.db")}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
});
