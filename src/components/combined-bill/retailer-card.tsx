'use client';

import type { CombinedBillRetailer } from '@/lib/actions/combined-bill';

type Props = {
  retailer: CombinedBillRetailer;
  serialNo: number;
  dateColumns: string[];
  summarized: boolean;
  inr: (n: number) => string;
};

function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function RetailerCard({ retailer, serialNo, dateColumns, summarized, inr }: Props) {
  const rows: { label: string; quantity: number; rate: number; total: number }[] = [];

  if (summarized) {
    const byRate = new Map<string, { quantity: number; rate: number; total: number }>();
    for (const dayBucket of Object.values(retailer.dailyDeliveries)) {
      for (const [rateKey, delivery] of Object.entries(dayBucket)) {
        const existing = byRate.get(rateKey);
        if (existing) {
          existing.quantity += delivery.quantity;
          existing.total += delivery.total;
        } else {
          byRate.set(rateKey, { ...delivery });
        }
      }
    }
    for (const d of byRate.values()) {
      rows.push({ label: '—', quantity: d.quantity, rate: d.rate, total: d.total });
    }
  } else {
    for (const dateKey of dateColumns) {
      const dayBucket = retailer.dailyDeliveries[dateKey];
      if (!dayBucket) continue;
      for (const delivery of Object.values(dayBucket)) {
        rows.push({
          label: formatDateKey(dateKey),
          quantity: delivery.quantity,
          rate: delivery.rate,
          total: delivery.total,
        });
      }
    }
  }

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-white text-black text-sm">
      <table className="w-full">
        <thead>
          <tr>
            <th
              colSpan={4}
              className="text-left px-2 py-1.5 text-white font-bold"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
            >
              {serialNo}. {retailer.name}
            </th>
          </tr>
          <tr style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
            <th className="text-left px-2 py-1 text-white text-xs font-medium w-1/4">Date</th>
            <th className="text-left px-2 py-1 text-white text-xs font-medium w-1/4">Qty</th>
            <th className="text-left px-2 py-1 text-white text-xs font-medium w-1/4">Rate</th>
            <th className="text-left px-2 py-1 text-white text-xs font-medium w-1/4">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center text-slate-500 py-2">
                No entries
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-200">
                <td className="px-2 py-1">{row.label}</td>
                <td className="px-2 py-1">{row.quantity}</td>
                <td className="px-2 py-1">{Math.round(row.rate)}</td>
                <td className="px-2 py-1">{inr(row.total)}</td>
              </tr>
            ))
          )}
          <tr className="bg-slate-100 font-semibold border-t border-slate-300">
            <td colSpan={3} className="px-2 py-1">
              Current Mandi Total
            </td>
            <td className="px-2 py-1">{inr(retailer.weeklyTotal)}</td>
          </tr>
          <tr className="bg-slate-100 font-semibold">
            <td colSpan={3} className="px-2 py-1">
              Previous Balance
            </td>
            <td className="px-2 py-1">{inr(retailer.displayPreviousBalance)}</td>
          </tr>
          <tr className="font-bold" style={{ background: '#d4edda' }}>
            <td colSpan={3} className="px-2 py-1">
              New Balance
            </td>
            <td className="px-2 py-1" style={{ color: '#155724' }}>
              {inr(retailer.newBalance)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
