import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { CombinedBillClient } from '@/components/combined-bill/combined-bill-client';

export default async function CombinedBillPage() {
  const user = await requireUser();
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });

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
        <CombinedBillClient suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </div>
  );
}
