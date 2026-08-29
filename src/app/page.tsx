import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Nav } from '@/components/nav';

export default async function HomePage() {
  const user = await getCurrentUser();

  // Belt-and-suspenders: middleware already redirects unauthenticated requests
  // based on cookie presence, but this is the real check (validates the
  // session actually exists, is unexpired, and belongs to an active user).
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Nav username={user.username} />
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-2">🐐 Goat Organ Billing System</h1>
        <p className="text-slate-400 mb-8">
          Payments and Combined Bill get built next.
        </p>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <Link
            href="/suppliers"
            className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-4 transition-colors"
          >
            <div className="text-lg font-medium">Suppliers</div>
            <div className="text-sm text-slate-400">Manage supplier records</div>
          </Link>
          <Link
            href="/customers"
            className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-4 transition-colors"
          >
            <div className="text-lg font-medium">Retailers</div>
            <div className="text-sm text-slate-400">Manage retailer records</div>
          </Link>
          <Link
            href="/bills"
            className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-4 transition-colors"
          >
            <div className="text-lg font-medium">Bills</div>
            <div className="text-sm text-slate-400">Create and view bills</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
