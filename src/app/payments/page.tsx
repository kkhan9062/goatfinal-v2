import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { AddPaymentForm } from '@/components/payments/add-payment-form';
import { DeletePaymentButton } from '@/components/payments/delete-payment-button';

export default async function PaymentsPage() {
  const user = await requireUser();
  const [payments, customers] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { date: 'desc' },
      include: { customer: { select: { name: true } } },
      take: 200,
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
          <AddPaymentForm customers={customers} />
        )}
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
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-900/50">
                    <td className="py-2 px-3 text-white">{p.customer.name}</td>
                    <td className="py-2 px-3 text-slate-400">{p.date.toLocaleDateString('en-IN')}</td>
                    <td className="py-2 px-3 text-slate-400">{p.mode}</td>
                    <td className="py-2 px-3 text-slate-400">{p.notes ?? '—'}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">
                      ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <DeletePaymentButton id={p.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
