import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { DeleteBillButton } from '@/components/bills/delete-bill-button';

export default async function BillsPage() {
  const user = await requireUser();
  const bills = await prisma.bill.findMany({
    orderBy: { date: 'desc' },
    include: { supplier: { select: { name: true } }, _count: { select: { lineItems: true } } },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Bills</h1>
          <Link
            href="/bills/new"
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            + Create Bill
          </Link>
        </div>
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="py-2 px-3 font-medium">Bill #</th>
                <th className="py-2 px-3 font-medium">Supplier</th>
                <th className="py-2 px-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Goats</th>
                <th className="py-2 px-3 font-medium">Entries</th>
                <th className="py-2 px-3 font-medium text-right">Grand Total</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No bills yet — create one above.
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="border-b border-slate-800 hover:bg-slate-900/50">
                    <td className="py-2 px-3 text-white">
                      <Link href={`/bills/${bill.id}`} className="hover:underline">
                        {bill.billNumber}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{bill.supplier.name}</td>
                    <td className="py-2 px-3 text-slate-400">
                      {bill.date.toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{bill.totalGoatsReceived}</td>
                    <td className="py-2 px-3 text-slate-400">{bill._count.lineItems}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">
                      ₹
                      {Number(bill.grandTotal).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <Link
                        href={`/bills/${bill.id}`}
                        className="text-indigo-400 hover:text-indigo-300 text-xs mr-3"
                      >
                        View
                      </Link>
                      <DeleteBillButton id={bill.id} billNumber={bill.billNumber} />
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
