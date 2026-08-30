'use client';

import { useState, useTransition } from 'react';
import { updatePayment } from '@/lib/actions/payments';
import { DeletePaymentButton } from '@/components/payments/delete-payment-button';

type Payment = {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string; // yyyy-mm-dd
  mode: string;
  notes: string | null;
};

type Customer = { id: string; name: string };

export function PaymentRow({ payment, customers }: { payment: Payment; customers: Customer[] }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePayment(payment.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-800">
        <td colSpan={6} className="py-2 px-3">
          <form action={handleUpdate} className="flex flex-wrap gap-2 items-center">
            <select
              name="customerId"
              defaultValue={payment.customerId}
              required
              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-40"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={payment.amount}
              required
              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-24"
            />
            <input
              name="date"
              type="date"
              defaultValue={payment.date}
              required
              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm"
            />
            <select
              name="mode"
              defaultValue={payment.mode}
              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm"
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank">Bank</option>
              <option value="Cheque">Cheque</option>
              <option value="Other">Other</option>
            </select>
            <input
              name="notes"
              defaultValue={payment.notes ?? ''}
              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-32"
            />
            <button
              type="submit"
              disabled={pending}
              className="text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-3 py-1"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs rounded-md border border-slate-700 hover:bg-slate-800 text-slate-300 px-3 py-1"
            >
              Cancel
            </button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-900/50">
      <td className="py-2 px-3 text-white">{payment.customerName}</td>
      <td className="py-2 px-3 text-slate-400">{new Date(payment.date).toLocaleDateString('en-IN')}</td>
      <td className="py-2 px-3 text-slate-400">{payment.mode}</td>
      <td className="py-2 px-3 text-slate-400">{payment.notes ?? '—'}</td>
      <td className="py-2 px-3 text-right text-emerald-400">
        ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </td>
      <td className="py-2 px-3 text-right whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="text-xs text-indigo-400 hover:text-indigo-300 mr-3">
          Edit
        </button>
        <DeletePaymentButton id={payment.id} />
      </td>
    </tr>
  );
}
