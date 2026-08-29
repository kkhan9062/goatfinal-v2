import type { PrismaClient, CashFlowEntryType } from '@prisma/client';

// ============================================================================
// Supplier Cash Flow — direct port of v1's "Sufiyan Bhai Cash Flow V2"
// (sufiyan-cashflow-v2-module.js), generalized to any supplier instead of one
// hardcoded name — the schema (SupplierCashFlow, keyed by supplierId) was
// already built for this, so no data model change was needed, just the UI
// and this resolution logic.
//
// Same checkpoint-carry-forward shape as lib/balance.ts's
// resolveRetailerBalance(), applied to a supplier's running payable instead
// of a retailer's running debt:
// - "Opening Balance" entries are manually-set anchors (a period's closing
//   payable becomes the next period's opening balance).
// - Resolving the opening balance for a given `fromDate` finds the latest
//   anchor on or before that date, then replays every transaction (+) and
//   deduction (commission/expense/person_payment, -) between the anchor's
//   date and the day before `fromDate`.
// - All dates here are plain calendar dates (@db.Date, no time component),
//   so comparisons use local-date arithmetic throughout — no UTC/ISO string
//   conversion anywhere, the exact bug class already found once this
//   session (v1's scfv2DayBefore(), and again in this file's own tests).
// ============================================================================

export type CashFlowEntry = {
  id: string;
  entryType: CashFlowEntryType;
  date: Date;
  quantity: number | null;
  rate: number | null;
  amount: number;
  description: string | null;
  personName: string | null;
};

type PrismaLike = Pick<PrismaClient, 'supplierCashFlow'>;

/**
 * Parses a plain 'YYYY-MM-DD' date-input value as a UTC-midnight instant —
 * matching how every other date-only field in this app is written
 * (Bill.date, Payment.date, RetailerBalance.balanceDate all go through
 * `new Date('YYYY-MM-DD')`, which the JS spec parses as UTC midnight, and
 * @db.Date columns round-trip that exactly). Building this one with
 * `new Date(y, m-1, d)` instead (local midnight) is what caused a real bug
 * here: on a server running east of UTC (e.g. Asia/Calcutta, UTC+5:30),
 * local midnight is an earlier UTC instant, which silently stored every
 * cash-flow entry one calendar day before the date the user picked —
 * caught by testing against the live database, not by inspection.
 */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/**
 * Extracts the 'YYYY-MM-DD' calendar date from a @db.Date value using UTC
 * getters — required because these Date objects represent UTC-midnight
 * instants (see parseDateOnly above); reading them with local getters would
 * only happen to work on servers at UTC or east of it, and break on servers
 * west of UTC (e.g. Vercel functions default to UTC, but this must not
 * depend on that).
 */
export function dateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** The calendar date one day before `dateStr`, as a UTC-midnight Date. */
export function dayBeforeDateStr(dateStr: string): Date {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/**
 * Resolves a supplier's opening balance for a period starting `fromDateStr`.
 * Finds the latest manual "opening_balance" checkpoint on or before that
 * date (or 0, if none exists), then adds every transaction and subtracts
 * every deduction (commission/expense/person_payment) strictly after that
 * checkpoint up to the day before `fromDateStr`.
 */
export async function resolveSupplierOpeningBalance(
  db: PrismaLike,
  supplierId: string,
  fromDateStr: string
): Promise<number> {
  const fromDate = parseDateOnly(fromDateStr);

  const anchor = await db.supplierCashFlow.findFirst({
    where: { supplierId, entryType: 'opening_balance', date: { lte: fromDate } },
    orderBy: { date: 'desc' },
  });
  if (!anchor) return 0;

  let running = Number(anchor.amount);
  const dayBeforeFrom = dayBeforeDateStr(fromDateStr);

  if (anchor.date <= dayBeforeFrom) {
    const between = await db.supplierCashFlow.findMany({
      where: {
        supplierId,
        entryType: { not: 'opening_balance' },
        date: { gte: anchor.date, lte: dayBeforeFrom },
      },
    });
    for (const entry of between) {
      const amount = Number(entry.amount);
      running += entry.entryType === 'transaction' ? amount : -amount;
    }
  }

  return running;
}
