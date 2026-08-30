'use client';

import { useRef, useState, useTransition } from 'react';
import { generateCombinedBill, type CombinedBillResult } from '@/lib/actions/combined-bill';
import { getMandiCycleRange } from '@/lib/balance';
import { RetailerCard } from '@/components/combined-bill/retailer-card';
import { exportElementAsPdf, exportElementsAsZip } from '@/lib/pdf-export';

type Supplier = { id: string; name: string };
type Customer = { id: string; name: string };

const inr = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function CombinedBillClient({
  suppliers,
  customers,
}: {
  suppliers: Supplier[];
  customers: Customer[];
}) {
  // All suppliers pre-selected by default, matching v1 — the common case is
  // "everyone's mandi bill for this period," not picking suppliers one by one.
  const [selectedIds, setSelectedIds] = useState<string[]>(() => suppliers.map((s) => s.id));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summarized, setSummarized] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CombinedBillResult | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState<string | null>(null);

  function toggleSupplier(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    // Auto-fill the end date to the end of this mandi cycle, same UX as v1 —
    // saves the retyping for the common case, still fully editable after.
    if (value) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        const { end } = getMandiCycleRange(parsed);
        setEndDate(toDateInputValue(end));
      }
    }
  }

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateCombinedBill(selectedIds, startDate, endDate);
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        return;
      }
      setResult(res.data);
    });
  }

  async function handleDownloadPdf() {
    if (!printAreaRef.current || !result) return;
    setPdfBusy(true);
    try {
      await exportElementAsPdf(
        printAreaRef.current,
        `Combined_Bill_${result.startDate}_to_${result.endDate}.pdf`
      );
    } catch (err) {
      console.error('Failed to export combined bill PDF:', err);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleDownloadZip() {
    if (!printAreaRef.current || !result) return;
    const cards = Array.from(
      printAreaRef.current.querySelectorAll<HTMLElement>('[data-retailer-card]')
    );
    if (cards.length === 0) {
      alert('No bills found to download.');
      return;
    }

    const folderName = `Mandi_${result.startDate}_to_${result.endDate}`;
    const elements = cards.map((el) => {
      const name = (el.dataset.retailerName || 'retailer_bill').replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_');
      return { element: el, filename: `${folderName}/${name}.png` };
    });

    setZipBusy(`0/${elements.length}`);
    try {
      await exportElementsAsZip(elements, `${folderName}.zip`, (done, total) =>
        setZipBusy(`${done}/${total}`)
      );
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
      alert('Could not generate the ZIP file. Please try again.');
    } finally {
      setZipBusy(null);
    }
  }

  return (
    <div>
      <div className="border border-slate-800 rounded-lg bg-slate-900 p-4 mb-6 no-print">
        <div className="mb-3">
          <div className="text-xs text-slate-400 mb-2">Suppliers *</div>
          <div className="flex flex-wrap gap-3">
            {suppliers.length === 0 ? (
              <span className="text-sm text-slate-500">No suppliers yet.</span>
            ) : (
              suppliers.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s.id)}
                    onChange={() => toggleSupplier(s.id)}
                    className="accent-indigo-500"
                  />
                  {s.name}
                </label>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Start date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">End date *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-slate-300 pb-1.5">
            <input
              type="checkbox"
              checked={summarized}
              onChange={(e) => setSummarized(e.target.checked)}
              className="accent-indigo-500"
            />
            Summarized (by rate, not date)
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
          >
            {pending ? 'Generating…' : 'Generate Combined Bill'}
          </button>
          {result && (
            <>
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
                disabled={pdfBusy}
                className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
              >
                {pdfBusy ? 'Generating…' : '📥 Download PDF'}
              </button>
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={zipBusy !== null}
                className="rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
              >
                {zipBusy ? `Zipping ${zipBusy}…` : '📁 Download All as ZIP'}
              </button>
            </>
          )}
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      {result && (
        // Plain inline styles/hex colors throughout this whole subtree, not
        // Tailwind color classes — it's captured by html2canvas for both
        // the PDF and ZIP downloads, and Tailwind v4's oklch-based palette
        // crashes html2canvas's CSS color parser. See lib/pdf-export.ts.
        <div
          id="combined-bill-print-area"
          ref={printAreaRef}
          style={{ background: '#ffffff', color: '#000000', padding: 16, borderRadius: 8 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#4338ca', margin: 0 }}>
              MANDI PERIOD: {result.mandiPeriod === 'tuesday_friday' ? 'Tuesday–Friday' : 'Saturday–Monday'}
            </h2>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {new Date(result.startDate).toLocaleDateString('en-IN')} to{' '}
              {new Date(result.endDate).toLocaleDateString('en-IN')} · Suppliers:{' '}
              {result.supplierNames.join(', ')}
            </div>
          </div>
          {result.retailers.filter(
            (r) => r.weeklyTotal > 0 || r.displayPreviousBalance > 0 || r.paymentAmount > 0
          ).length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '32px 0' }}>
              No retailer activity in this period.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 12,
              }}
            >
              {result.retailers
                .filter((r) => r.weeklyTotal > 0 || r.displayPreviousBalance > 0 || r.paymentAmount > 0)
                .map((r, idx) => (
                  <RetailerCard
                    key={r.customerId}
                    retailer={r}
                    serialNo={idx + 1}
                    dateColumns={result.dateColumns}
                    summarized={summarized}
                    inr={inr}
                    customers={customers}
                    onEntriesSaved={handleGenerate}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
