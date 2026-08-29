'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBill } from '@/lib/actions/bills';

type Customer = { id: string; name: string };
type Supplier = { id: string; name: string };

const ORGANS = [
  { key: 'mundi', label: '🥩 Mundi (Head)' },
  { key: 'kaleji', label: '🫁 Kaleji (Liver)' },
  { key: 'paya', label: '🦵 Paya (Legs)' },
  { key: 'vajdi', label: '💪 Vajdi (Tongue/Other)' },
  { key: 'gurda', label: '🍖 Gurda (Kidney)' },
] as const;

type OrganKey = (typeof ORGANS)[number]['key'];

type Row = {
  key: string;
  customerId: string;
  quantity: string;
  rate: string;
  includesKaleji: boolean;
  includesVajdi: boolean;
};

function emptyRow(): Row {
  return {
    key: Math.random().toString(36).slice(2),
    customerId: '',
    quantity: '',
    rate: '',
    includesKaleji: false,
    includesVajdi: false,
  };
}

export function NewBillForm({ suppliers, customers }: { suppliers: Supplier[]; customers: Customer[] }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalGoatsReceived, setTotalGoatsReceived] = useState('');
  const [rowsByOrgan, setRowsByOrgan] = useState<Record<OrganKey, Row[]>>({
    mundi: [],
    kaleji: [],
    paya: [],
    vajdi: [],
    gurda: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addRow(organ: OrganKey) {
    setRowsByOrgan((prev) => ({ ...prev, [organ]: [...prev[organ], emptyRow()] }));
  }

  function removeRow(organ: OrganKey, key: string) {
    setRowsByOrgan((prev) => ({ ...prev, [organ]: prev[organ].filter((r) => r.key !== key) }));
  }

  function updateRow(organ: OrganKey, key: string, patch: Partial<Row>) {
    setRowsByOrgan((prev) => ({
      ...prev,
      [organ]: prev[organ].map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));
  }

  const grandTotal = useMemo(() => {
    return ORGANS.reduce((sum, { key }) => {
      return (
        sum +
        rowsByOrgan[key].reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0), 0)
      );
    }, 0);
  }, [rowsByOrgan]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lineItems = ORGANS.flatMap(({ key }) =>
      rowsByOrgan[key]
        .filter((r) => r.customerId && r.quantity && r.rate)
        .map((r) => ({
          organ: key,
          customerId: r.customerId,
          quantity: r.quantity,
          rate: r.rate,
          includesKaleji: r.includesKaleji,
          includesVajdi: r.includesVajdi,
        }))
    );

    if (!supplierId) {
      setError('Select a supplier.');
      return;
    }
    if (lineItems.length === 0) {
      setError('Add at least one distribution entry.');
      return;
    }

    startTransition(async () => {
      const result = await createBill({
        supplierId,
        date,
        totalGoatsReceived: totalGoatsReceived || '0',
        lineItems,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push('/bills');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Supplier *</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-56"
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Bill Date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Total Goats Received</label>
          <input
            type="number"
            min="0"
            value={totalGoatsReceived}
            onChange={(e) => setTotalGoatsReceived(e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-32"
          />
        </div>
      </div>

      {ORGANS.map(({ key, label }) => (
        <div key={key} className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="bg-slate-900 px-4 py-2 flex items-center justify-between">
            <h3 className="font-medium text-sm">{label}</h3>
            <button
              type="button"
              onClick={() => addRow(key)}
              className="text-xs rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1 text-slate-200"
            >
              + Add Customer
            </button>
          </div>
          {rowsByOrgan[key].length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 text-xs">
                <tr>
                  <th className="px-4 py-1 font-normal">Customer</th>
                  <th className="px-4 py-1 font-normal">Qty</th>
                  <th className="px-4 py-1 font-normal">Rate</th>
                  <th className="px-4 py-1 font-normal">Total</th>
                  {key === 'mundi' && <th className="px-4 py-1 font-normal">Sold together</th>}
                  <th className="px-4 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {rowsByOrgan[key].map((row) => {
                  const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.rate) || 0);
                  return (
                    <tr key={row.key} className="border-t border-slate-800">
                      <td className="px-4 py-1.5">
                        <select
                          value={row.customerId}
                          onChange={(e) => updateRow(key, row.key, { customerId: e.target.value })}
                          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-44"
                        >
                          <option value="">Select</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.quantity}
                          onChange={(e) => updateRow(key, row.key, { quantity: e.target.value })}
                          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-20"
                        />
                      </td>
                      <td className="px-4 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.rate}
                          onChange={(e) => updateRow(key, row.key, { rate: e.target.value })}
                          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-24"
                        />
                      </td>
                      <td className="px-4 py-1.5 text-slate-300">
                        ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      {key === 'mundi' && (
                        <td className="px-4 py-1.5">
                          <label className="text-xs text-slate-400 mr-2">
                            <input
                              type="checkbox"
                              checked={row.includesKaleji}
                              onChange={(e) => updateRow(key, row.key, { includesKaleji: e.target.checked })}
                              className="mr-1"
                            />
                            Kaleji
                          </label>
                          <label className="text-xs text-slate-400">
                            <input
                              type="checkbox"
                              checked={row.includesVajdi}
                              onChange={(e) => updateRow(key, row.key, { includesVajdi: e.target.checked })}
                              className="mr-1"
                            />
                            Vajdi
                          </label>
                        </td>
                      )}
                      <td className="px-4 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(key, row.key)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
        <span className="text-slate-400 text-sm">Grand Total</span>
        <span className="text-xl font-semibold">
          ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 transition-colors"
      >
        {pending ? 'Saving…' : '📄 Generate Bill'}
      </button>
    </form>
  );
}
