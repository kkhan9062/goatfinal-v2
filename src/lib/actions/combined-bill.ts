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

export type CombinedBillDelivery = { quantity: number; rate: number; total: number };
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
    byCustomer[custId][dKey][rateKey] ??= { quantity: 0, rate, total: 0 };
    byCustomer[custId][dKey][rateKey].quantity += quantity;
    byCustomer[custId][dKey][rateKey].total = byCustomer[custId][dKey][rateKey].quantity * rate;
  }

  const customerIds = Object.keys(byCustomer);

  const payments = await prisma.payment.findMany({
    where: { customerId: { in: customerIds }, date: { gte: start, lte: end } },
  });
  const paymentsByCustomer = new Map<string, number>();
  for (const p of payments) {
    paymentsByCustomer.set(p.customerId, (paymentsByCustomer.get(p.customerId) ?? 0) + Number(p.amount));
  }

  const retailers: CombinedBillRetailer[] = [];
  const checkpoints: { customerId: string; balanceAmount: number }[] = [];

  for (const custId of customerIds) {
    const weeklyTotal = Object.values(byCustomer[custId]).reduce(
      (sum, dayBucket) => sum + Object.values(dayBucket).reduce((s, d) => s + d.total, 0),
      0
    );

    const resolved = await resolveRetailerBalance(prisma, custId, previousPeriodEnd);
    const previousBalance = resolved.balance;
    const paymentAmount = paymentsByCustomer.get(custId) ?? 0;
    const newBalance = Math.max(0, previousBalance - paymentAmount + weeklyTotal);
    const displayPreviousBalance = Math.max(0, previousBalance - paymentAmount);

    retailers.push({
      customerId: custId,
      name: namesByCustomer.get(custId) ?? 'Unknown',
      dailyDeliveries: byCustomer[custId],
      weeklyTotal,
      previousBalance,
      displayPreviousBalance,
      paymentAmount,
      newBalance,
    });

    const shouldPersist = weeklyTotal > 0 || previousBalance !== 0 || paymentAmount > 0;
    if (shouldPersist) {
      checkpoints.push({ customerId: custId, balanceAmount: newBalance });
    }
  }

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

  retailers.sort((a, b) => {
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
