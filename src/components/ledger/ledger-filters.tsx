'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  customers: { id: string; name: string }[];
  retailerId?: string;
  from?: string;
  to?: string;
};

export function LedgerFilters({ customers, retailerId, from, to }: Props) {
  const router = useRouter();
  const [localFrom, setLocalFrom] = useState(from ?? '');
  const [localTo, setLocalTo] = useState(to ?? '');

  function navigate(next: { retailerId?: string; from?: string; to?: string }) {
    const params = new URLSearchParams();
    if (next.retailerId) params.set('retailerId', next.retailerId);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    router.push(`/ledger${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900 p-4 mb-6 flex flex-wrap items-end gap-3 no-print">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Retailer</label>
        <select
          value={retailerId ?? ''}
          onChange={(e) => navigate({ retailerId: e.target.value, from: localFrom, to: localTo })}
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-56"
        >
          <option value="">Select a retailer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">From (display only)</label>
        <input
          type="date"
          value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">To (display only)</label>
        <input
          type="date"
          value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
        />
      </div>
      <button
        type="button"
        onClick={() => navigate({ retailerId, from: localFrom, to: localTo })}
        disabled={!retailerId}
        className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
      >
        Apply
      </button>
      {(from || to) && (
        <button
          type="button"
          onClick={() => {
            setLocalFrom('');
            setLocalTo('');
            navigate({ retailerId });
          }}
          className="rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-1.5 transition-colors"
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
