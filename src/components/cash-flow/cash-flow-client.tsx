'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  getCashFlowSummary,
  deleteCashFlowEntry,
  addCashFlowEntry,
  type CashFlowSummary,
} from '@/lib/actions/cash-flow';
import { BillQuantityFetcher } from '@/components/cash-flow/bill-quantity-fetcher';
import { ManualEntryForms } from '@/components/cash-flow/manual-entry-forms';

type Supplier = { id: string; name: string };

const inr = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateInputValue(first), to: toDateInputValue(last) };
}

export function CashFlowClient({ suppliers }: { suppliers: Supplier[] }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [{ from, to }, setRange] = useState(currentMonthRange());
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(() => {
    if (!supplierId || !from || !to) return;
    setLoading(true);
    startTransition(async () => {
      const data = await getCashFlowSummary(supplierId, from, to);
      setSummary(data);
      setLoading(false);
    });
  }, [supplierId, from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleFromChange(value: string) {
    const [y, m] = value.split('-').map(Number);
    const last = new Date(y, m, 0);
    setRange({ from: value, to: toDateInputValue(last) });
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this entry?')) return;
    await deleteCashFlowEntry(id);
    reload();
  }

  return (
    <div>
      <div className="border border-slate-800 rounded-lg bg-slate-900 p-4 mb-6 flex flex-wrap items-end gap-3 no-print">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-48"
          >
            {suppliers.length === 0 && <option value="">No suppliers</option>}
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-1.5 transition-colors"
        >
          🖨️ Print
        </button>
        {(loading || pending) && <span className="text-sm text-slate-500">Loading…</span>}
      </div>

      {!supplierId ? (
        <p className="text-slate-500">Add a supplier first.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SummaryCard label="Opening Balance" value={summary?.openingBalance ?? 0} />
            <SummaryCard label="(+) Given Total" value={summary?.givenTotal ?? 0} tone="positive" />
            <SummaryCard label="(-) Deductions" value={summary?.deductionsTotal ?? 0} tone="negative" />
            <SummaryCard label="Closing Payable" value={summary?.closingPayable ?? 0} tone="emphasis" />
          </div>

          <div className="no-print">
            <BillQuantityFetcher supplierId={supplierId} from={from} to={to} onSaved={reload} />
            <ManualEntryForms supplierId={supplierId} onAdded={reload} addEntry={addCashFlowEntry} />
          </div>

          <h3 className="text-sm font-medium text-slate-300 mb-2">Transactions</h3>
          <div className="border border-slate-800 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-400">
                <tr>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Qty</th>
                  <th className="py-2 px-3 font-medium">Rate</th>
                  <th className="py-2 px-3 font-medium">Amount</th>
                  <th className="py-2 px-3 font-medium">Note</th>
                  <th className="py-2 px-3 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      No transactions in this period.
                    </td>
                  </tr>
                ) : (
                  summary.transactions.map((t) => (
                    <tr key={t.id} className="border-t border-slate-800">
                      <td className="py-2 px-3">{new Date(t.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-2 px-3">{t.quantity ?? '—'}</td>
                      <td className="py-2 px-3">{t.rate !== null ? Math.round(t.rate) : '—'}</td>
                      <td className="py-2 px-3">{inr(t.amount)}</td>
                      <td className="py-2 px-3 text-slate-400">{t.description ?? '—'}</td>
                      <td className="py-2 px-3 no-print">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-medium text-slate-300 mb-2">
            Deductions (Commission, Expenses, Payments)
          </h3>
          <div className="border border-slate-800 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-400">
                <tr>
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Description</th>
                  <th className="py-2 px-3 font-medium">Amount</th>
                  <th className="py-2 px-3 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.deductions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      No deductions in this period.
                    </td>
                  </tr>
                ) : (
                  summary.deductions.map((d) => (
                    <tr key={d.id} className="border-t border-slate-800">
                      <td className="py-2 px-3 capitalize">{d.entryType.replace('_', ' ')}</td>
                      <td className="py-2 px-3">{new Date(d.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-2 px-3 text-slate-400">
                        {d.personName ?? d.description ?? '—'}
                      </td>
                      <td className="py-2 px-3">{inr(d.amount)}</td>
                      <td className="py-2 px-3 no-print">
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-medium text-slate-300 mb-2 no-print">
            Opening Balance Overrides
          </h3>
          <div className="border border-slate-800 rounded-lg overflow-hidden no-print">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-400">
                <tr>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Amount</th>
                  <th className="py-2 px-3 font-medium">Notes</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.openingBalanceOverrides.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      No manual overrides.
                    </td>
                  </tr>
                ) : (
                  summary.openingBalanceOverrides.map((o) => (
                    <tr key={o.id} className="border-t border-slate-800">
                      <td className="py-2 px-3">{new Date(o.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-2 px-3">{inr(o.amount)}</td>
                      <td className="py-2 px-3 text-slate-400">{o.description ?? '—'}</td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => handleDelete(o.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          ✕ Reset
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'positive' | 'negative' | 'emphasis';
}) {
  const toneClass =
    tone === 'emphasis'
      ? 'border-emerald-800 bg-emerald-950/40'
      : tone === 'positive'
        ? 'border-slate-800 bg-slate-900'
        : tone === 'negative'
          ? 'border-slate-800 bg-slate-900'
          : 'border-slate-800 bg-slate-900';
  return (
    <div className={`rounded-lg border p-4 text-center ${toneClass}`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-semibold">{inr(value)}</div>
    </div>
  );
}
