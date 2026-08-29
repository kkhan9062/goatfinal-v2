import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession } from '@/lib/auth';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });

  // Deliberately identical error for "no such user" and "wrong password" —
  // v1's login handler distinguished these ("User not found" vs "Invalid
  // password"), which tells an attacker which usernames exist on the system.
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  return NextResponse.json({ user: { id: user.id, username: user.username, email: user.email } });
}
