'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ExecutionHelpEntry() {
  const pathname = usePathname();
  if (pathname.startsWith('/platform-v7/support')) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', maxWidth: 1440, margin: '0 auto 12px' }}>
      <Link href='/platform-v7/support' style={{ textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', padding: '8px 12px', color: 'var(--pc-text-primary, #0F1419)', background: 'var(--pc-bg-card, #fff)', fontSize: 12, fontWeight: 900 }}>Поддержка</Link>
      <Link href='/platform-v7/support/new' style={{ textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid var(--pc-accent-border, rgba(10,122,95,.22))', padding: '8px 12px', color: 'var(--pc-accent, #0A7A5F)', background: 'var(--pc-accent-bg, rgba(10,122,95,.08))', fontSize: 12, fontWeight: 900 }}>Создать обращение</Link>
    </div>
  );
}
