'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Inventory' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/sales', label: 'Sales' },
  { href: '/invoices', label: 'Invoices' },
] as const;

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        <span className="mr-4 shrink-0 py-3 text-sm font-bold text-slate-900">Stock Tracker</span>
        {LINKS.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${
                active
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
