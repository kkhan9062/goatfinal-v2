'use server';

// Direct port of v1's change_password action (api/handlers/auth.php) — the
// fix added this session for create_user.php, an unauthenticated endpoint
// that let anyone reset the admin account to a hardcoded password. Same
// re-auth-to-change-password shape: requires a valid session (requireUser)
// AND the current password, not just the session.

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, hashPassword, verifyPassword } from '@/lib/auth';
import type { ActionResult } from '@/lib/actions/suppliers';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  });

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Re-fetch the user's current hash — requireUser()'s session-derived user
  // is enough for identity, but the password check must be against a fresh
  // read, not a value that could be stale within a long-lived request.
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    return { ok: false, error: 'Account not found.' };
  }

  const validCurrent = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
  if (!validCurrent) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  return { ok: true };
}
