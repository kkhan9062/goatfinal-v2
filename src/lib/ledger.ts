// ============================================================================
// Retailer Ledger — direct port of v1's loadRetailerLedger() /
// calculateRetailerBalance() (retailer-ledger-module.js), the feature that
// answers "prove me this retailer's balance" — the exact question that
// started this whole rebuild.
//
// Deliberate improvements over v1, not just a straight port:
// - v1 computed "Pending" as a raw totalBilled - totalPaid sum, completely
//   independent of resolveRetailerBalanceAsOf() used everywhere else — two
//   formulas that happen to agree only if every checkpoint was ever saved
//   correctly. Here, Pending comes from the same resolveRetailerBalance()
//   used by Combined Bill, so there is exactly one balance number in the
//   whole app, not two that can silently drift apart.
// - v1 filtered payments by date range but NOT bills (a deliberate-looking
//   inconsistency, per its own comments) and displayed a running balance
//   that reset to 0 at the start of whatever range was selected — which
//   makes "running balance" meaningless as soon as any filter is applied.
//   Here, the running balance is always computed across the retailer's
//   FULL history in order, and a date filter only narrows which rows are
//   *displayed* — the balance column next to each row is still correct.
// ============================================================================

import { prisma } from '@/lib/prisma';
import { resolveRetailerBalance } from '@/lib/balance';

export type LedgerTransaction = {
  date: Date;
  type: 'bill' | 'payment';
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type RetailerLedger = {
  customer: { id: string; name: string; phone: string | null; address: string | null };
  totalBilled: number;
  totalPaid: number;
  pending: number;
  transactions: LedgerTransaction[];
  balanceHistory: { balanceDate: Date; balanceAmount: number; mandiPeriod: string; isManual: boolean; notes: string | null }[];
};

export async function getRetailerLedger(
  customerId: string,
  from?: string,
  to?: string
): Promise<RetailerLedger | null> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return null;

  const [lineItems, payments, balanceHistory, resolved] = await Promise.all([
    prisma.billLineItem.findMany({
      where: { customerId },
      include: { bill: true },
      orderBy: { bill: { date: 'asc' } },
    }),
    prisma.payment.findMany({ where: { customerId }, orderBy: { date: 'asc' } }),
    prisma.retailerBalance.findMany({ where: { customerId }, orderBy: { balanceDate: 'desc' } }),
    resolveRetailerBalance(prisma, customerId, new Date()),
  ]);

  // Group bill line items back into one ledger row per bill (a retailer's
  // total contribution to that bill), not one row per organ line.
  const billTotals = new Map<string, { date: Date; billNumber: string; total: number }>();
  for (const li of lineItems) {
    const existing = billTotals.get(li.billId);
    const amount = Number(li.total);
    if (existing) {
      existing.total += amount;
    } else {
      billTotals.set(li.billId, { date: li.bill.date, billNumber: li.bill.billNumber, total: amount });
    }
  }

  const totalBilled = [...billTotals.values()].reduce((sum, b) => sum + b.total, 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  type RawEntry = { date: Date; type: 'bill' | 'payment'; description: string; debit: number; credit: number };
  const raw: RawEntry[] = [
    ...[...billTotals.values()].map((b) => ({
      date: b.date,
      type: 'bill' as const,
      description: `Bill ${b.billNumber}`,
      debit: b.total,
      credit: 0,
    })),
    ...payments.map((p) => ({
      date: p.date,
      type: 'payment' as const,
      description: `Payment (${p.mode})`,
      debit: 0,
      credit: Number(p.amount),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  const allTransactions: LedgerTransaction[] = raw.map((entry) => {
    running += entry.debit - entry.credit;
    return { ...entry, runningBalance: running };
  });

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const transactions = allTransactions.filter((t) => {
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    return true;
  });

  return {
    customer: { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address },
    totalBilled,
    totalPaid,
    pending: resolved.balance,
    transactions,
    balanceHistory: balanceHistory.map((b) => ({
      balanceDate: b.balanceDate,
      balanceAmount: Number(b.balanceAmount),
      mandiPeriod: b.mandiPeriod,
      isManual: b.isManual,
      notes: b.notes,
    })),
  };
}
