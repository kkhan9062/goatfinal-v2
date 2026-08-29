import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { getRetailerPricingHistory } from '@/lib/actions/pricing-history';
import { PricingHistoryFilters } from '@/components/pricing-history/pricing-history-filters';

const ORGAN_LABELS: Record<string, string> = {
  mundi: '🥩 Mundi',
  kaleji: '🫁 Kaleji',
  paya: '🦵 Paya',
  vajdi: '💪 Vajdi',
  gurda: '🍖 Gurda',
};

export default async function PricingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ retailerId?: string }>;
}) {
  const user = await requireUser();
  const { retailerId } = await searchParams;
  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });

  const groups = retailerId ? await getRetailerPricingHistory(retailerId) : [];
  // Rates display as whole rupees (₹200, not ₹200.00) — this business always
  // quotes prices as whole numbers, unlike currency totals elsewhere.
  const inr = (n: number) => Math.round(n).toLocaleString('en-IN');

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-1">Pricing History</h1>
        <p className="text-sm text-slate-400 mb-6">
          Every rate ever charged to a retailer, per organ — the raw data behind the AI pricing
          suggestion shown when creating a bill.
        </p>
        <PricingHistoryFilters
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          retailerId={retailerId}
        />
        {retailerId && groups.length === 0 && (
          <p className="text-slate-500">No pricing history for this retailer yet.</p>
        )}
        {groups.map((group) => (
          <div key={group.organType} className="mb-6">
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              {ORGAN_LABELS[group.organType] ?? group.organType}
            </h3>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-left text-slate-400">
                  <tr>
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((e) => (
                    <tr key={e.id} className="border-t border-slate-800">
                      <td className="py-2 px-3">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                      <td className="py-2 px-3">₹{inr(e.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
