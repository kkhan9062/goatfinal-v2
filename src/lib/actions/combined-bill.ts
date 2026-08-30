'use server';

// ============================================================================
// Combined Bill — direct port of v1's generateCombinedBill() /
// autoSaveCombinedBalancesForNextMandi() (assets/js/modules/combined-bill-module.js).
//
// Business rules preserved exactly from v1:
// - Bills are grouped per retailer, then per date, then per rate (same rate on
//   the same date from multiple suppliers combines into one line).
// - "Previous Balance" is resolved via resolveRetailerBalance() as of the end
//   of the day BEFORE the current mandi cycle started (not simply
//   startDate - 1) — see getMandiCycleRange()/dayBefore() in lib/balance.ts.
// - New Balance = Previous Balance - Payments(in period) + Period Total,
//   clamped to a minimum of 0 (an overpayment is shown as 0, not negative).
// - The displayed "Previous Balance" row is (Previous Balance - Payments),
//   also clamped to 0, so the three displayed rows always add up.
// - Every generation auto-saves each retailer's new closing balance as a
//   dated checkpoint for the *next* period to read — upserted (never
//   duplicated), and only for retailers with actual activity this period.
// ============================================================================

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import {
  resolveRetailerBalance,
  saveRetailerBalanceCheckpoint,
  getMandiPeriod,
  getMandiCycleRange,
  dayBefore,
  type MandiPeriod,
} from '@/lib/balance';
import { getCombinedRetailerCustomOrderIndex } from '@/lib/combined-bill-order';

export type CombinedBillSource = {
  lineItemId: string;
  billId: string;
  billNumber: string;
  billDate: string;
  organ: string;
  quantity: number;
  rate: number;
  total: number;
};
export type CombinedBillDelivery = {
  quantity: number;
  rate: number;
  total: number;
  sources: CombinedBillSource[];
};
export type CombinedBillRetailer = {
  customerId: string;
  name: string;
  // dateKey (YYYY-MM-DD) -> rateKey (e.g. "200.00") -> delivery
  dailyDeliveries: Record<string, Record<string, CombinedBillDelivery>>;
  weeklyTotal: number;
  previousBalance: number;
  displayPreviousBalance: number;
  paymentAmount: number;
  newBalance: number;
};

export type CombinedBillResult = {
  retailers: CombinedBillRetailer[];
  dateColumns: string[];
  startDate: string;
  endDate: string;
  mandiPeriod: MandiPeriod;
  supplierNames: string[];
};

export type CombinedBillActionResult =
  | { ok: true; data: CombinedBillResult }
  | { ok: false; error: string };

function dateKeyLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function dateRange(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = startOfDay(start);
  const last = startOfDay(end);
  while (cur <= last) {
    keys.push(dateKeyLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

export async function generateCombinedBill(
  supplierIds: string[],
  startDateStr: string,
  endDateStr: string
): Promise<CombinedBillActionResult> {
  await requireUser();

  if (supplierIds.length === 0) {
    return { ok: false, error: 'Please select at least one supplier.' };
  }
  if (!startDateStr || !endDateStr) {
    return { ok: false, error: 'Please select start and end dates.' };
  }

  const start = startOfDay(new Date(startDateStr));
  const end = endOfDay(new Date(endDateStr));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: 'Invalid date selected.' };
  }
  if (start >= end) {
    return { ok: false, error: 'End date must be after start date.' };
  }

  const [suppliers, lineItems] = await Promise.all([
    prisma.supplier.findMany({ where: { id: { in: supplierIds } } }),
    prisma.billLineItem.findMany({
      where: { bill: { supplierId: { in: supplierIds }, date: { gte: start, lte: end } } },
      include: { bill: true, customer: true },
      orderBy: { bill: { date: 'asc' } },
    }),
  ]);

  if (lineItems.length === 0) {
    const names = suppliers.map((s) => s.name).join(', ');
    return {
      ok: false,
      error: `No bills found for selected suppliers (${names}) between ${startDateStr} and ${endDateStr}.`,
    };
  }

  const mandiPeriod = getMandiPeriod(start);
  const currentRange = getMandiCycleRange(start);
  const previousPeriodEnd = dayBefore(currentRange.start);

  // Group: customer -> date -> rate. Same rate on the same date from
  // different suppliers/bills combines into a single line, exactly as v1.
  type Bucket = Record<string, Record<string, Record<string, CombinedBillDelivery>>>;
  const byCustomer: Bucket = {};
  const namesByCustomer = new Map<string, string>();

  for (const li of lineItems) {
    const quantity = Number(li.quantity);
    const rate = Number(li.rate);
    if (quantity <= 0 || rate <= 0) continue;

    const custId = li.customerId;
    namesByCustomer.set(custId, li.customer.name);
    const dKey = dateKeyLocal(li.bill.date);
    const rateKey = rate.toFixed(2);

    byCustomer[custId] ??= {};
    byCustomer[custId][dKey] ??= {};
    byCustomer[custId][dKey][rateKey] ??= { quantity: 0, rate, total: 0, sources: [] };
    byCustomer[custId][dKey][rateKey].quantity += quantity;
    byCustomer[custId][dKey][rateKey].total = byCustomer[custId][dKey][rateKey].quantity * rate;
    byCustomer[custId][dKey][rateKey].sources.push({
      lineItemId: li.id,
      billId: li.billId,
      billNumber: li.bill.billNumber,
      billDate: dKey,
      organ: li.organ,
      quantity,
      rate,
      total: quantity * rate,
    });
  }

  const customerIds = Object.keys(byCustomer);

  const payments = await prisma.payment.findMany({
    where: { customerId: { in: customerIds }, date: { gte: start, lte: end } },
  });
  const paymentsByCustomer = new Map<string, number>();
  for (const p of payments) {
    paymentsByCustomer.set(p.customerId, (paymentsByCustomer.get(p.customerId) ?? 0) + Number(p.amount));
  }

  // Resolving each retailer's balance in sequence here was the actual cause
  // of "can't see all retailers" in production: with a real period's worth
  // of retailers (36, in the case that surfaced this), the sequential
  // `for` loop took 31.8 SECONDS end to end (measured live) — comfortably
  // past Vercel's default 10s serverless function timeout, so the request
  // simply failed with nothing rendered. Every retailer's balance is
  // independent of every other's, so resolving them concurrently is both
  // correct and the actual fix, not just an optimization.
  const perRetailer = await Promise.all(
    customerIds.map(async (custId) => {
      const weeklyTotal = Object.values(byCustomer[custId]).reduce(
        (sum, dayBucket) => sum + Object.values(dayBucket).reduce((s, d) => s + d.total, 0),
        0
      );

      const resolved = await resolveRetailerBalance(prisma, custId, previousPeriodEnd);
      const previousBalance = resolved.balance;
      const paymentAmount = paymentsByCustomer.get(custId) ?? 0;
      const newBalance = Math.max(0, previousBalance - paymentAmount + weeklyTotal);
      const displayPreviousBalance = Math.max(0, previousBalance - paymentAmount);

      const retailer: CombinedBillRetailer = {
        customerId: custId,
        name: namesByCustomer.get(custId) ?? 'Unknown',
        dailyDeliveries: byCustomer[custId],
        weeklyTotal,
        previousBalance,
        displayPreviousBalance,
        paymentAmount,
        newBalance,
      };

      const shouldPersist = weeklyTotal > 0 || previousBalance !== 0 || paymentAmount > 0;
      return { retailer, checkpoint: shouldPersist ? { customerId: custId, balanceAmount: newBalance } : null };
    })
  );

  const retailers: CombinedBillRetailer[] = perRetailer.map((r) => r.retailer);
  const checkpoints = perRetailer
    .map((r) => r.checkpoint)
    .filter((c): c is { customerId: string; balanceAmount: number } => c !== null);

  // Auto-save each retailer's closing balance for the next period to read —
  // upserted on (customerId, balanceDate), never duplicated.
  const balanceDate = new Date(endDateStr);
  await Promise.all(
    checkpoints.map(({ customerId, balanceAmount }) =>
      saveRetailerBalanceCheckpoint(prisma, {
        customerId,
        balanceDate,
        balanceAmount,
        mandiPeriod,
        notes: `Auto-saved from combined bill (Mandi: ${mandiPeriod})`,
      })
    )
  );

  // Fixed business-specific display order (v1's CUSTOM_COMBINED_RETAILER_ORDER)
  // takes priority; only retailers not in that list — new retailers added
  // since — fall through to sorting by balance, then billed amount, then name.
  retailers.sort((a, b) => {
    const orderA = getCombinedRetailerCustomOrderIndex(a.name);
    const orderB = getCombinedRetailerCustomOrderIndex(b.name);
    if (orderA !== orderB) return orderA - orderB;

    const byBalance = b.newBalance - a.newBalance;
    if (byBalance !== 0) return byBalance;
    const byBilled = b.weeklyTotal - a.weeklyTotal;
    if (byBilled !== 0) return byBilled;
    return a.name.localeCompare(b.name);
  });

  return {
    ok: true,
    data: {
      retailers,
      dateColumns: dateRange(start, end).slice(0, 14),
      startDate: startDateStr,
      endDate: endDateStr,
      mandiPeriod,
      supplierNames: suppliers.map((s) => s.name),
    },
  };
}

export type UpdateEntryResult = { ok: true } | { ok: false; error: string };

/**
 * Direct equivalent of v1's "Edit Entries" modal on a Combined Bill retailer
 * card (saveCombinedEntryEdit in combined-bill-module.js): correct a single
 * bill line item's quantity/rate, optionally reassigning it to a different
 * retailer if it was entered under the wrong person.
 *
 * Dramatically simpler than v1 here because the schema stores individual
 * BillLineItem rows instead of a JSON distribution blob — no need to parse,
 * locate, and re-serialize a bill's whole JSON to change one entry. Both the
 * line item update and the bill's recomputed grandTotal happen in one
 * transaction, so the bill total can never end up out of sync with its
 * lines even if this is interrupted mid-write.
 */
export async function updateCombinedBillEntry(
  lineItemId: string,
  quantity: number,
  rate: number,
  newCustomerId?: string
): Promise<UpdateEntryResult> {
  await requireUser();

  if (!(quantity > 0) || !(rate > 0)) {
    return { ok: false, error: 'Quantity and rate must both be greater than 0.' };
  }

  const lineItem = await prisma.billLineItem.findUnique({ where: { id: lineItemId } });
  if (!lineItem) {
    return { ok: false, error: 'This entry no longer exists — it may have been deleted.' };
  }

  if (newCustomerId) {
    const newCustomer = await prisma.customer.findUnique({ where: { id: newCustomerId } });
    if (!newCustomer) {
      return { ok: false, error: 'Selected retailer not found.' };
    }
  }

  const total = quantity * rate;

  await prisma.$transaction(async (tx) => {
    await tx.billLineItem.update({
      where: { id: lineItemId },
      data: {
        quantity,
        rate,
        total,
        ...(newCustomerId ? { customerId: newCustomerId } : {}),
      },
    });

    const allLineItems = await tx.billLineItem.findMany({
      where: { billId: lineItem.billId },
      select: { total: true },
    });
    const grandTotal = allLineItems.reduce((sum, li) => sum + Number(li.total), 0);
    await tx.bill.update({ where: { id: lineItem.billId }, data: { grandTotal } });
  });

  revalidatePath('/combined-bill');
  revalidatePath('/bills');
  revalidatePath('/ledger');
  return { ok: true };
}
