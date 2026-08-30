'use client';

import { useState, useTransition } from 'react';
import { createPayments } from '@/lib/actions/payments';

type Customer = { id: string; name: string };
type Mode = 'Cash' | 'UPI' | 'Bank' | 'Cheque' | 'Other';

type Row = {
  key: string;
  customerId: string;
  amount: string;
  date: string;
  mode: Mode;
  notes: string;
};

function todayInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function emptyRow(date: string): Row {
  return {
    key: Math.random().toString(36).slice(2),
    customerId: '',
    amount: '',
    date,
    mode: 'Cash',
    notes: '',
  };
}

// Direct port of v1's bulk payment entry mode (payments-module.js) — record
// several retailers' payments from the same mandi visit in one submit.
export function BulkPaymentForm({ customers }: { customers: Customer[] }) {
  const [globalDate, setGlobalDate] = useState(todayInputValue);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(todayInputValue())]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(globalDate)]);
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length === 0 ? [emptyRow(globalDate)] : next;
    });
  }

  function applyGlobalDate(value: string) {
    setGlobalDate(value);
    setRows((prev) => prev.map((r) => ({ ...r, date: value })));
  }

  function handleSubmit() {
    setError(null);
    const nonBlank = rows.filter((r) => r.customerId || r.amount || r.notes);
    if (nonBlank.length === 0) {
      setError('Add at least one payment row.');
      return;
    }
    const errors: string[] = [];
    nonBlank.forEach((r, i) => {
      if (!r.customerId) errors.push(`Row ${i + 1}: select a retailer.`);
      else if (!(Number(r.amount) > 0)) errors.push(`Row ${i + 1}: enter a valid amount.`);
      else if (!r.date) errors.push(`Row ${i + 1}: select a date.`);
    });
    if (errors.length > 0) {
      setError(errors.join(' '));
      return;
    }

    startTransition(async () => {
      const result = await createPayments(
        nonBlank.map((r) => ({
          customerId: r.customerId,
          amount: Number(r.amount),
          date: r.date,
          mode: r.mode,
          notes: r.notes || undefined,
        }))
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRows([emptyRow(globalDate)]);
    });
  }

  return (
    <div className="mb-6 border border-slate-800 rounded-lg bg-slate-900 p-4">
      <div className="flex items-end gap-3 mb-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Date for all rows</label>
          <input
            type="date"
            value={globalDate}
            onChange={(e) => applyGlobalDate(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm mb-2">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-1 pr-2 font-medium">Retailer</th>
              <th className="py-1 pr-2 font-medium">Amount</th>
              <th className="py-1 pr-2 font-medium">Date</th>
              <th className="py-1 pr-2 font-medium">Mode</th>
              <th className="py-1 pr-2 font-medium">Notes</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-800">
                <td className="py-1.5 pr-2">
                  <select
                    value={row.customerId}
                    onChange={(e) => updateRow(row.key, { customerId: e.target.value })}
                    className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-40"
                  >
                    <option value="">Select</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                    className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-24"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(row.key, { date: e.target.value })}
                    className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    value={row.mode}
                    onChange={(e) => updateRow(row.key, { mode: e.target.value as Mode })}
                    className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={row.notes}
                    onChange={(e) => updateRow(row.key, { notes: e.target.value })}
                    className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-32"
                  />
                </td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="text-xs rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-slate-200"
        >
          + Add Row
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
        >
          {pending ? 'Saving…' : '💾 Save All Payments'}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
