'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function MobileNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname() || '/';
  return (
    <nav className="nav-chip-row" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={`nav-chip ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : 'muted'}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
