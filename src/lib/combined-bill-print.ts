// Direct port of v1's printCombinedBill() output (combined-bill-module.js):
// a dense 3-column layout with small fonts and black cell borders, built
// specifically for print/PDF — separate from the comfortable on-screen
// 2-column view, the same way v1 kept them separate (the on-screen page
// used Bootstrap-sized cards; print opened a fresh window with its own
// compact stylesheet). Printing the on-screen layout as-is would waste
// paper on a real bill run with 40+ retailer cards.

import type { CombinedBillResult, CombinedBillRetailer } from '@/lib/actions/combined-bill';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const inr = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildRetailerCardHtml(
  retailer: CombinedBillRetailer,
  serialNo: number,
  dateColumns: string[],
  summarized: boolean
): string {
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
          byRate.set(rateKey, { quantity: delivery.quantity, rate: delivery.rate, total: delivery.total });
        }
      }
    }
    for (const d of byRate.values()) rows.push({ label: '—', quantity: d.quantity, rate: d.rate, total: d.total });
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

  const rowsHtml = rows.length
    ? rows
        .map(
          (r) =>
            `<tr><td>${r.label}</td><td>${r.quantity}</td><td>${Math.round(r.rate)}</td><td>${inr(r.total)}</td></tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="center">No entries</td></tr>`;

  return `
    <div class="retailer-card">
      <table>
        <thead>
          <tr><th colspan="4" class="name-row">${serialNo}. ${escapeHtml(retailer.name)}</th></tr>
          <tr class="head-row"><th>Date</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="summary-row"><td colspan="3">Current Mandi Total</td><td>${inr(retailer.weeklyTotal)}</td></tr>
          <tr class="summary-row"><td colspan="3">Previous Balance</td><td>${inr(retailer.displayPreviousBalance)}</td></tr>
          <tr class="final-row"><td colspan="3">New Balance</td><td>${inr(retailer.newBalance)}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Full standalone print/PDF document — same technique v1 used: build the
 * HTML as a string, independent of whatever's currently on screen, sized
 * and styled specifically for paper.
 *
 * `layout` picks how the 3-column density is achieved:
 * - 'css-columns': real CSS `column-count`, exactly like v1's
 *   printCombinedBill(). Works perfectly for native browser print (a real
 *   layout engine), which is the only place v1 ever used it.
 * - 'flex-columns': the same visual result via three explicit column
 *   `<div>`s with cards distributed round-robin, for the html2canvas-based
 *   PDF download — CSS multi-column layout is a well-known gap in
 *   html2canvas/html2canvas-pro (confirmed live: capturing a `column-count`
 *   container threw "wrong PNG signature" from a malformed/empty capture),
 *   so the PDF path needs a layout it can actually render, not the same
 *   CSS feature v1 only ever fed to a real browser.
 */
export function buildCombinedBillPrintHtml(
  data: CombinedBillResult,
  summarized: boolean,
  layout: 'css-columns' | 'flex-columns' = 'css-columns'
): string {
  const activeRetailers = data.retailers.filter(
    (r) => r.weeklyTotal > 0 || r.displayPreviousBalance > 0 || r.paymentAmount > 0
  );
  const periodLabel = data.mandiPeriod === 'tuesday_friday' ? 'Tuesday-Friday' : 'Saturday-Monday';

  const cardsBlock =
    layout === 'flex-columns'
      ? (() => {
          const COLUMN_COUNT = 3;
          const columns: string[][] = Array.from({ length: COLUMN_COUNT }, () => []);
          activeRetailers.forEach((r, i) => {
            columns[i % COLUMN_COUNT].push(buildRetailerCardHtml(r, i + 1, data.dateColumns, summarized));
          });
          const columnsHtml = columns
            .map((cards) => `<div class="flex-col">${cards.join('')}</div>`)
            .join('');
          return `<div class="cards-flex">${columnsHtml}</div>`;
        })()
      : `<div class="cards-columns">${activeRetailers
          .map((r, i) => buildRetailerCardHtml(r, i + 1, data.dateColumns, summarized))
          .join('')}</div>`;

  return `
    <div class="compact-bill-container">
      <div class="combined-bill-header">
        <h2>MANDI PERIOD: ${periodLabel}</h2>
        <div class="combined-bill-info">
          ${new Date(data.startDate).toLocaleDateString('en-IN')} to ${new Date(data.endDate).toLocaleDateString('en-IN')}
          &middot; Suppliers: ${escapeHtml(data.supplierNames.join(', '))}
        </div>
      </div>
      ${cardsBlock}
    </div>
  `;
}

/** v1's exact print stylesheet (printCombinedBill): 3-column dense layout,
 * 8-9.5px fonts, black 1px cell borders, A4 portrait with 5mm margins,
 * page-break-avoid per card so one retailer's bill never splits across
 * pages. */
export const COMBINED_BILL_PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 5px; margin: 0; color: #000; background: #fff; }
  .compact-bill-container { font-size: 8px; padding: 2px; }
  .cards-columns { column-count: 3; column-gap: 4px; }
  .cards-flex { display: flex; align-items: flex-start; gap: 4px; }
  .flex-col { flex: 1 1 0; min-width: 0; }
  .retailer-card {
    display: inline-block;
    width: 100%;
    padding: 0 2px;
    margin-bottom: 4px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 0; }
  th, td { border: 1px solid #000; padding: 2px; text-align: left; }
  th { background-color: #f0f0f0; font-weight: bold; font-size: 9.5px; }
  .name-row { background: #6366f1; color: #fff; }
  .summary-row { background: #f9f9f9; font-weight: bold; }
  .final-row { background: #d4edda; font-weight: bold; color: #155724; }
  .center { text-align: center; color: #666; }
  .combined-bill-header { text-align: center; margin-bottom: 10px; }
  .combined-bill-header h2 { margin: 3px 0; color: #0066cc; font-size: 18px; font-weight: bold; }
  .combined-bill-info { font-size: 9px; margin-bottom: 8px; color: #333; }
  @media print {
    @page { size: A4 portrait; margin: 5mm; }
    body { padding: 2px; }
  }
`;
