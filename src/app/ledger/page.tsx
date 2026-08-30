import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { getRetailerLedger } from '@/lib/ledger';
import { LedgerFilters } from '@/components/ledger/ledger-filters';
import { LedgerView } from '@/components/ledger/ledger-view';
import { MandiStatementView } from '@/components/ledger/mandi-statement-view';

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ retailerId?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const { retailerId, from, to } = await searchParams;
  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });

  const ledger = retailerId ? await getRetailerLedger(retailerId, from, to) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-1">Retailer Ledger</h1>
        <p className="text-sm text-slate-400 mb-6">
          Full transaction history and running balance for one retailer — the source of truth
          for what they owe and why.
        </p>
        <LedgerFilters
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          retailerId={retailerId}
          from={from}
          to={to}
        />
        {retailerId && !ledger && (
          <p className="text-red-400 mt-4">Retailer not found.</p>
        )}
        {retailerId && ledger && (
          <MandiStatementView retailerId={retailerId} from={from} to={to} />
        )}
        {ledger && <LedgerView ledger={ledger} />}
      </div>
    </div>
  );
}
