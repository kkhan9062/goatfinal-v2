import { describe, it, expect } from 'vitest';
import { resolveSupplierOpeningBalance, dayBeforeDateStr, dateKey, parseDateOnly } from './supplier-cashflow';

function mockDb(entries: { entryType: string; date: Date; amount: number }[]) {
  return {
    supplierCashFlow: {
      async findFirst({ where, orderBy }: any) {
        const matches = entries
          .filter((e) => e.entryType === where.entryType && e.date.getTime() <= where.date.lte.getTime())
          .sort((a, b) =>
            orderBy.date === 'desc' ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime()
          );
        return matches[0] ?? null;
      },
      async findMany({ where }: any) {
        return entries.filter(
          (e) =>
            e.entryType !== where.entryType.not &&
            e.date.getTime() >= where.date.gte.getTime() &&
            e.date.getTime() <= where.date.lte.getTime()
        );
      },
    },
  };
}

const d = (s: string) => parseDateOnly(s);

describe('resolveSupplierOpeningBalance', () => {
  it('returns 0 when no opening balance anchor exists yet', async () => {
    const db = mockDb([]);
    const balance = await resolveSupplierOpeningBalance(db as any, 'sup1', '2026-08-19');
    expect(balance).toBe(0);
  });

  it('returns the anchor amount unchanged when the period starts the day after it', async () => {
    const db = mockDb([{ entryType: 'opening_balance', date: d('2026-08-18'), amount: 5000 }]);
    const balance = await resolveSupplierOpeningBalance(db as any, 'sup1', '2026-08-19');
    expect(balance).toBe(5000);
  });

  it('adds transactions and subtracts deductions between the anchor and fromDate', async () => {
    const db = mockDb([
      { entryType: 'opening_balance', date: d('2026-08-01'), amount: 1000 },
      { entryType: 'transaction', date: d('2026-08-05'), amount: 3000 },
      { entryType: 'commission', date: d('2026-08-06'), amount: 200 },
      { entryType: 'expense', date: d('2026-08-07'), amount: 100 },
      { entryType: 'person_payment', date: d('2026-08-08'), amount: 500 },
    ]);
    // fromDate = 2026-08-19: everything from 2026-08-01 (anchor) through 2026-08-18 counts.
    const balance = await resolveSupplierOpeningBalance(db as any, 'sup1', '2026-08-19');
    expect(balance).toBe(1000 + 3000 - 200 - 100 - 500);
  });

  it('ignores activity on or after fromDate', async () => {
    const db = mockDb([
      { entryType: 'opening_balance', date: d('2026-08-01'), amount: 1000 },
      { entryType: 'transaction', date: d('2026-08-19'), amount: 9999 }, // on fromDate itself
    ]);
    const balance = await resolveSupplierOpeningBalance(db as any, 'sup1', '2026-08-19');
    expect(balance).toBe(1000);
  });

  it('uses the LATEST anchor on or before fromDate, not the earliest', async () => {
    const db = mockDb([
      { entryType: 'opening_balance', date: d('2026-08-01'), amount: 1000 },
      { entryType: 'opening_balance', date: d('2026-08-10'), amount: 5000 },
    ]);
    const balance = await resolveSupplierOpeningBalance(db as any, 'sup1', '2026-08-19');
    // Anchor is the Aug 10 one; nothing else happened between Aug 10 and Aug 18.
    expect(balance).toBe(5000);
  });
});

describe('dayBeforeDateStr', () => {
  it('handles month boundaries correctly without a UTC rollback', () => {
    expect(dateKey(dayBeforeDateStr('2026-09-01'))).toBe('2026-08-31');
  });
});

describe('parseDateOnly / dateKey round trip', () => {
  // Regression test for a real bug caught against the live database: an
  // earlier version built parseDateOnly with `new Date(y, m-1, d)` (local
  // midnight). On this dev machine (Asia/Calcutta, UTC+5:30) that silently
  // stored every date one calendar day early, because local midnight is an
  // earlier UTC instant. This must round-trip correctly regardless of what
  // timezone the test runner happens to be in.
  it('round-trips every date in a year with no drift', () => {
    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(2026, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const key = `2026-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        expect(dateKey(parseDateOnly(key))).toBe(key);
      }
    }
  });

  it('produces a UTC-midnight instant, not a local-midnight one', () => {
    const parsed = parseDateOnly('2026-08-15');
    expect(parsed.toISOString()).toBe('2026-08-15T00:00:00.000Z');
  });
});
