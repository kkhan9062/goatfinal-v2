'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { resolveSupplierOpeningBalance, parseDateOnly, dateKey } from '@/lib/supplier-cashflow';
import type { ActionResult } from '@/lib/actions/suppliers';

export type CashFlowSummary = {
  transactions: {
    id: string;
    date: string;
    quantity: number | null;
    rate: number | null;
    amount: number;
    description: string | null;
  }[];
  deductions: {
    id: string;
    entryType: 'commission' | 'expense' | 'person_payment';
    date: string;
    quantity: number | null;
    rate: number | null;
    amount: number;
    description: string | null;
    personName: string | null;
  }[];
  openingBalanceOverrides: { id: string; date: string; amount: number; description: string | null }[];
  openingBalance: number;
  givenTotal: number;
  deductionsTotal: number;
  closingPayable: number;
};

export async function getCashFlowSummary(
  supplierId: string,
  from: string,
  to: string
): Promise<CashFlowSummary> {
  await requireUser();

  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);

  const [entries, overrides, openingBalance] = await Promise.all([
    prisma.supplierCashFlow.findMany({
      where: { supplierId, date: { gte: fromDate, lte: toDate } },
      orderBy: { date: 'asc' },
    }),
    prisma.supplierCashFlow.findMany({
      where: { supplierId, entryType: 'opening_balance' },
      orderBy: { date: 'asc' },
    }),
    resolveSupplierOpeningBalance(prisma, supplierId, from),
  ]);

  const transactions = entries
    .filter((e) => e.entryType === 'transaction')
    .map((e) => ({
      id: e.id,
      date: dateKey(e.date),
      quantity: e.quantity !== null ? Number(e.quantity) : null,
      rate: e.rate !== null ? Number(e.rate) : null,
      amount: Number(e.amount),
      description: e.description,
    }));

  const deductions = entries
    .filter((e): e is typeof e & { entryType: 'commission' | 'expense' | 'person_payment' } =>
      ['commission', 'expense', 'person_payment'].includes(e.entryType)
    )
    .map((e) => ({
      id: e.id,
      entryType: e.entryType,
      date: dateKey(e.date),
      quantity: e.quantity !== null ? Number(e.quantity) : null,
      rate: e.rate !== null ? Number(e.rate) : null,
      amount: Number(e.amount),
      description: e.description,
      personName: e.personName,
    }));

  const givenTotal = transactions.reduce((sum, e) => sum + e.amount, 0);
  const deductionsTotal = deductions.reduce((sum, e) => sum + e.amount, 0);
  const closingPayable = openingBalance + givenTotal - deductionsTotal;

  return {
    transactions,
    deductions,
    openingBalanceOverrides: overrides.map((o) => ({
      id: o.id,
      date: dateKey(o.date),
      amount: Number(o.amount),
      description: o.description,
    })),
    openingBalance,
    givenTotal,
    deductionsTotal,
    closingPayable,
  };
}

export type BillQuantityRow = { date: string; autoQty: number; alreadySaved: number; remaining: number };

export async function getBillQuantitySummary(
  supplierId: string,
  from: string,
  to: string
): Promise<BillQuantityRow[]> {
  await requireUser();

  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);

  const [bills, savedTransactions] = await Promise.all([
    prisma.bill.findMany({
      where: { supplierId, date: { gte: fromDate, lte: toDate } },
      select: { date: true, totalGoatsReceived: true },
    }),
    prisma.supplierCashFlow.findMany({
      where: { supplierId, entryType: 'transaction', date: { gte: fromDate, lte: toDate } },
      select: { date: true, quantity: true },
    }),
  ]);

  const autoByDate = new Map<string, number>();
  for (const b of bills) {
    const key = dateKey(b.date);
    autoByDate.set(key, (autoByDate.get(key) ?? 0) + b.totalGoatsReceived);
  }

  const savedByDate = new Map<string, number>();
  for (const t of savedTransactions) {
    const key = dateKey(t.date);
    savedByDate.set(key, (savedByDate.get(key) ?? 0) + Number(t.quantity ?? 0));
  }

  return [...autoByDate.entries()]
    .map(([date, autoQty]) => {
      const alreadySaved = savedByDate.get(date) ?? 0;
      return { date, autoQty, alreadySaved, remaining: Math.max(0, autoQty - alreadySaved) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

const entryTypeSchema = z.enum(['transaction', 'commission', 'expense', 'person_payment', 'opening_balance']);

const addEntrySchema = z.object({
  supplierId: z.string().min(1),
  entryType: entryTypeSchema,
  date: z.string().min(1),
  quantity: z.coerce.number().positive().optional(),
  rate: z.coerce.number().positive().optional(),
  amount: z.coerce.number(),
  description: z.string().trim().optional(),
  personName: z.string().trim().optional(),
});

export async function addCashFlowEntry(input: z.infer<typeof addEntrySchema>): Promise<ActionResult> {
  await requireUser();

  const parsed = addEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  if (data.entryType !== 'opening_balance' && data.amount <= 0) {
    return { ok: false, error: 'Amount must be greater than 0.' };
  }
  if (data.entryType === 'person_payment' && !data.personName) {
    return { ok: false, error: 'Person name is required.' };
  }

  await prisma.supplierCashFlow.create({
    data: {
      supplierId: data.supplierId,
      entryType: data.entryType,
      date: parseDateOnly(data.date),
      quantity: data.quantity ?? null,
      rate: data.rate ?? null,
      amount: data.amount,
      description: data.description || null,
      personName: data.personName || null,
    },
  });

  revalidatePath('/cash-flow');
  return { ok: true };
}

const bulkRowSchema = z.object({
  date: z.string().min(1),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().positive(),
  description: z.string().trim().optional(),
});

export async function addBillQuantityTransactions(
  supplierId: string,
  rows: z.infer<typeof bulkRowSchema>[]
): Promise<ActionResult & { saved?: number }> {
  await requireUser();

  const parsed = z.array(bulkRowSchema).safeParse(rows);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid rows.' };
  }
  if (parsed.data.length === 0) {
    return { ok: false, error: 'Nothing to save — fill in Qty and Rate for at least one row.' };
  }

  await prisma.supplierCashFlow.createMany({
    data: parsed.data.map((row) => ({
      supplierId,
      entryType: 'transaction' as const,
      date: parseDateOnly(row.date),
      quantity: row.quantity,
      rate: row.rate,
      amount: row.quantity * row.rate,
      description: row.description || 'From daily bill',
    })),
  });

  revalidatePath('/cash-flow');
  return { ok: true, saved: parsed.data.length };
}

export async function deleteCashFlowEntry(id: string): Promise<ActionResult> {
  await requireUser();
  await prisma.supplierCashFlow.delete({ where: { id } });
  revalidatePath('/cash-flow');
  return { ok: true };
}
