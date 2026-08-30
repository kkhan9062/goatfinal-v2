import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { PaymentEntry } from '@/components/payments/payment-entry';
import { PaymentRow } from '@/components/payments/payment-row';
import { PaymentFilters } from '@/components/payments/payment-filters';
import type { Prisma } from '@prisma/client';

// Payment.date is a @db.Date column (no time/timezone — see lib/balance.ts),
// round-tripped by Prisma as a UTC-midnight Date, so this must read it back
// with UTC getters to fill the editable date input with the correct day
// regardless of server timezone.
function toDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; retailerId?: string; mode?: string }>;
}) {
  const user = await requireUser();
  const { from, to, retailerId, mode } = await searchParams;

  const where: Prisma.PaymentWhereInput = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (retailerId) where.customerId = retailerId;
  if (mode) where.mode = mode as Prisma.EnumPaymentModeFilter['equals'];

  const [payments, customers] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { customer: { select: { id: true, name: true } } },
      take: 500,
    }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-6">Payments</h1>
        {customers.length === 0 ? (
          <p className="text-slate-400">Add a retailer first before recording payments.</p>
        ) : (
          <PaymentEntry customers={customers} />
        )}
        <PaymentFilters
          customers={customers}
          from={from}
          to={to}
          retailerId={retailerId}
          mode={mode}
        />
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="py-2 px-3 font-medium">Retailer</th>
                <th className="py-2 px-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Mode</th>
                <th className="py-2 px-3 font-medium">Notes</th>
                <th className="py-2 px-3 font-medium text-right">Amount</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No payments found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={{
                      id: p.id,
                      customerId: p.customerId,
                      customerName: p.customer.name,
                      amount: Number(p.amount),
                      date: toDateKey(p.date),
                      mode: p.mode,
                      notes: p.notes,
                    }}
                    customers={customers}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
