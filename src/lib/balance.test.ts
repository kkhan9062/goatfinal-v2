import { describe, it, expect } from 'vitest';
import { resolveRetailerBalance, getMandiPeriod, getMandiCycleRange, dayBefore } from './balance';

// Local-date-key formatter for test assertions. toISOString() converts to UTC
// first, which silently rolls dates backward by a day in any timezone ahead
// of UTC (e.g. IST) — the exact bug class already found once this session in
// v1's scfv2DayBefore(). balance.ts itself never calls toISOString() (all
// arithmetic stays in local time), so comparisons here must too.
const key = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Lightweight in-memory stand-in for the three Prisma calls resolveRetailerBalance
// makes, implementing just enough of the real query semantics (customerId match,
// date lte/gt filtering, sum aggregation) to exercise the actual logic under test
// without needing a real database connection for unit tests.
function mockDb(data: {
  balances?: { customerId: string; balanceDate: Date; balanceAmount: number }[];
  billLines?: { customerId: string; billDate: Date; total: number }[];
  payments?: { customerId: string; date: Date; amount: number }[];
}) {
  const balances = data.balances ?? [];
  const billLines = data.billLines ?? [];
  const payments = data.payments ?? [];

  return {
    retailerBalance: {
      async findFirst({ where, orderBy }: any) {
        const matches = balances.filter(
          (b) => b.customerId === where.customerId && b.balanceDate.getTime() <= where.balanceDate.lte.getTime()
        );
        if (matches.length === 0) return null;
        matches.sort((a, b) =>
          orderBy.balanceDate === 'desc'
            ? b.balanceDate.getTime() - a.balanceDate.getTime()
            : a.balanceDate.getTime() - b.balanceDate.getTime()
        );
        return matches[0];
      },
    },
    billLineItem: {
      async aggregate({ where }: any) {
        const dateFilter = where.bill.date;
        const matches = billLines.filter((b) => {
          if (b.customerId !== where.customerId) return false;
          if (b.billDate.getTime() > dateFilter.lte.getTime()) return false;
          if (dateFilter.gt && b.billDate.getTime() <= dateFilter.gt.getTime()) return false;
          return true;
        });
        return { _sum: { total: matches.reduce((s, b) => s + b.total, 0) } };
      },
    },
    payment: {
      async aggregate({ where }: any) {
        const dateFilter = where.date;
        const matches = payments.filter((p) => {
          if (p.customerId !== where.customerId) return false;
          if (p.date.getTime() > dateFilter.lte.getTime()) return false;
          if (dateFilter.gt && p.date.getTime() <= dateFilter.gt.getTime()) return false;
          return true;
        });
        return { _sum: { amount: matches.reduce((s, p) => s + p.amount, 0) } };
      },
    },
  };
}

const d = (s: string) => new Date(s + 'T00:00:00');

describe('resolveRetailerBalance', () => {
  it('returns 0 when there is no checkpoint and no history at all', async () => {
    const db = mockDb({});
    const result = await resolveRetailerBalance(db as any, 'cust1', d('2026-08-15'));
    expect(result.balance).toBe(0);
    expect(result.checkpointDate).toBeNull();
  });

  it('sums complete history from zero when there is no checkpoint yet', async () => {
    const db = mockDb({
      billLines: [
        { customerId: 'cust1', billDate: d('2026-08-01'), total: 1000 },
        { customerId: 'cust1', billDate: d('2026-08-05'), total: 500 },
      ],
      payments: [{ customerId: 'cust1', date: d('2026-08-03'), amount: 300 }],
    });
    const result = await resolveRetailerBalance(db as any, 'cust1', d('2026-08-05'));
    // 1000 + 500 - 300 = 1200
    expect(result.balance).toBe(1200);
  });

  it('a genuine zero balance is a valid, non-error outcome (retailer fully paid up)', async () => {
    const db = mockDb({
      billLines: [{ customerId: 'cust1', billDate: d('2026-08-01'), total: 1000 }],
      payments: [{ customerId: 'cust1', date: d('2026-08-02'), amount: 1000 }],
    });
    const result = await resolveRetailerBalance(db as any, 'cust1', d('2026-08-05'));
    expect(result.balance).toBe(0);
  });

  it('uses the checkpoint as the base and adds only activity strictly after it', async () => {
    const db = mockDb({
      balances: [{ customerId: 'cust1', balanceDate: d('2026-08-10'), balanceAmount: 5000 }],
      billLines: [
        // Before the checkpoint — must NOT be counted again (already baked into 5000).
        { customerId: 'cust1', billDate: d('2026-08-05'), total: 99999 },
        // After the checkpoint — must be counted.
        { customerId: 'cust1', billDate: d('2026-08-12'), total: 800 },
      ],
      payments: [{ customerId: 'cust1', date: d('2026-08-13'), amount: 300 }],
    });
    const result = await resolveRetailerBalance(db as any, 'cust1', d('2026-08-15'));
    // 5000 + 800 - 300 = 5500 (the 99999 pre-checkpoint bill must be excluded)
    expect(result.balance).toBe(5500);
    expect(result.checkpointDate?.getTime()).toBe(d('2026-08-10').getTime());
  });

  it('never double-counts activity dated exactly on the checkpoint date itself', async () => {
    const db = mockDb({
      balances: [{ customerId: 'cust1', balanceDate: d('2026-08-10'), balanceAmount: 5000 }],
      billLines: [{ customerId: 'cust1', billDate: d('2026-08-10'), total: 12345 }],
    });
    const result = await resolveRetailerBalance(db as any, 'cust1', d('2026-08-10'));
    expect(result.balance).toBe(5000);
    expect(result.isExactMatch).toBe(true);
  });

  it('always uses the LATEST checkpoint on or before asOfDate, not an older one', async () => {
    const db = mockDb({
      balances: [
        { customerId: 'cust1', balanceDate: d('2026-08-01'), balanceAmount: 1000 },
        { customerId: 'cust1', balanceDate: d('2026-08-10'), balanceAmount: 7000 },
      ],
    });
    const result = await resolveRetailerBalance(db as any, 'cust1', d('2026-08-20'));
    expect(result.balance).toBe(7000);
    expect(result.checkpointDate?.getTime()).toBe(d('2026-08-10').getTime());
  });

  it('a manual correction (an upserted checkpoint) becomes the new anchor for everything after it', async () => {
    // Regression test for the "accountant correction should be respected" and
    // "genuinely zero is a valid balance" scenarios discussed this session.
    // The real unique constraint on (customerId, balanceDate) means an upsert
    // replaces the prior value at that date rather than adding a second row —
    // this test models that end state directly: only the corrected value exists.
    const db = mockDb({
      balances: [{ customerId: 'cust1', balanceDate: d('2026-08-10'), balanceAmount: 0 }],
    });
    const result = await resolveRetailerBalance(db as any, 'cust1', d('2026-08-12'));
    expect(result.balance).toBe(0);
  });

  it('does not mix balances between different customers', async () => {
    const db = mockDb({
      balances: [{ customerId: 'cust1', balanceDate: d('2026-08-01'), balanceAmount: 1000 }],
      billLines: [{ customerId: 'cust2', billDate: d('2026-08-05'), total: 99999 }],
    });
    const result = await resolveRetailerBalance(db as any, 'cust1', d('2026-08-10'));
    expect(result.balance).toBe(1000);
  });
});

describe('getMandiPeriod', () => {
  it('classifies Tuesday-Friday correctly', () => {
    expect(getMandiPeriod(d('2026-08-18'))).toBe('tuesday_friday'); // Tuesday
    expect(getMandiPeriod(d('2026-08-21'))).toBe('tuesday_friday'); // Friday
  });
  it('classifies Saturday-Monday correctly', () => {
    expect(getMandiPeriod(d('2026-08-22'))).toBe('saturday_monday'); // Saturday
    expect(getMandiPeriod(d('2026-08-24'))).toBe('saturday_monday'); // Monday
  });
});

describe('getMandiCycleRange', () => {
  it('returns the full Tue-Fri range for a date in the middle', () => {
    const { start, end } = getMandiCycleRange(d('2026-08-19')); // Wednesday
    expect(key(start)).toBe('2026-08-18'); // Tuesday
    expect(key(end)).toBe('2026-08-21'); // Friday
  });
  it('returns the full Sat-Mon range for a Sunday', () => {
    const { start, end } = getMandiCycleRange(d('2026-08-23')); // Sunday
    expect(key(start)).toBe('2026-08-22'); // Saturday
    expect(key(end)).toBe('2026-08-24'); // Monday
  });
});

describe('dayBefore', () => {
  it('handles month boundaries correctly', () => {
    expect(key(dayBefore(d('2026-09-01')))).toBe('2026-08-31');
  });
});
