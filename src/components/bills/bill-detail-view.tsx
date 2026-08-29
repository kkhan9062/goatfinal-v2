'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { exportElementAsPdf } from '@/lib/pdf-export';

type Row = {
  id: string;
  organ: string;
  customerName: string;
  quantity: number;
  rate: number;
  total: number;
  includesKaleji: boolean;
  includesVajdi: boolean;
};

const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BillDetailView({
  billNumber,
  supplierName,
  date,
  totalGoatsReceived,
  grandTotal,
  rows,
}: {
  billNumber: string;
  supplierName: string;
  date: string;
  totalGoatsReceived: number;
  grandTotal: number;
  rows: Row[];
}) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf() {
    if (!printAreaRef.current) return;
    setDownloading(true);
    try {
      await exportElementAsPdf(printAreaRef.current, `${billNumber}.pdf`);
    } catch (err) {
      console.error('Failed to export bill PDF:', err);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 no-print">
        <Link href="/bills" className="text-sm text-slate-400 hover:text-white transition-colors">
          ← Back to Bills
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-1.5 transition-colors"
          >
            🖨️ Print
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
          >
            {downloading ? 'Generating…' : '📥 Download PDF'}
          </button>
        </div>
      </div>

      {/*
        Everything inside this div is captured by html2canvas for the PDF
        download — deliberately plain inline styles/hex colors, no Tailwind
        color utility classes. Tailwind v4's default palette is defined in
        oklch, and html2canvas's CSS color parser can't read that (throws
        "unsupported color function" and aborts); this was caught live
        while testing the export, and patching computed styles in
        html2canvas's onclone hook proved unreliable (iframe/timing edge
        cases). Avoiding oklch entirely in the captured subtree is the
        actually-robust fix.
      */}
      <div
        ref={printAreaRef}
        id="bill-print-area"
        style={{ background: '#ffffff', color: '#000000', borderRadius: 8, padding: 24 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#4338ca', margin: 0 }}>
            Goat Organ Billing System
          </h1>
          <div style={{ fontSize: 13, color: '#475569' }}>Bill {billNumber}</div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            fontSize: 13,
            marginBottom: 16,
            borderBottom: '1px solid #cbd5e1',
            paddingBottom: 12,
          }}
        >
          <div>
            <span style={{ color: '#64748b' }}>Supplier:</span> <strong>{supplierName}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#64748b' }}>Date:</span>{' '}
            <strong>{new Date(date).toLocaleDateString('en-IN')}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Total Goats Received:</span>{' '}
            <strong>{totalGoatsReceived}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#64748b' }}>Entries:</span> <strong>{rows.length}</strong>
          </div>
        </div>

        <table style={{ width: '100%', fontSize: 13, marginBottom: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#4f46e5', color: '#ffffff' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Organ</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Retailer</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Rate</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '6px 8px' }}>
                  {row.organ}
                  {(row.includesKaleji || row.includesVajdi) && (
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Includes: {[row.includesKaleji && 'Kaleji', row.includesVajdi && 'Vajdi']
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </td>
                <td style={{ padding: '6px 8px' }}>{row.customerName}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{row.quantity}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Math.round(row.rate)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>₹{inr(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div
            style={{
              width: 224,
              background: '#f1f5f9',
              borderRadius: 6,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            <span>Grand Total</span>
            <span>₹{inr(grandTotal)}</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
