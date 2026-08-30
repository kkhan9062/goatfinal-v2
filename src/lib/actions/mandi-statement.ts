'use server';

import { requireUser } from '@/lib/auth';
import { getMandiWiseStatement, type MandiWiseStatement } from '@/lib/mandi-statement';

export async function generateMandiWiseStatement(
  customerId: string,
  from: string,
  to: string
): Promise<{ ok: true; data: MandiWiseStatement } | { ok: false; error: string }> {
  await requireUser();

  if (!customerId) return { ok: false, error: 'Select a retailer first.' };
  if (!from || !to) return { ok: false, error: 'Select both a from and to date.' };

  const data = await getMandiWiseStatement(customerId, from, to);
  if (!data) return { ok: false, error: 'Retailer not found.' };

  return { ok: true, data };
}
