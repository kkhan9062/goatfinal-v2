'use client';

import { useState, useTransition } from 'react';
import { generateMandiWiseStatement } from '@/lib/actions/mandi-statement';
import type { MandiWiseStatement } from '@/lib/mandi-statement';

const inr = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const periodLabel = (p: string) => (p === 'tuesday_friday' ? 'Tue–Fri' : 'Sat–Mon');

export function MandiStatementView({
  retailerId,
  from,
  to,
}: {
  retailerId: string;
  from?: string;
  to?: string;
}) {
  const [statement, setStatement] = useState<MandiWiseStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateMandiWiseStatement(retailerId, from ?? '', to ?? '');
      if (!result.ok) {
        setError(result.error);
        setStatement(null);
        return;
      }
      setStatement(result.data);
    });
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-sm font-medium text-slate-300">Mandi-wise Periodic Statement</h3>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending || !from || !to}
          className="text-xs rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-3 py-1.5 transition-colors"
        >
          {pending ? 'Generating…' : 'Generate'}
        </button>
        {(!from || !to) && (
          <span className="text-xs text-slate-500">Pick a From/To date range above first.</span>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      {statement && (
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="py-2 px-3 font-medium">Mandi Cycle</th>
                <th className="py-2 px-3 font-medium text-right">Opening</th>
                <th className="py-2 px-3 font-medium text-right">Supply Bill</th>
                <th className="py-2 px-3 font-medium text-right">Paid</th>
                <th className="py-2 px-3 font-medium text-right">Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {statement.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    No transactions in this period.
                  </td>
                </tr>
              ) : (
                statement.rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="py-2 px-3">
                      {periodLabel(row.period)}{' '}
                      <span className="text-slate-500">
                        ({new Date(row.start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}–
                        {new Date(row.end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">₹{inr(row.opening)}</td>
                    <td className="py-2 px-3 text-right">₹{inr(row.billed)}</td>
                    <td className="py-2 px-3 text-right">₹{inr(row.paid)}</td>
                    <td className="py-2 px-3 text-right font-medium">₹{inr(row.closing)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {statement.rows.length > 0 && (
              <tfoot className="bg-slate-900 font-semibold">
                <tr className="border-t border-slate-700">
                  <td className="py-2 px-3">CURRENT BALANCE</td>
                  <td className="py-2 px-3 text-right">₹{inr(statement.openingBalance)}</td>
                  <td className="py-2 px-3 text-right">₹{inr(statement.grandTotalBilled)}</td>
                  <td className="py-2 px-3 text-right">₹{inr(statement.grandTotalPaid)}</td>
                  <td className="py-2 px-3 text-right text-emerald-400">₹{inr(statement.finalBalance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
