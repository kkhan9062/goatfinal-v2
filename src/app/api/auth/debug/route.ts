// TEMPORARY diagnostic route — reports whether DATABASE_URL is set (never its
// value) and whether a real query succeeds, to isolate a Vercel-only 500 that
// doesn't reproduce locally. DELETE THIS FILE once diagnosed.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ hasDatabaseUrl, queryOk: true, userCount: count });
  } catch (err) {
    return NextResponse.json({
      hasDatabaseUrl,
      queryOk: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}
