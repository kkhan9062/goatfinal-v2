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

  // Every table with a foreign key to Customer must be checked here — an
  // uncaught FK violation on delete crashes the request instead of showing
  // a message (this was found live: RetailerBalance checkpoints, written by
  // Combined Bill generation, weren't checked and caused exactly that crash).
  const [billCount, paymentCount, balanceCount, pricingCount] = await Promise.all([
    prisma.billLineItem.count({ where: { customerId: id } }),
    prisma.payment.count({ where: { customerId: id } }),
    prisma.retailerBalance.count({ where: { customerId: id } }),
    prisma.pricingHistory.count({ where: { customerId: id } }),
  ]);
  if (billCount > 0 || paymentCount > 0 || balanceCount > 0 || pricingCount > 0) {
    const parts = [
      billCount > 0 ? `${billCount} bill entr${billCount === 1 ? 'y' : 'ies'}` : null,
      paymentCount > 0 ? `${paymentCount} payment(s)` : null,
      balanceCount > 0 ? `${balanceCount} saved balance checkpoint(s)` : null,
      pricingCount > 0 ? `${pricingCount} pricing history record(s)` : null,
    ].filter(Boolean);
    return {
      ok: false,
      error: `Cannot delete — this retailer has ${parts.join(', ')} on record. Historical financial data can't be deleted.`,
    };
  }

  await prisma.customer.delete({ where: { id } });
  revalidatePath('/customers');
  return { ok: true };
}
