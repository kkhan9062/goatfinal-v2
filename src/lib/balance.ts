import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Single source of truth for "what does this retailer owe as of a given date."
//
// This is the direct TypeScript port of resolveRetailerBalanceAsOf() from the
// v1 PHP/JS rebuild — the function that replaced a ~460-line tangle of
// overlapping fallback layers (cached balance / exact-date snapshot / manual
// override / derived carry-forward / same-period regeneration reversal) that
// had caused most of the real bugs reported this session (wrong previous
// balance, duplicated data, silent staleness).
//
// Design, carried over deliberately:
// - RetailerBalance rows (the dated checkpoint table) are the ONLY source of
//   truth for "was a balance manually corrected or period-closed at this
//   date" — there is no second, independently-drifting scalar field on the
//   Customer model to disagree with it (v1 had one; this schema doesn't).
// - When no checkpoint exists at all yet, the balance is derived by summing
//   the retailer's ENTIRE bill/payment history from zero — this is a
//   complete, provably-correct calculation, not a guess, because bills and
//   payments are always fetched as full history (never date-filtered) by
//   whatever calls this. A result of exactly ₹0 is just as valid an outcome
//   as any other.
// - Kept as pure as practical (no framework imports, no request context) so
//   it can be unit tested directly — see balance.test.ts.
// ============================================================================

export type MandiPeriod = 'tuesday_friday' | 'saturday_monday';

export type ResolvedBalance = {
  balance: number;
  checkpointDate: Date | null;
  isExactMatch: boolean;
};

type PrismaLike = Pick<PrismaClient, 'retailerBalance' | 'billLineItem' | 'payment'>;

// Every date this file compares against (Bill.date, Payment.date,
// RetailerBalance.balanceDate) is a Postgres @db.Date column — a bare
// calendar date with NO time or timezone component. Prisma round-trips
// those as UTC-midnight JS Date objects (confirmed live: a bill saved for
// "2026-08-24" reads back as exactly 2026-08-24T00:00:00.000Z), so every
// date this module builds or mutates must stay in UTC terms, matching
// lib/supplier-cashflow.ts's parseDateOnly/dateKey (the same bug class was
// found and fixed there first). Using local-time methods (setHours,
// getDay, setDate) here only happened to look correct because Vercel's
// serverless functions default to UTC — on a server actually running east
// of UTC (confirmed live on a local Asia/Calcutta dev machine), local
// midnight is an earlier UTC instant, which silently pulled the day
// before into every date-range query. Caught by testing Combined Bill
// against a known-good v1 PDF and finding one retailer's displayed
// "Current Mandi Total" didn't match the sum of its own visible rows.
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Resolves a retailer's balance as of the end of `asOfDate`.
 *
 * Finds the most recent RetailerBalance checkpoint on or before `asOfDate`
 * (or zero, if none exists yet), then adds every bill line-item total and
 * subtracts every payment strictly after that checkpoint up to and including
 * `asOfDate`.
 */
export async function resolveRetailerBalance(
  db: PrismaLike,
  customerId: string,
  asOfDate: Date
): Promise<ResolvedBalance> {
  const asOfEnd = endOfDay(asOfDate);

  const checkpoint = await db.retailerBalance.findFirst({
    where: { customerId, balanceDate: { lte: asOfEnd } },
    orderBy: { balanceDate: 'desc' },
  });

  const checkpointDate = checkpoint ? checkpoint.balanceDate : null;
  const checkpointEnd = checkpointDate ? endOfDay(checkpointDate) : null;
  let runningBalance = checkpoint ? Number(checkpoint.balanceAmount) : 0;

  const [billTotal, paymentTotal] = await Promise.all([
    db.billLineItem.aggregate({
      _sum: { total: true },
      where: {
        customerId,
        bill: {
          date: {
            lte: asOfEnd,
            ...(checkpointEnd ? { gt: checkpointEnd } : {}),
          },
        },
      },
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: {
        customerId,
        date: {
          lte: asOfEnd,
          ...(checkpointEnd ? { gt: checkpointEnd } : {}),
        },
      },
    }),
  ]);

  runningBalance += Number(billTotal._sum.total ?? 0);
  runningBalance -= Number(paymentTotal._sum.amount ?? 0);

  const isExactMatch = !!(checkpointEnd && checkpointEnd.getTime() === asOfEnd.getTime());

  return { balance: runningBalance, checkpointDate, isExactMatch };
}

/**
 * Saves (upserts) a retailer's closing balance for a specific date — the
 * write-side counterpart to resolveRetailerBalance's read side. Upserting on
 * the (customerId, balanceDate) unique constraint means re-saving the same
 * period's closing balance twice (e.g. regenerating a combined bill) updates
 * the existing checkpoint instead of creating a duplicate row — this is the
 * direct fix for v1's "one change causes data to mix and duplicate" report.
 */
export async function saveRetailerBalanceCheckpoint(
  db: Pick<PrismaClient, 'retailerBalance'>,
  params: {
    customerId: string;
    balanceDate: Date;
    balanceAmount: number;
    mandiPeriod: MandiPeriod;
    notes?: string;
    isManual?: boolean;
  }
) {
  return db.retailerBalance.upsert({
    where: {
      customerId_balanceDate: {
        customerId: params.customerId,
        balanceDate: params.balanceDate,
      },
    },
    create: {
      customerId: params.customerId,
      balanceDate: params.balanceDate,
      balanceAmount: params.balanceAmount,
      mandiPeriod: params.mandiPeriod,
      notes: params.notes,
      isManual: params.isManual ?? false,
    },
    update: {
      balanceAmount: params.balanceAmount,
      mandiPeriod: params.mandiPeriod,
      notes: params.notes,
      isManual: params.isManual ?? false,
    },
  });
}

/** Tuesday-Friday vs Saturday-Monday mandi cycle, same rule as v1. */
export function getMandiPeriod(date: Date): MandiPeriod {
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  return day >= 2 && day <= 5 ? 'tuesday_friday' : 'saturday_monday';
}

/** Returns the {start, end} of the mandi cycle containing `date`, same rule as v1. */
export function getMandiCycleRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();

  const start = new Date(d);
  const end = new Date(d);

  if (day >= 2 && day <= 5) {
    // Tue-Fri cycle
    start.setUTCDate(d.getUTCDate() - (day - 2));
    end.setUTCDate(d.getUTCDate() + (5 - day));
  } else if (day === 6) {
    // Sat
    end.setUTCDate(d.getUTCDate() + 2);
  } else if (day === 0) {
    // Sun
    start.setUTCDate(d.getUTCDate() - 1);
    end.setUTCDate(d.getUTCDate() + 1);
  } else {
    // Mon
    start.setUTCDate(d.getUTCDate() - 2);
  }

  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/** The date one calendar day before `date`, at end of day. */
export function dayBefore(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return endOfDay(d);
}
