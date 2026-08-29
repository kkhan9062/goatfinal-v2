import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { NewBillForm } from '@/components/bills/new-bill-form';

export default async function NewBillPage() {
  const user = await requireUser();
  const [suppliers, customers] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-6">Create Bill</h1>
        {suppliers.length === 0 || customers.length === 0 ? (
          <p className="text-slate-400">
            You need at least one supplier and one retailer before creating a bill. Add them from
            the Suppliers and Retailers pages first.
          </p>
        ) : (
          <NewBillForm suppliers={suppliers} customers={customers} />
        )}
      </div>
    </div>
  );
}
