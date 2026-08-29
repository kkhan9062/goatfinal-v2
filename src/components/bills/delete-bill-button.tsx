'use client';

import { useTransition } from 'react';
import { deleteBill } from '@/lib/actions/bills';

export function DeleteBillButton({ id, billNumber }: { id: string; billNumber: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete bill ${billNumber}? This cannot be undone.`)) return;
    startTransition(() => {
      deleteBill(id);
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
