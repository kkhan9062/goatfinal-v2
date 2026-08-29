'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm rounded-md border border-slate-700 hover:bg-slate-800 px-3 py-1.5 text-slate-300 transition-colors"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
