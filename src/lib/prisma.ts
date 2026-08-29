import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// Neon's serverless driver adapter — required by Prisma 7 for edge/serverless
// runtimes like Vercel, and avoids the classic "too many connections" failure
// mode a traditional TCP connection pool hits under serverless (many short-lived
// function instances each opening their own connection). Uses HTTP/WebSocket
// under the hood instead of a persistent TCP connection per instance.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

// Reuse a single PrismaClient across hot-reloads in dev (Next.js dev server
// re-evaluates modules on every change; without this, each reload opens a new
// connection and old ones leak).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
