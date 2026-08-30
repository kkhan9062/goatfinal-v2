import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { NewBillForm, type ExistingBillForEdit } from '@/components/bills/new-bill-form';

export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [bill, suppliers, customers] = await Promise.all([
    prisma.bill.findUnique({
      where: { id },
      include: { lineItems: true },
    }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  if (!bill) notFound();

  const existingBill: ExistingBillForEdit = {
    id: bill.id,
    billNumber: bill.billNumber,
    supplierId: bill.supplierId,
    date: bill.date.toISOString().slice(0, 10),
    totalGoatsReceived: bill.totalGoatsReceived,
    lineItems: bill.lineItems.map((li) => ({
      organ: li.organ as ExistingBillForEdit['lineItems'][number]['organ'],
      customerId: li.customerId,
      quantity: Number(li.quantity),
      rate: Number(li.rate),
      includesKaleji: li.includesKaleji,
      includesVajdi: li.includesVajdi,
    })),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-6">Edit Bill {bill.billNumber}</h1>
        <NewBillForm suppliers={suppliers} customers={customers} existingBill={existingBill} />
      </div>
    </div>
  );
}
