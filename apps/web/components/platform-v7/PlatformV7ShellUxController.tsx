'use client';

import * as React from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  FileText,
  Gavel,
  Home,
  Landmark,
  Package,
  Route,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import {
  platformV7DrawerNavByRole,
  platformV7NavByRole,
  platformV7RoleCanOpenHref,
  platformV7RoleRoute,
  type PlatformV7RoleNavItem,
} from '@/lib/platform-v7/shellRoutes';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './PlatformV7ShellUxController.module.css';

const PUBLIC_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
]);

const ROLE_NEUTRAL_PATHS = new Set([
  '/platform-v7/notifications',
]);

function normalize(pathname: string): string {
  return pathname.split('?')[0].split('#')[0].replace(/\/$/, '') || '/platform-v7';
}

function activePath(pathname: string, href: string): boolean {
  const path = normalize(pathname);
  const target = normalize(href);
  return path === target || path.startsWith(`${target}/`);
}

function navKey(item: PlatformV7RoleNavItem): string {
  return normalize(item.href);
}

function uniqueAllowedNavigation(role: PlatformRole, items: PlatformV7RoleNavItem[]): PlatformV7RoleNavItem[] {
  const seen = new Set<string>();
  const result: PlatformV7RoleNavItem[] = [];

  for (const item of items) {
    const key = navKey(item);
    if (item.label === 'Ещё' || seen.has(key) || !platformV7RoleCanOpenHref(role, item.href)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function primaryNavigation(role: PlatformRole): PlatformV7RoleNavItem[] {
  return uniqueAllowedNavigation(role, platformV7NavByRole(role)).slice(0, 4);
}

function extraNavigation(role: PlatformRole, primary: PlatformV7RoleNavItem[]): PlatformV7RoleNavItem[] {
  const primaryTargets = new Set(primary.map(navKey));
  return uniqueAllowedNavigation(role, platformV7DrawerNavByRole(role))
    .filter((item) => !primaryTargets.has(navKey(item)));
}

function iconFor(item: PlatformV7RoleNavItem, index: number): LucideIcon {
  const text = `${item.label} ${item.note ?? ''} ${item.href}`.toLowerCase();
  if (index === 0 || text.includes('главн') || text.includes('кабинет') || text.includes('сводка') || text.includes('центр')) return Home;
  if (text.includes('банк') || text.includes('деньг') || text.includes('расчёт') || text.includes('резерв')) return Landmark;
  if (text.includes('рейс') || text.includes('логист') || text.includes('водител') || text.includes('маршрут')) return text.includes('маршрут') ? Route : Truck;
  if (text.includes('спор') || text.includes('арбитр') || text.includes('решение')) return Gavel;
  if (text.includes('риск') || text.includes('допуск') || text.includes('качество') || text.includes('факт')) return ShieldCheck;
  if (text.includes('лот') || text.includes('парт') || text.includes('аукцион')) return Package;
  if (text.includes('документ')) return FileText;
  return ClipboardList;
}

function closeLegacyDrawer(): void {
  document.querySelector<HTMLButtonElement>('.pc-v4-drawer button[aria-label="Закрыть меню"]')?.click();
}

function countClass(count: number): string {
  if (count <= 2) return styles.twoItems;
  if (count === 3) return styles.threeItems;
  return styles.fourItems;
}

function NavigationLink({
  item,
  index,
  pathname,
  className,
  onClick,
}: {
  item: PlatformV7RoleNavItem;
  index: number;
  pathname: string;
  className: string;
  onClick?: () => void;
}) {
  const Icon = iconFor(item, index);
  const active = activePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={className}
      data-active={active ? 'true' : 'false'}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className={styles.navIcon}><Icon aria-hidden='true' /></span>
      <span className={styles.navCopy}>
        <strong>{item.label}</strong>
        {item.note ? <span>{item.note}</span> : null}
      </span>
    </Link>
  );
}

export function PlatformV7ShellUxController({ role }: { role: PlatformRole }) {
  const pathname = usePathname() ?? '/platform-v7';
  const [drawerNode, setDrawerNode] = React.useState<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const roleHome = platformV7RoleRoute(role);
  const primary = React.useMemo(() => primaryNavigation(role), [role]);
  const extra = React.useMemo(() => extraNavigation(role, primary), [primary, role]);
  const normalizedPath = normalize(pathname);
  const publicPath = PUBLIC_PATHS.has(normalizedPath);
  const roleNeutralPath = ROLE_NEUTRAL_PATHS.has(normalizedPath);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    setDrawerNode(document.querySelector<HTMLElement>('.pc-v4-drawer'));
  }, [pathname]);

  React.useEffect(() => {
    if (roleNeutralPath) return;
    document.querySelectorAll<HTMLAnchorElement>('.pc-v4-header .pc-v4-brand, .pc-v4-drawer .pc-v4-brand').forEach((item) => {
      item.href = roleHome;
      item.setAttribute('aria-label', 'Прозрачная Цена — в мой кабинет');
    });
  }, [pathname, roleHome, roleNeutralPath]);

  const showShellControls = mounted && !publicPath && !roleNeutralPath;
  const closeDrawer = () => window.setTimeout(closeLegacyDrawer, 0);

  return (
    <>
      {showShellControls && drawerNode ? createPortal(
        <div className={styles.drawerNavigation}>
          <section className={styles.drawerSection} aria-labelledby='primary-role-navigation'>
            <h2 id='primary-role-navigation'>Основное</h2>
            <nav className={styles.drawerLinks} aria-label='Основные действия кабинета'>
              {primary.map((item, index) => (
                <NavigationLink
                  key={`${navKey(item)}:${item.label}`}
                  item={item}
                  index={index}
                  pathname={pathname}
                  className={styles.drawerLink}
                  onClick={closeDrawer}
                />
              ))}
            </nav>
          </section>

          {extra.length > 0 ? (
            <details className={styles.moreSections}>
              <summary>Все разделы</summary>
              <nav className={styles.drawerLinks} aria-label='Все доступные разделы кабинета'>
                {extra.map((item, index) => (
                  <NavigationLink
                    key={`${navKey(item)}:${item.label}`}
                    item={item}
                    index={index + primary.length}
                    pathname={pathname}
                    className={styles.drawerLink}
                    onClick={closeDrawer}
                  />
                ))}
              </nav>
            </details>
          ) : null}
        </div>,
        drawerNode,
      ) : null}

      {showShellControls && primary.length > 0 ? (
        <nav className={styles.roleDock} aria-label='Основные действия кабинета'>
          <div className={`${styles.roleDockInner} ${countClass(primary.length)}`}>
            {primary.map((item, index) => (
              <NavigationLink
                key={`${navKey(item)}:${item.label}`}
                item={item}
                index={index}
                pathname={pathname}
                className={styles.dockLink}
              />
            ))}
          </div>
        </nav>
      ) : null}
    </>
  );
}
