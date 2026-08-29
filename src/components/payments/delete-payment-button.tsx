'use client';

import { useTransition } from 'react';
import { deletePayment } from '@/lib/actions/payments';

export function DeletePaymentButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm('Delete this payment? This cannot be undone.')) return;
    startTransition(() => {
      deletePayment(id);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60"
    >
      Delete
    </button>
  );
}
