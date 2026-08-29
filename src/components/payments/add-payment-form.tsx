'use client';

import { useRef, useState, useTransition } from 'react';
import { createPayment } from '@/lib/actions/payments';

type Customer = { id: string; name: string };

export function AddPaymentForm({ customers }: { customers: Customer[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createPayment(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-wrap gap-2 items-end mb-6">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Retailer *</label>
        <select
          name="customerId"
          required
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-48"
        >
          <option value="">Select retailer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Amount *</label>
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          required
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-32"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Date *</label>
        <input
          name="date"
          type="date"
          defaultValue={today}
          required
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Mode</label>
        <select
          name="mode"
          defaultValue="Cash"
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
        >
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Bank">Bank</option>
          <option value="Cheque">Cheque</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Notes</label>
        <input
          name="notes"
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-40"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
      >
        {pending ? 'Adding…' : '+ Add Payment'}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </form>
  );
}
