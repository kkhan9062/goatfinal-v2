'use client';

import { useRouter } from 'next/navigation';

export function PricingHistoryFilters({
  customers,
  retailerId,
}: {
  customers: { id: string; name: string }[];
  retailerId?: string;
}) {
  const router = useRouter();

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900 p-4 mb-6">
      <label className="block text-xs text-slate-400 mb-1">Retailer</label>
      <select
        value={retailerId ?? ''}
        onChange={(e) =>
          router.push(e.target.value ? `/pricing-history?retailerId=${e.target.value}` : '/pricing-history')
        }
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
  );
}
