import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LogoutButton } from '@/components/logout-button';

export default async function HomePage() {
  const user = await getCurrentUser();

  // Belt-and-suspenders: middleware already redirects unauthenticated requests
  // based on cookie presence, but this is the real check (validates the
  // session actually exists, is unexpired, and belongs to an active user).
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">🐐 Goat Organ Billing System</h1>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">Logged in as {user.username}</span>
          <LogoutButton />
        </div>
      </div>
      <p className="text-slate-400">
        Foundation is live: auth, database, and deployment pipeline all working. The real
        application pages (Suppliers, Retailers, Bills, Payments, Combined Bill) get built next.
      </p>
    </div>
  );
}
