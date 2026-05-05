'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function supportContext(pathname: string) {
  const dealId = pathname.split('/platform-v7/deals/')[1]?.split('/')[0];
  if (dealId) return { label: 'Нужна помощь по сделке', href: `/platform-v7/support/new?context=deal&dealId=${dealId}&entity=deal&entityId=${dealId}` };
  if (pathname.startsWith('/platform-v7/documents')) return { label: 'Проблема с документом', href: '/platform-v7/support/new?context=document&entity=document&entityId=DOC-CONTEXT' };
  if (pathname.startsWith('/platform-v7/logistics') || pathname.startsWith('/platform-v7/driver')) return { label: 'Проблема с рейсом', href: '/platform-v7/support/new?context=trip&entity=trip&entityId=TR-CONTEXT' };
  if (pathname.startsWith('/platform-v7/control-tower')) return { label: 'Создать обращение по блокеру', href: '/platform-v7/support/new?context=blocker&entity=blocker&entityId=BLOCKER-CONTEXT' };
  if (pathname.startsWith('/platform-v7/bank')) return { label: 'Проблема с деньгами', href: '/platform-v7/support/new?context=money&entity=money&entityId=MONEY-CONTEXT' };
  if (pathname.startsWith('/platform-v7/disputes')) return { label: 'Обращение по спору', href: '/platform-v7/support/new?context=dispute&entity=dispute&entityId=DISPUTE-CONTEXT' };
  return { label: 'Создать обращение', href: '/platform-v7/support/new' };
}

export function ExecutionHelpEntry() {
  const pathname = usePathname();
  if (pathname.startsWith('/platform-v7/support')) return null;
  const context = supportContext(pathname);

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', maxWidth: 1440, margin: '0 auto 12px' }}>
      <Link href='/platform-v7/support' style={{ textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid var(--pc-border, #E4E6EA)', padding: '8px 12px', color: 'var(--pc-text-primary, #0F1419)', background: 'var(--pc-bg-card, #fff)', fontSize: 12, fontWeight: 900 }}>Поддержка</Link>
      <Link href={context.href} style={{ textDecoration: 'none', minHeight: 38, display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid var(--pc-accent-border, rgba(10,122,95,.22))', padding: '8px 12px', color: 'var(--pc-accent, #0A7A5F)', background: 'var(--pc-accent-bg, rgba(10,122,95,.08))', fontSize: 12, fontWeight: 900 }}>{context.label}</Link>
    </div>
  );
}
