'use client';

import { useState, useTransition } from 'react';
import { updateCustomer, deleteCustomer } from '@/lib/actions/customers';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

export function CustomerRow({ customer }: { customer: Customer }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateCustomer(customer.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete retailer "${customer.name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-800">
        <td colSpan={4} className="py-2 px-3">
          <form action={handleUpdate} className="flex flex-wrap gap-2 items-center">
            <input
              name="name"
              defaultValue={customer.name}
              required
              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-40"
            />
            <input
              name="phone"
              defaultValue={customer.phone ?? ''}
              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-32"
            />
            <input
              name="address"
              defaultValue={customer.address ?? ''}
              className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm w-48"
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
      <td className="py-2 px-3 text-white">{customer.name}</td>
      <td className="py-2 px-3 text-slate-400">{customer.phone ?? '—'}</td>
      <td className="py-2 px-3 text-slate-400">{customer.address ?? '—'}</td>
      <td className="py-2 px-3 text-right whitespace-nowrap">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-indigo-400 hover:text-indigo-300 mr-3"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
        >
          Delete
        </button>
        {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
      </td>
    </tr>
  );
}
