'use client';

import { useState, useTransition } from 'react';
import { getBillQuantitySummary, addBillQuantityTransactions, type BillQuantityRow } from '@/lib/actions/cash-flow';

type EditableRow = {
  date: string;
  autoQty: number;
  alreadySaved: number;
  qty: string;
  rate: string;
  isSplit: boolean;
  splitNote: string;
};

export function BillQuantityFetcher({
  supplierId,
  from,
  to,
  onSaved,
}: {
  supplierId: string;
  from: string;
  to: string;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function fetchQuantities() {
    setMessage(null);
    startTransition(async () => {
      const summary: BillQuantityRow[] = await getBillQuantitySummary(supplierId, from, to);
      if (summary.length === 0) {
        setRows([]);
        return;
      }
      setRows(
        summary.map((r) => ({
          date: r.date,
          autoQty: r.autoQty,
          alreadySaved: r.alreadySaved,
          qty: String(r.remaining),
          rate: '',
          isSplit: false,
          splitNote: '',
        }))
      );
    });
  }

  function addSplitRow(index: number) {
    setRows((prev) => {
      if (!prev) return prev;
      const base = prev[index];
      const split: EditableRow = {
        date: base.date,
        autoQty: base.autoQty,
        alreadySaved: base.alreadySaved,
        qty: '',
        rate: '',
        isSplit: true,
        splitNote: 'mendi/different rate',
      };
      const next = [...prev];
      next.splice(index + 1, 0, split);
      return next;
    });
  }

  function updateRow(index: number, patch: Partial<EditableRow>) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev));
  }

  function removeRow(index: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function save() {
    if (!rows) return;
    const toSave = rows
      .filter((r) => Number(r.qty) > 0 && Number(r.rate) > 0)
      .map((r) => ({
        date: r.date,
        quantity: Number(r.qty),
        rate: Number(r.rate),
        description: r.isSplit ? r.splitNote || 'Split entry (different rate)' : 'From daily bill',
      }));

    if (toSave.length === 0) {
      setMessage('Nothing to save — fill in Qty and Rate for at least one row.');
      return;
    }

    startTransition(async () => {
      const result = await addBillQuantityTransactions(supplierId, toSave);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(`✅ Saved ${result.saved} transaction row(s).`);
      setRows(null);
      onSaved();
    });
  }

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-300">Fetch Bill Quantities</h3>
        <button
          type="button"
          onClick={fetchQuantities}
          disabled={pending}
          className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
        >
          {pending ? 'Loading…' : 'Fetch from bills in range'}
        </button>
      </div>
      {message && <p className="text-xs text-slate-400 mb-2">{message}</p>}
      {rows && (
        <>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No bills found for this supplier in this date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm mb-2">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="py-1 px-2 font-medium">Date</th>
                    <th className="py-1 px-2 font-medium">Bill Qty (auto)</th>
                    <th className="py-1 px-2 font-medium">Already Saved</th>
                    <th className="py-1 px-2 font-medium">Qty</th>
                    <th className="py-1 px-2 font-medium">Rate</th>
                    <th className="py-1 px-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-t border-slate-800 ${r.isSplit ? 'bg-amber-950/30' : ''}`}>
                      <td className="py-1 px-2">
                        {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        {r.isSplit && <span className="ml-1 text-xs text-amber-400">split</span>}
                      </td>
                      <td className="py-1 px-2">{r.isSplit ? '—' : r.autoQty}</td>
                      <td className="py-1 px-2">{r.isSplit ? '—' : r.alreadySaved || '—'}</td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          value={r.qty}
                          onChange={(e) => updateRow(i, { qty: e.target.value })}
                          className="w-20 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          value={r.rate}
                          onChange={(e) => updateRow(i, { rate: e.target.value })}
                          placeholder="Rate"
                          className="w-24 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm"
                        />
                      </td>
                      <td className="py-1 px-2 whitespace-nowrap">
                        {!r.isSplit && (
                          <button
                            type="button"
                            onClick={() => addSplitRow(i)}
                            className="text-xs text-slate-400 hover:text-white mr-2"
                          >
                            ➕ Split
                          </button>
                        )}
                        {r.isSplit && (
                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
              >
                💾 Save These Transactions
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
