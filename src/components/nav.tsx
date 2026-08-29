import Link from 'next/link';
import { LogoutButton } from '@/components/logout-button';

const links = [
  { href: '/', label: 'Home' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/customers', label: 'Retailers' },
  { href: '/bills', label: 'Bills' },
  { href: '/combined-bill', label: 'Combined Bill' },
  { href: '/payments', label: 'Payments' },
];

export function Nav({ username }: { username: string }) {
  return (
    <div className="border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-white">🐐 Goat Billing</span>
          <nav className="flex gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{username}</span>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
