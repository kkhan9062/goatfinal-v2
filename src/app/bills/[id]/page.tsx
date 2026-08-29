import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { BillDetailView } from '@/components/bills/bill-detail-view';

const ORGAN_LABELS: Record<string, string> = {
  mundi: '🥩 Mundi',
  kaleji: '🫁 Kaleji',
  paya: '🦵 Paya',
  vajdi: '💪 Vajdi',
  gurda: '🍖 Gurda',
};

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      supplier: true,
      lineItems: { include: { customer: true }, orderBy: { customer: { name: 'asc' } } },
    },
  });

  if (!bill) notFound();

  const rows = bill.lineItems.map((li) => ({
    id: li.id,
    organ: ORGAN_LABELS[li.organ] ?? li.organ,
    customerName: li.customer.name,
    quantity: Number(li.quantity),
    rate: Number(li.rate),
    total: Number(li.total),
    includesKaleji: li.includesKaleji,
    includesVajdi: li.includesVajdi,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-3xl mx-auto p-8">
        <BillDetailView
          billNumber={bill.billNumber}
          supplierName={bill.supplier.name}
          date={bill.date.toISOString()}
          totalGoatsReceived={bill.totalGoatsReceived}
          grandTotal={Number(bill.grandTotal)}
          rows={rows}
        />
      </div>
    </div>
  );
}
