'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Customer = { id: string; name: string };

export function PaymentFilters({
  customers,
  from,
  to,
  retailerId,
  mode,
}: {
  customers: Customer[];
  from?: string;
  to?: string;
  retailerId?: string;
  mode?: string;
}) {
  const router = useRouter();
  const [localFrom, setLocalFrom] = useState(from ?? '');
  const [localTo, setLocalTo] = useState(to ?? '');
  const [localRetailer, setLocalRetailer] = useState(retailerId ?? '');
  const [localMode, setLocalMode] = useState(mode ?? '');

  function apply() {
    const params = new URLSearchParams();
    if (localFrom) params.set('from', localFrom);
    if (localTo) params.set('to', localTo);
    if (localRetailer) params.set('retailerId', localRetailer);
    if (localMode) params.set('mode', localMode);
    router.push(`/payments${params.toString() ? `?${params}` : ''}`);
  }

  function clear() {
    setLocalFrom('');
    setLocalTo('');
    setLocalRetailer('');
    setLocalMode('');
    router.push('/payments');
  }

  const hasFilters = from || to || retailerId || mode;

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900 p-4 mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">From</label>
        <input
          type="date"
          value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">To</label>
        <input
          type="date"
          value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Retailer</label>
        <select
          value={localRetailer}
          onChange={(e) => setLocalRetailer(e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-40"
        >
          <option value="">All Retailers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Mode</label>
        <select
          value={localMode}
          onChange={(e) => setLocalMode(e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
        >
          <option value="">All Modes</option>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Bank">Bank</option>
          <option value="Cheque">Cheque</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <button
        type="button"
        onClick={apply}
        className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-1.5 transition-colors"
      >
        Filter
      </button>
      {hasFilters && (
        <button
          type="button"
          onClick={clear}
          className="rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-1.5 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
