'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getShellPolicy, inferPlatformRoleFromPath } from '@/lib/platform-v7/shell-role-policy';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

export const WORK_LINKS = [
  { href: '/platform-v7/control-tower', label: 'Центр', note: 'блокеры' },
  { href: '/platform-v7/deals', label: 'Сделки', note: 'исполнение' },
  { href: '/platform-v7/lots', label: 'Лоты/RFQ', note: 'запросы' },
  { href: '/platform-v7/logistics', label: 'Рейсы', note: 'груз' },
  { href: '/platform-v7/money', label: 'Деньги', note: 'банк' },
  { href: '/platform-v7/documents', label: 'Документы', note: 'основания' },
  { href: '/platform-v7/disputes', label: 'Споры', note: 'удержания' },
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
    <nav aria-label='Рабочие разделы исполнения сделки' data-testid='platform-v7-work-route-nav' style={nav}>
      <div style={railHeader} aria-hidden='true'>
        <span style={railTitle}>Контур</span>
      </div>
      <div className='pc-v4-work-route-links-wrap' style={linksRow}>
        {WORK_LINKS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={item.note}
              style={{ ...link, ...(active ? activeLink : null) }}
            >
              <span style={linkLabel}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const nav = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center',
  overflowX: 'hidden',
  padding: 6,
  margin: '0 0 12px',
  borderRadius: 20,
  border: '1px solid var(--pc-border)',
  background: 'var(--pc-bg-card)',
  boxShadow: 'var(--pc-shadow-sm)',
} as const;

const railHeader = {
  display: 'grid',
  gap: 1,
  minWidth: 108,
  padding: '0 10px',
  borderRight: '1px solid var(--pc-border)',
} as const;

const railTitle = {
  color: 'var(--pc-text-primary)',
  fontSize: 12,
  fontWeight: 950,
  lineHeight: 1.2,
} as const;

const railCaption = {
  color: 'var(--pc-text-muted)',
  fontSize: 10,
  fontWeight: 750,
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
} as const;

const linksRow = {
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
} as const;

const link = {
  flex: '0 0 auto',
  textDecoration: 'none',
  minHeight: 40,
  display: 'grid',
  alignContent: 'center',
  justifyItems: 'center',
  gap: 1,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid transparent',
  color: 'var(--pc-text-secondary)',
  background: 'transparent',
} as const;

const linkLabel = {
  color: 'inherit',
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
} as const;

const linkNote = {
  color: 'var(--pc-text-muted)',
  fontSize: 10,
  fontWeight: 750,
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
} as const;

const activeLink = {
  background: 'var(--pc-accent-bg)',
  border: '1px solid var(--pc-accent-border)',
  color: 'var(--pc-accent-strong)',
} as const;