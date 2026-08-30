'use client';

import type { CombinedBillRetailer } from '@/lib/actions/combined-bill';
import { EditEntriesButton } from '@/components/combined-bill/edit-entries-button';

type Customer = { id: string; name: string };

type Props = {
  retailer: CombinedBillRetailer;
  serialNo: number;
  dateColumns: string[];
  summarized: boolean;
  inr: (n: number) => string;
  customers: Customer[];
  onEntriesSaved: () => void;
};

function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: '#ffffff',
};
const cellStyle: React.CSSProperties = { padding: '4px 8px' };

// This whole card is captured by html2canvas (individually for the ZIP
// download, and as part of the page for the combined PDF) — deliberately
// plain inline styles/hex colors throughout, no Tailwind color utility
// classes. Tailwind v4's default palette is defined in oklch, which
// html2canvas's CSS color parser can't read (throws "unsupported color
// function" and aborts the whole capture); caught live while testing the
// export. See lib/pdf-export.ts for the full explanation.
export function RetailerCard({
  retailer,
  serialNo,
  dateColumns,
  summarized,
  inr,
  customers,
  onEntriesSaved,
}: Props) {
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
    <div>
      <div data-pdf-ignore className="mb-1">
        <EditEntriesButton retailer={retailer} customers={customers} onSaved={onEntriesSaved} />
      </div>
      <div
        data-retailer-card={retailer.customerId}
        data-retailer-name={retailer.name}
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 8,
        overflow: 'hidden',
        background: '#ffffff',
        color: '#000000',
        fontSize: 13,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th colSpan={4} style={{ ...headerStyle, textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>
              {serialNo}. {retailer.name}
            </th>
          </tr>
          <tr style={headerStyle}>
            <th style={{ ...cellStyle, textAlign: 'left', fontSize: 11, fontWeight: 500, width: '25%' }}>
              Date
            </th>
            <th style={{ ...cellStyle, textAlign: 'left', fontSize: 11, fontWeight: 500, width: '25%' }}>
              Qty
            </th>
            <th style={{ ...cellStyle, textAlign: 'left', fontSize: 11, fontWeight: 500, width: '25%' }}>
              Rate
            </th>
            <th style={{ ...cellStyle, textAlign: 'left', fontSize: 11, fontWeight: 500, width: '25%' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '8px 0' }}>
                No entries
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={cellStyle}>{row.label}</td>
                <td style={cellStyle}>{row.quantity}</td>
                <td style={cellStyle}>{Math.round(row.rate)}</td>
                <td style={cellStyle}>{inr(row.total)}</td>
              </tr>
            ))
          )}
          <tr style={{ background: '#f1f5f9', fontWeight: 600, borderTop: '1px solid #cbd5e1' }}>
            <td colSpan={3} style={cellStyle}>
              Current Mandi Total
            </td>
            <td style={cellStyle}>{inr(retailer.weeklyTotal)}</td>
          </tr>
          <tr style={{ background: '#f1f5f9', fontWeight: 600 }}>
            <td colSpan={3} style={cellStyle}>
              Previous Balance
            </td>
            <td style={cellStyle}>{inr(retailer.displayPreviousBalance)}</td>
          </tr>
          <tr style={{ background: '#d4edda', fontWeight: 700 }}>
            <td colSpan={3} style={cellStyle}>
              New Balance
            </td>
            <td style={{ ...cellStyle, color: '#155724' }}>{inr(retailer.newBalance)}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
