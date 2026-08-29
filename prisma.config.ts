import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Tells the Prisma CLI (db push, migrate, studio) how to reach the database.
// The running app itself gets its connection separately, via the Neon driver
// adapter in lib/prisma.ts — this file is only for CLI tooling.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
