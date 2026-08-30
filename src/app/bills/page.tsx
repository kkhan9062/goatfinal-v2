import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { DeleteBillButton } from '@/components/bills/delete-bill-button';
import { getMandiCycleRange } from '@/lib/balance';

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mandiPeriodLabel(period: 'tuesday_friday' | 'saturday_monday'): string {
  return period === 'tuesday_friday' ? 'Tuesday–Friday' : 'Saturday–Monday';
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function BillsPage() {
  const user = await requireUser();
  const bills = await prisma.bill.findMany({
    orderBy: { date: 'desc' },
    include: { supplier: { select: { name: true } }, _count: { select: { lineItems: true } } },
  });

  // Group bills by mandi cycle (Tue-Fri / Sat-Mon) so the list reads as
  // "one section per mandi period" instead of an undifferentiated flat
  // chronological list — each period is exactly what gets billed together
  // on a Combined Bill / mandi-wise statement.
  type Group = { key: string; start: Date; end: Date; period: 'tuesday_friday' | 'saturday_monday'; bills: typeof bills };
  const groups: Group[] = [];
  const groupByKey = new Map<string, Group>();
  for (const bill of bills) {
    const range = getMandiCycleRange(bill.date);
    const key = dateKey(range.start);
    let group = groupByKey.get(key);
    if (!group) {
      const period = range.start.getDay() >= 2 && range.start.getDay() <= 5 ? 'tuesday_friday' : 'saturday_monday';
      group = { key, start: range.start, end: range.end, period, bills: [] };
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.bills.push(bill);
  }
  groups.sort((a, b) => b.start.getTime() - a.start.getTime());

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

        {bills.length === 0 ? (
          <div className="border border-slate-800 rounded-lg py-6 text-center text-slate-500">
            No bills yet — create one above.
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => {
              const groupTotal = group.bills.reduce((sum, b) => sum + Number(b.grandTotal), 0);
              return (
                <div key={group.key}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          group.period === 'tuesday_friday'
                            ? 'bg-indigo-900 text-indigo-300'
                            : 'bg-emerald-900 text-emerald-300'
                        }`}
                      >
                        {mandiPeriodLabel(group.period)}
                      </span>
                      <span className="text-sm text-slate-400">
                        {formatShort(group.start)} – {formatShort(group.end)}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400">
                      {group.bills.length} bill{group.bills.length === 1 ? '' : 's'} · ₹
                      {groupTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
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
                        {group.bills.map((bill) => (
                          <tr key={bill.id} className="border-b border-slate-800 last:border-b-0 hover:bg-slate-900/50">
                            <td className="py-2 px-3 text-white">
                              <Link href={`/bills/${bill.id}`} className="hover:underline">
                                {bill.billNumber}
                              </Link>
                            </td>
                            <td className="py-2 px-3 text-slate-300">{bill.supplier.name}</td>
                            <td className="py-2 px-3 text-slate-400">{bill.date.toLocaleDateString('en-IN')}</td>
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
                              <Link
                                href={`/bills/${bill.id}/edit`}
                                className="text-amber-400 hover:text-amber-300 text-xs mr-3"
                              >
                                Edit
                              </Link>
                              <DeleteBillButton id={bill.id} billNumber={bill.billNumber} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
