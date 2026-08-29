'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  pattern: z.enum(['standard', 'aurangabad']).default('standard'),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createSupplier(formData: FormData): Promise<ActionResult> {
  await requireUser();

  const parsed = supplierSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address') || undefined,
    phone: formData.get('phone') || undefined,
    pattern: formData.get('pattern') || 'standard',
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await prisma.supplier.create({ data: parsed.data });
  revalidatePath('/suppliers');
  return { ok: true };
}

export async function updateSupplier(id: string, formData: FormData): Promise<ActionResult> {
  await requireUser();

  const parsed = supplierSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address') || undefined,
    phone: formData.get('phone') || undefined,
    pattern: formData.get('pattern') || 'standard',
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await prisma.supplier.update({ where: { id }, data: parsed.data });
  revalidatePath('/suppliers');
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  await requireUser();

  // Bills reference suppliers via a required relation (no onDelete: Cascade
  // configured for Bill -> Supplier deliberately — deleting a supplier that
  // has real bill history should fail loudly, not silently orphan/cascade
  // away financial records).
  const billCount = await prisma.bill.count({ where: { supplierId: id } });
  if (billCount > 0) {
    return {
      ok: false,
      error: `Cannot delete — this supplier has ${billCount} bill(s) on record. Historical financial data can't be deleted.`,
    };
  }

  await prisma.supplier.delete({ where: { id } });
  revalidatePath('/suppliers');
  return { ok: true };
}
