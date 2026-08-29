'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/lib/actions/suppliers';

const lineItemSchema = z.object({
  organ: z.enum(['mundi', 'kaleji', 'paya', 'vajdi', 'gurda']),
  customerId: z.string().min(1),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  rate: z.coerce.number().nonnegative('Rate cannot be negative'),
  includesKaleji: z.boolean().default(false),
  includesVajdi: z.boolean().default(false),
});

const createBillSchema = z.object({
  supplierId: z.string().min(1, 'Select a supplier'),
  date: z.string().min(1, 'Date is required'),
  totalGoatsReceived: z.coerce.number().int().nonnegative(),
  lineItems: z.array(lineItemSchema).min(1, 'Add at least one distribution entry'),
});

export type CreateBillInput = z.input<typeof createBillSchema>;

// Bill numbers follow the same BILL-YYYYMM-NNNN pattern as v1, sequential
// within each calendar month, generated inside the same transaction as the
// insert (see createBill) so two simultaneous bill creations can't collide
// on the same number.
async function nextBillNumber(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `BILL-${year}${month}-`;

  const monthStart = new Date(year, date.getMonth(), 1);
  const monthEnd = new Date(year, date.getMonth() + 1, 1);

  const count = await tx.bill.count({
    where: { date: { gte: monthStart, lt: monthEnd } },
  });

  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function createBill(input: CreateBillInput): Promise<ActionResult & { billId?: string }> {
  await requireUser();

  const parsed = createBillSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { supplierId, date, totalGoatsReceived, lineItems } = parsed.data;
  const billDate = new Date(date);

  try {
    const bill = await prisma.$transaction(async (tx) => {
      const billNumber = await nextBillNumber(tx, billDate);
      const grandTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);

      return tx.bill.create({
        data: {
          billNumber,
          supplierId,
          date: billDate,
          totalGoatsReceived,
          grandTotal,
          lineItems: {
            create: lineItems.map((item) => ({
              customerId: item.customerId,
              organ: item.organ,
              quantity: item.quantity,
              rate: item.rate,
              total: item.quantity * item.rate,
              includesKaleji: item.includesKaleji,
              includesVajdi: item.includesVajdi,
            })),
          },
        },
      });
    });

    revalidatePath('/bills');
    return { ok: true, billId: bill.id };
  } catch (err) {
    console.error('createBill failed:', err);
    return { ok: false, error: 'Failed to save bill — please try again.' };
  }
}

export async function deleteBill(id: string): Promise<ActionResult> {
  await requireUser();
  // BillLineItems cascade-delete with the bill (onDelete: Cascade in schema)
  // — deleting a whole bill is a deliberate correction action, unlike
  // deleting a supplier/retailer which must be blocked if they have history.
  await prisma.bill.delete({ where: { id } });
  revalidatePath('/bills');
  redirect('/bills');
}
