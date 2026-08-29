'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/actions/suppliers';

type EntryType = 'commission' | 'expense' | 'person_payment' | 'opening_balance';

type AddEntryInput = {
  supplierId: string;
  entryType: EntryType;
  date: string;
  quantity?: number;
  rate?: number;
  amount: number;
  description?: string;
  personName?: string;
};

function todayInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function ManualEntryForms({
  supplierId,
  onAdded,
  addEntry,
}: {
  supplierId: string;
  onAdded: () => void;
  addEntry: (input: AddEntryInput) => Promise<ActionResult>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <CommissionForm supplierId={supplierId} onAdded={onAdded} addEntry={addEntry} />
      <ExpenseForm supplierId={supplierId} onAdded={onAdded} addEntry={addEntry} />
      <PersonPaymentForm supplierId={supplierId} onAdded={onAdded} addEntry={addEntry} />
      <OpeningBalanceForm supplierId={supplierId} onAdded={onAdded} addEntry={addEntry} />
    </div>
  );
}

function FormShell({
  title,
  children,
  onSubmit,
  pending,
  error,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900 p-4">
      <h4 className="text-sm font-medium text-slate-300 mb-3">{title}</h4>
      <div className="flex flex-wrap items-end gap-2">
        {children}
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
        >
          {pending ? 'Adding…' : '+ Add'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

const inputClass = 'rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-white text-sm';

function CommissionForm({ supplierId, onAdded, addEntry }: { supplierId: string; onAdded: () => void; addEntry: (i: AddEntryInput) => Promise<ActionResult> }) {
  const [date, setDate] = useState(todayInputValue());
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const quantity = Number(qty);
    const r = Number(rate);
    if (!(quantity > 0) || !(r > 0)) {
      setError('Enter quantity and rate.');
      return;
    }
    startTransition(async () => {
      const result = await addEntry({
        supplierId,
        entryType: 'commission',
        date,
        quantity,
        rate: r,
        amount: quantity * r,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQty('');
      setRate('');
      onAdded();
    });
  }

  return (
    <FormShell title="Add Commission" onSubmit={submit} pending={pending} error={error}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      <input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputClass} w-20`} />
      <input type="number" placeholder="Rate" value={rate} onChange={(e) => setRate(e.target.value)} className={`${inputClass} w-24`} />
    </FormShell>
  );
}

function ExpenseForm({ supplierId, onAdded, addEntry }: { supplierId: string; onAdded: () => void; addEntry: (i: AddEntryInput) => Promise<ActionResult> }) {
  const [date, setDate] = useState(todayInputValue());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError('Enter an amount.');
      return;
    }
    startTransition(async () => {
      const result = await addEntry({ supplierId, entryType: 'expense', date, amount: amt, description });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount('');
      setDescription('');
      onAdded();
    });
  }

  return (
    <FormShell title="Add Expense" onSubmit={submit} pending={pending} error={error}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-24`} />
      <input type="text" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} w-36`} />
    </FormShell>
  );
}

function PersonPaymentForm({ supplierId, onAdded, addEntry }: { supplierId: string; onAdded: () => void; addEntry: (i: AddEntryInput) => Promise<ActionResult> }) {
  const [date, setDate] = useState(todayInputValue());
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const amt = Number(amount);
    if (!(amt > 0) || !name.trim()) {
      setError('Enter person name and amount.');
      return;
    }
    startTransition(async () => {
      const result = await addEntry({ supplierId, entryType: 'person_payment', date, amount: amt, personName: name.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount('');
      setName('');
      onAdded();
    });
  }

  return (
    <FormShell title="Add Person Payment" onSubmit={submit} pending={pending} error={error}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      <input type="text" placeholder="Person name" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-32`} />
      <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-24`} />
    </FormShell>
  );
}

function OpeningBalanceForm({ supplierId, onAdded, addEntry }: { supplierId: string; onAdded: () => void; addEntry: (i: AddEntryInput) => Promise<ActionResult> }) {
  const [date, setDate] = useState(todayInputValue());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addEntry({
        supplierId,
        entryType: 'opening_balance',
        date,
        amount: Number(amount) || 0,
        description: notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount('');
      setNotes('');
      onAdded();
    });
  }

  return (
    <FormShell title="Save Opening Balance (override)" onSubmit={submit} pending={pending} error={error}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-24`} />
      <input type="text" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} w-36`} />
    </FormShell>
  );
}
