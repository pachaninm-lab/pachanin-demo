import Link from 'next/link';
import type { ReactNode } from 'react';

const bankLinks = [
  { href: '/platform-v7/bank', label: 'Банковый контур' },
  { href: '/platform-v7/bank/release-safety', label: 'Проверка выплаты' },
  { href: '/platform-v7/bank/payment-basis', label: 'Передать основание банку' },
] as const;

export default function BankLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <nav aria-label='Банковские действия' style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {bankLinks.map((link) => (
          <Link key={link.href} href={link.href} style={{ minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', background: 'var(--pc-bg-card, #fff)', color: 'var(--pc-text-primary, #0F1419)', padding: '8px 12px', textDecoration: 'none', fontSize: 12, fontWeight: 900 }}>
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
