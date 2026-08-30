import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { CombinedBillClient } from '@/components/combined-bill/combined-bill-client';

// generateCombinedBill now resolves a balance for EVERY registered retailer
// (not just ones who bought this period — see the allCustomers comment in
// lib/actions/combined-bill.ts), which measured live at ~9.9s for a real
// 100-retailer period. That's dangerously close to Vercel's 10s serverless
// default with almost no margin as more retailers are added — this
// route-segment config raises the ceiling for this page's Server Actions.
export const maxDuration = 60;

export default async function CombinedBillPage() {
  const user = await requireUser();
  const [suppliers, customers] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-6xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-1">Combined Bill</h1>
        <p className="text-sm text-slate-400 mb-6">
          Generate a mandi-period statement across retailers for one or more suppliers. Previous
          balance is resolved from each retailer&apos;s saved balance history, and the new closing
          balance is auto-saved for next period.
        </p>
        <CombinedBillClient
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}
