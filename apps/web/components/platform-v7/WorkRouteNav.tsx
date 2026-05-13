'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getShellPolicy, inferPlatformRoleFromPath } from '@/lib/platform-v7/shell-role-policy';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const WORK_LINKS = [
  { href: '/platform-v7/control-tower', label: 'Центр управления' },
  { href: '/platform-v7/deals', label: 'Сделки' },
  { href: '/platform-v7/lots', label: 'Лоты и запросы' },
  { href: '/platform-v7/seller/batches', label: 'Партии' },
  { href: '/platform-v7/proposals', label: 'Предложения' },
  { href: '/platform-v7/logistics', label: 'Логистика' },
  { href: '/platform-v7/money', label: 'Деньги' },
  { href: '/platform-v7/documents', label: 'Документы' },
  { href: '/platform-v7/disputes', label: 'Споры' },
  { href: '/platform-v7/connectors', label: 'Подключения' },
  { href: '/platform-v7/support', label: 'Поддержка' },
] as const;

const BROAD_WORK_NAV_ROLES = new Set<PlatformRole>(['operator', 'executive']);

export function canShowWorkRouteNav(storedRole: PlatformRole, pathname: string): boolean {
  const routeRole = inferPlatformRoleFromPath(pathname, storedRole);
  const shellPolicy = getShellPolicy(routeRole, pathname);

  return shellPolicy === 'operator' && BROAD_WORK_NAV_ROLES.has(routeRole);
}

export function WorkRouteNav() {
  const pathname = usePathname();
  const role = usePlatformV7RStore((state) => state.role);
  if (!canShowWorkRouteNav(role, pathname)) return null;

  return (
    <nav aria-label='Рабочие разделы platform-v7' data-testid='platform-v7-work-route-nav' style={nav}>
      {WORK_LINKS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} style={{ ...link, ...(active ? activeLink : null) }}>{item.label}</Link>;
      })}
    </nav>
  );
}

const nav = { display: 'flex', gap: 8, overflowX: 'auto', padding: '0 0 12px', margin: '0 0 12px', WebkitOverflowScrolling: 'touch' } as const;
const link = { flex: '0 0 auto', textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', borderRadius: 999, background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-secondary)', fontSize: 12, fontWeight: 850 } as const;
const activeLink = { background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent-strong)' } as const;
