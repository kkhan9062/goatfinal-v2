'use client';

import { useMemo, useState, useTransition } from 'react';
import type { CombinedBillRetailer, CombinedBillSource } from '@/lib/actions/combined-bill';
import { updateCombinedBillEntry } from '@/lib/actions/combined-bill';

type Customer = { id: string; name: string };

// Direct equivalent of v1's "✏️ Edit Entries" button on each Combined Bill
// retailer card (openCombinedRetailerEditModal in combined-bill-module.js):
// pick one of the underlying bill entries that make up this retailer's
// period total, correct its quantity/rate, and — if it was entered under
// the wrong person — reassign it to a different retailer.
export function EditEntriesButton({
  retailer,
  customers,
  onSaved,
}: {
  retailer: CombinedBillRetailer;
  customers: Customer[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);

  const sources = useMemo(() => {
    const all: CombinedBillSource[] = [];
    for (const dayBucket of Object.values(retailer.dailyDeliveries)) {
      for (const delivery of Object.values(dayBucket)) {
        all.push(...delivery.sources);
      }
    }
    return all.sort((a, b) => a.billDate.localeCompare(b.billDate) || a.billNumber.localeCompare(b.billNumber));
  }, [retailer]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1"
      >
        ✏️ Edit Entries
      </button>
      {open && (
        <EditEntriesModal
          retailerName={retailer.name}
          sources={sources}
          customers={customers}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      )}
    </>
  );
}

function EditEntriesModal({
  retailerName,
  sources,
  customers,
  onClose,
  onSaved,
}: {
  retailerName: string;
  sources: CombinedBillSource[];
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = sources[selectedIndex];
  const [quantity, setQuantity] = useState(String(selected?.quantity ?? ''));
  const [rate, setRate] = useState(String(selected?.rate ?? ''));
  const [customerId, setCustomerId] = useState(() => customers.find((c) => c.name === retailerName)?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function selectSource(index: number) {
    setSelectedIndex(index);
    const source = sources[index];
    setQuantity(String(source.quantity));
    setRate(String(source.rate));
    setCustomerId(customers.find((c) => c.name === retailerName)?.id ?? '');
  }

  function handleSave() {
    setError(null);
    if (!selected) return;
    const qty = Number(quantity);
    const r = Number(rate);
    if (!(qty > 0) || !(r > 0)) {
      setError('Enter valid quantity and rate values.');
      return;
    }
    startTransition(async () => {
      const result = await updateCombinedBillEntry(selected.lineItemId, qty, r, customerId || undefined);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  if (!selected) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
          <p className="text-slate-300">No editable entries found for this retailer.</p>
          <button
            onClick={onClose}
            className="mt-4 text-sm rounded-md bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg p-5 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-white mb-4">Edit Entry — {retailerName}</h3>

        <label className="block text-xs text-slate-400 mb-1">Select Bill Entry</label>
        <select
          value={selectedIndex}
          onChange={(e) => selectSource(Number(e.target.value))}
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm mb-3"
        >
          {sources.map((s, i) => (
            <option key={s.lineItemId} value={i}>
              {new Date(s.billDate).toLocaleDateString('en-IN')} | {s.billNumber} | {s.organ} | Qty {s.quantity} @{s.rate}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Quantity</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
            />
          </div>
        </div>

        <label className="block text-xs text-slate-400 mb-1">
          Retailer <span className="text-slate-500">(change if entered under the wrong person)</span>
        </label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm mb-4"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm rounded-md border border-slate-700 hover:bg-slate-800 text-slate-300 px-4 py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="text-sm rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-1.5"
          >
            {pending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
