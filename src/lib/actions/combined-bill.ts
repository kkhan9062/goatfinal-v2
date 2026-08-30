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

// maxDuration for this action lives in app/combined-bill/page.tsx, not here —
// a 'use server' file may only export async functions, so a route-segment
// config const like `export const maxDuration` can't live in this file (it
// silently breaks the whole module's exports under Turbopack).

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

// Bill.date is a Postgres @db.Date column — a bare calendar date with no
// time or timezone component. Prisma round-trips those as UTC-midnight Date
// objects (confirmed live: a bill saved for "2026-08-24" reads back as
// exactly 2026-08-24T00:00:00.000Z), so every date this file builds or reads
// must stay in UTC terms — matching lib/supplier-cashflow.ts's
// parseDateOnly/dateKey (the same bug class was found and fixed there
// first) and lib/balance.ts's own UTC-only arithmetic. Local-time methods
// (setHours, getDate, getFullYear) here only ever looked correct because
// Vercel's serverless functions default to UTC — on a server actually east
// of UTC (confirmed live on a local Asia/Calcutta dev machine), local
// midnight is an earlier UTC instant, which silently pulled the day before
// the requested range into every query. Caught by testing Combined Bill
// against a known-good v1 PDF: a retailer's displayed "Current Mandi Total"
// didn't match the sum of its own visible rows, because an extra day's
// bills had been pulled in underneath the visible date columns.
function dateKeyUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Parses a plain 'YYYY-MM-DD' date-input value as a UTC-midnight instant. */
function parseDateOnlyUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function endOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function dateRange(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (cur <= last) {
    keys.push(dateKeyUTC(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
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

  const start = parseDateOnlyUTC(startDateStr);
  const end = endOfDayUTC(parseDateOnlyUTC(endDateStr));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: 'Invalid date selected.' };
  }
  if (start >= end) {
    return { ok: false, error: 'End date must be after start date.' };
  }

  const [suppliers, allCustomers, lineItems] = await Promise.all([
    prisma.supplier.findMany({ where: { id: { in: supplierIds } } }),
    // v1 initializes retailerData for EVERY registered customer (CustomersAPI.getAll(),
    // never filtered by supplier — see generateCombinedBill in combined-bill-module.js),
    // then only filters down to active/owing ones at display time. Building the candidate
    // set only from this period's line items (as v2 originally did) silently dropped any
    // retailer who owes a carried-forward balance but didn't buy anything from these
    // suppliers this specific period — confirmed live: a real period showed 42 retailers
    // in v2 against v1's 100 for the identical date range, and every missing name was one
    // with zero deliveries this period but a real outstanding balance.
    prisma.customer.findMany({ select: { id: true, name: true } }),
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
    const dKey = dateKeyUTC(li.bill.date);
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

  // Full candidate set, not just Object.keys(byCustomer) — see the comment on
  // allCustomers above. A customer with no entries this period still needs a
  // resolved balance so a carried-forward debt shows up, even though their
  // dailyDeliveries bucket stays empty.
  const customerIds = allCustomers.map((c) => c.id);
  for (const c of allCustomers) {
    if (!namesByCustomer.has(c.id)) namesByCustomer.set(c.id, c.name);
  }

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
      const dailyDeliveries = byCustomer[custId] ?? {};
      const weeklyTotal = Object.values(dailyDeliveries).reduce(
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
        dailyDeliveries,
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
  const balanceDate = parseDateOnlyUTC(endDateStr);
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
