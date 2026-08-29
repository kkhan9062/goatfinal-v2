import bcrypt from 'bcryptjs';

// Split out from lib/auth.ts (which imports 'server-only', a Next.js-specific
// guard that plain scripts run via tsx can't resolve) so scripts/create-admin.ts
// can hash a password without needing the whole Next.js server context.
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
