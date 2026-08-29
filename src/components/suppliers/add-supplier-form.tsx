'use client';

import { useRef, useState, useTransition } from 'react';
import { createSupplier } from '@/lib/actions/suppliers';

export function AddSupplierForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createSupplier(formData);
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
        <label className="block text-xs text-slate-400 mb-1">Name *</label>
        <input
          name="name"
          required
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-48"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Phone</label>
        <input
          name="phone"
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-36"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Address</label>
        <input
          name="address"
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm w-56"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Bill pattern</label>
        <select
          name="pattern"
          defaultValue="standard"
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-white text-sm"
        >
          <option value="standard">Standard</option>
          <option value="aurangabad">Aurangabad</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 transition-colors"
      >
        {pending ? 'Adding…' : '+ Add Supplier'}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </form>
  );
}
