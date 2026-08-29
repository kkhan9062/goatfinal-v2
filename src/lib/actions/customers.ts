'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/lib/actions/suppliers';

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  await requireUser();

  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    address: formData.get('address') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await prisma.customer.create({ data: parsed.data });
  revalidatePath('/customers');
  return { ok: true };
}

export async function updateCustomer(id: string, formData: FormData): Promise<ActionResult> {
  await requireUser();

  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    address: formData.get('address') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await prisma.customer.update({ where: { id }, data: parsed.data });
  revalidatePath('/customers');
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  await requireUser();

  const [billCount, paymentCount] = await Promise.all([
    prisma.billLineItem.count({ where: { customerId: id } }),
    prisma.payment.count({ where: { customerId: id } }),
  ]);
  if (billCount > 0 || paymentCount > 0) {
    return {
      ok: false,
      error: `Cannot delete — this retailer has ${billCount} bill entr${billCount === 1 ? 'y' : 'ies'} and ${paymentCount} payment(s) on record. Historical financial data can't be deleted.`,
    };
  }

  await prisma.customer.delete({ where: { id } });
  revalidatePath('/customers');
  return { ok: true };
}
