'use client';

import type { RetailerLedger } from '@/lib/ledger';

const inr = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const mandiLabel = (p: string) => (p === 'tuesday_friday' ? 'Tue–Fri' : 'Sat–Mon');

export function LedgerView({ ledger }: { ledger: RetailerLedger }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{ledger.customer.name}</h2>
        <div className="text-sm text-slate-400">
          {[ledger.customer.phone, ledger.customer.address].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
          <div className="text-xs text-slate-400 mb-1">Total Billed (all time)</div>
          <div className="text-xl font-semibold">₹{inr(ledger.totalBilled)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
          <div className="text-xs text-slate-400 mb-1">Total Paid (all time)</div>
          <div className="text-xl font-semibold">₹{inr(ledger.totalPaid)}</div>
        </div>
        <div
          className={`rounded-lg border p-4 text-center ${
            ledger.pending > 0 ? 'border-amber-800 bg-amber-950/40' : 'border-emerald-800 bg-emerald-950/40'
          }`}
        >
          <div className="text-xs text-slate-400 mb-1">Pending Balance</div>
          <div className="text-xl font-semibold">₹{inr(ledger.pending)}</div>
        </div>
      </div>

      <h3 className="text-sm font-medium text-slate-300 mb-2">Transactions</h3>
      <div className="border border-slate-800 rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="py-2 px-3 font-medium">Date</th>
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium">Description</th>
              <th className="py-2 px-3 font-medium text-right">Billed</th>
              <th className="py-2 px-3 font-medium text-right">Paid</th>
              <th className="py-2 px-3 font-medium text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  No transactions found.
                </td>
              </tr>
            ) : (
              ledger.transactions.map((t, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="py-2 px-3">{new Date(t.date).toLocaleDateString('en-IN')}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        t.type === 'bill' ? 'bg-indigo-900 text-indigo-300' : 'bg-emerald-900 text-emerald-300'
                      }`}
                    >
                      {t.type === 'bill' ? 'Bill' : 'Payment'}
                    </span>
                  </td>
                  <td className="py-2 px-3">{t.description}</td>
                  <td className="py-2 px-3 text-right">{t.debit > 0 ? `₹${inr(t.debit)}` : '—'}</td>
                  <td className="py-2 px-3 text-right">{t.credit > 0 ? `₹${inr(t.credit)}` : '—'}</td>
                  <td className="py-2 px-3 text-right font-medium">₹{inr(t.runningBalance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="text-sm font-medium text-slate-300 mb-2">Saved Balance Checkpoints</h3>
      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="py-2 px-3 font-medium">Date</th>
              <th className="py-2 px-3 font-medium">Mandi Period</th>
              <th className="py-2 px-3 font-medium">Source</th>
              <th className="py-2 px-3 font-medium">Notes</th>
              <th className="py-2 px-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledger.balanceHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  No saved checkpoints yet — generate a Combined Bill or an individual bill to
                  create one.
                </td>
              </tr>
            ) : (
              ledger.balanceHistory.map((b, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="py-2 px-3">{new Date(b.balanceDate).toLocaleDateString('en-IN')}</td>
                  <td className="py-2 px-3">{mandiLabel(b.mandiPeriod)}</td>
                  <td className="py-2 px-3">{b.isManual ? 'Manual' : 'Auto'}</td>
                  <td className="py-2 px-3 text-slate-400">{b.notes ?? '—'}</td>
                  <td className="py-2 px-3 text-right font-medium">₹{inr(b.balanceAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
