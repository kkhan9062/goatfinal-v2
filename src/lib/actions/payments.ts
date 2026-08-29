'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/lib/actions/suppliers';

const paymentSchema = z.object({
  customerId: z.string().min(1, 'Select a retailer'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  mode: z.enum(['Cash', 'UPI', 'Bank', 'Cheque', 'Other']).default('Cash'),
  notes: z.string().trim().optional(),
});

export async function createPayment(formData: FormData): Promise<ActionResult> {
  await requireUser();

  const parsed = paymentSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    date: formData.get('date'),
    mode: formData.get('mode') || 'Cash',
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { customerId, amount, date, mode, notes } = parsed.data;
  await prisma.payment.create({
    data: { customerId, amount, date: new Date(date), mode, notes },
  });

  revalidatePath('/payments');
  return { ok: true };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  await requireUser();
  await prisma.payment.delete({ where: { id } });
  revalidatePath('/payments');
  return { ok: true };
}
