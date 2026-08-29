import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export { hashPassword, verifyPassword } from '@/lib/password';

const SESSION_COOKIE = 'session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches v1's api_keys expiry

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Creates a new session for a user and sets the httpOnly cookie. The raw token
// only ever exists in the cookie sent to the browser and in this one return
// value — the database only stores its SHA-256 hash, mirroring how v1's
// api_keys table worked, but delivered via a cookie instead of a header the
// client has to manage itself.
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Tied to actually running on Vercel (HTTPS), not NODE_ENV — `next start`
    // sets NODE_ENV=production even when serving plain http://localhost for
    // local testing, and a Secure cookie over HTTP is silently dropped by
    // every browser, making local production-build testing look like a
    // broken login with no visible error.
    secure: !!process.env.VERCEL,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

// Returns the logged-in user for the current request, or null. Used by both
// the middleware (route protection) and server components/route handlers that
// need to know "who is making this request."
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  return session.user;
}

// For server actions and pages that must not proceed without a real,
// validated session — the proxy/middleware only checks cookie presence
// (it can't reach Prisma from the Edge runtime), so every server action that
// mutates data calls this first as the actual authorization check.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}
