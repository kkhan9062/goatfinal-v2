'use client';

import { useState } from 'react';
import { AddPaymentForm } from '@/components/payments/add-payment-form';
import { BulkPaymentForm } from '@/components/payments/bulk-payment-form';

type Customer = { id: string; name: string };

export function PaymentEntry({ customers }: { customers: Customer[] }) {
  const [bulkMode, setBulkMode] = useState(false);

  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm text-slate-300 mb-3">
        <input
          type="checkbox"
          checked={bulkMode}
          onChange={(e) => setBulkMode(e.target.checked)}
          className="accent-indigo-500"
        />
        Multiple payments at once
      </label>
      {bulkMode ? <BulkPaymentForm customers={customers} /> : <AddPaymentForm customers={customers} />}
    </div>
  );
}
