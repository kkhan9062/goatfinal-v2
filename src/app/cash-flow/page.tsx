import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { CashFlowClient } from '@/components/cash-flow/cash-flow-client';

export default async function CashFlowPage() {
  const user = await requireUser();
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-6xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-1">Supplier Cash Flow</h1>
        <p className="text-sm text-slate-400 mb-6">
          Track what&apos;s owed to a supplier: goats given (transactions), commission/expenses/payments
          deducted, and the running payable balance.
        </p>
        <CashFlowClient suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </div>
  );
}
