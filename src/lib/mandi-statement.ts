// ============================================================================
// Mandi-wise Periodic Statement — port of v1's generateMandiWisePeriodicReport()
// (retailer-ledger-module.js): one row per mandi cycle (Tue-Fri / Sat-Mon)
// in a date range, showing that cycle's billed/paid/closing-balance, for a
// single retailer.
//
// Improvement over v1: v1 recomputed each cycle's closing balance from
// scratch (opening + billed - paid) and then separately checked whether a
// *manually flagged* saved balance disagreed with that computed value,
// showing an "adjustment" note when so. That's two sources of truth that
// can drift. Here, both the opening and closing balance for every cycle
// come from resolveRetailerBalance() — the same single source of truth
// used by Combined Bill and the Ledger's Pending Balance — so a manual
// correction is reflected automatically, not detected after the fact.
// ============================================================================

import { prisma } from '@/lib/prisma';
import { resolveRetailerBalance, getMandiCycleRange, dayBefore, type MandiPeriod } from '@/lib/balance';

export type MandiCycleRow = {
  period: MandiPeriod;
  start: Date;
  end: Date;
  opening: number;
  billed: number;
  paid: number;
  closing: number;
};

export type MandiWiseStatement = {
  customerName: string;
  openingBalance: number;
  rows: MandiCycleRow[];
  grandTotalBilled: number;
  grandTotalPaid: number;
  finalBalance: number;
};

function labelFor(period: MandiPeriod): string {
  return period === 'tuesday_friday' ? 'Tuesday–Friday' : 'Saturday–Monday';
}

export async function getMandiWiseStatement(
  customerId: string,
  fromStr: string,
  toStr: string
): Promise<MandiWiseStatement | null> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return null;

  const from = new Date(fromStr);
  const to = new Date(toStr);

  // Enumerate the distinct mandi cycles covering [from, to].
  const cycles: { start: Date; end: Date; period: MandiPeriod }[] = [];
  let cursor = new Date(from);
  while (cursor <= to) {
    const range = getMandiCycleRange(cursor);
    const period: MandiPeriod = range.start.getDay() >= 2 && range.start.getDay() <= 5 ? 'tuesday_friday' : 'saturday_monday';
    if (!cycles.find((c) => c.start.getTime() === range.start.getTime())) {
      cycles.push({ ...range, period });
    }
    cursor = new Date(range.end);
    cursor.setDate(cursor.getDate() + 1);
  }

  const openingBalanceResolved = await resolveRetailerBalance(prisma, customerId, dayBefore(cycles[0]?.start ?? from));
  const openingBalance = openingBalanceResolved.balance;

  const rows: MandiCycleRow[] = [];
  let grandTotalBilled = 0;
  let grandTotalPaid = 0;

  for (const cycle of cycles) {
    const [billTotal, paymentTotal, openingResolved, closingResolved] = await Promise.all([
      prisma.billLineItem.aggregate({
        _sum: { total: true },
        where: { customerId, bill: { date: { gte: cycle.start, lte: cycle.end } } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { customerId, date: { gte: cycle.start, lte: cycle.end } },
      }),
      resolveRetailerBalance(prisma, customerId, dayBefore(cycle.start)),
      resolveRetailerBalance(prisma, customerId, cycle.end),
    ]);

    const billed = Number(billTotal._sum.total ?? 0);
    const paid = Number(paymentTotal._sum.amount ?? 0);

    if (billed === 0 && paid === 0) continue;

    rows.push({
      period: cycle.period,
      start: cycle.start,
      end: cycle.end,
      opening: openingResolved.balance,
      billed,
      paid,
      closing: closingResolved.balance,
    });
    grandTotalBilled += billed;
    grandTotalPaid += paid;
  }

  const finalBalance = rows.length > 0 ? rows[rows.length - 1].closing : openingBalance;

  return {
    customerName: customer.name,
    openingBalance,
    rows,
    grandTotalBilled,
    grandTotalPaid,
    finalBalance,
  };
}

export { labelFor as mandiPeriodLabel };
