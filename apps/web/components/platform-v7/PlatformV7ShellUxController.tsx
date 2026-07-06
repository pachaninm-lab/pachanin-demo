'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ClipboardList, Gavel, Home, Landmark, LogOut, Package, Route, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import {
  platformV7DrawerNavByRole,
  platformV7NavByRole,
  platformV7RoleCanOpenHref,
  platformV7RoleRoute,
  type PlatformV7RoleNavItem,
} from '@/lib/platform-v7/shellRoutes';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';

// Role home, bottom-dock and drawer links are sourced from the canonical role
// navigation registry (`shellRoutes`): `platformV7RoleRoute`,
// `platformV7NavByRole` and `platformV7DrawerNavByRole` (used below). The former
// controller-local per-role home/dock constants were dead duplicates left over
// from the pre-registry implementation and have been removed; the registry
// contract is covered by platformV7RoleNavigationRegistry.test.ts.

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register']);

const PLATFORM_ROLES: readonly PlatformRole[] = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

type DockLink = { id: string; href: string; label: string; icon: LucideIcon };
type RoleNotice = { id: string; title: string; note: string; href: string };

const NOTICES_BY_ROLE: Record<PlatformRole, RoleNotice[]> = {
  operator: [
    { id: 'op-1', title: 'Есть блокеры исполнения', note: 'Проверь центр управления и очередь сделок.', href: '/platform-v7/control-tower' },
    { id: 'op-2', title: 'Нужна проверка документов', note: 'Есть сделки с незакрытым пакетом.', href: '/platform-v7/deals' },
  ],
  buyer: [{ id: 'buyer-1', title: 'Проверь закупки', note: 'Есть шаги по заявке покупателя.', href: '/platform-v7/procurement' }],
  seller: [{ id: 'seller-1', title: 'Проверь документы', note: 'СДИЗ и ЭТрН должны закрыть основание для банка.', href: '/platform-v7/seller#documents' }],
  logistics: [{ id: 'log-1', title: 'Проверь рейсы', note: 'Есть маршрут или отклонение по логистике.', href: '/platform-v7/logistics' }],
  driver: [{ id: 'driver-1', title: 'Проверь маршрут', note: 'Зафиксируй ближайшее событие рейса.', href: '/platform-v7/driver/field' }],
  surveyor: [{ id: 'surveyor-1', title: 'Проверь осмотр', note: 'Есть назначение на фиксацию фактов.', href: '/platform-v7/surveyor' }],
  elevator: [{ id: 'elevator-1', title: 'Проверь приёмку', note: 'Есть действие по весу или акту.', href: '/platform-v7/elevator' }],
  lab: [{ id: 'lab-1', title: 'Проверь протокол', note: 'Есть действие по пробе или качеству.', href: '/platform-v7/lab' }],
  bank: [{ id: 'bank-1', title: 'Проверь основание', note: 'Есть банковский шаг по проверке.', href: '/platform-v7/bank' }],
  arbitrator: [{ id: 'arb-1', title: 'Проверь разбор', note: 'Есть действие по доказательствам.', href: '/platform-v7/arbitrator' }],
  compliance: [{ id: 'comp-1', title: 'Проверь допуск', note: 'Есть стоп-фактор или документ.', href: '/platform-v7/compliance' }],
  executive: [{ id: 'exec-1', title: 'Проверь сводку', note: 'Есть управленческий риск или блокер.', href: '/platform-v7/executive' }],
};

function normalize(pathname: string) {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function activePath(pathname: string, href: string) {
  const path = normalize(pathname).split('#')[0];
  const target = normalize(href).split('#')[0];
  return path === target || path.startsWith(`${target}/`);
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(normalize(pathname));
}

function isPlatformRole(value: string | null): value is PlatformRole {
  return PLATFORM_ROLES.includes(value as PlatformRole);
}

function readActiveRole(role: PlatformRole): PlatformRole {
  if (typeof window === 'undefined') return role;
  const stored = window.sessionStorage.getItem(ACTIVE_ROLE_KEY);
  return isPlatformRole(stored) ? stored : role;
}

function clearShellSession() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    window.localStorage.removeItem(STORE_KEY);
  }
  if (typeof document !== 'undefined') {
    document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax';
  }
}

function closeLegacyDrawer() {
  const closeButton = document.querySelector<HTMLButtonElement>('.pc-v4-drawer button[aria-label="Закрыть меню"]');
  closeButton?.click();
}

function iconFor(item: PlatformV7RoleNavItem, index: number): LucideIcon {
  const text = `${item.label} ${item.note ?? ''} ${item.href}`.toLowerCase();
  if (index === 0 || text.includes('кабинет') || text.includes('сводка') || text.includes('центр')) return Home;
  if (text.includes('банк') || text.includes('деньг') || text.includes('резерв') || text.includes('удерж')) return Landmark;
  if (text.includes('рейс') || text.includes('логист') || text.includes('водител') || text.includes('маршрут')) return text.includes('маршрут') ? Route : Truck;
  if (text.includes('спор') || text.includes('арбитр') || text.includes('решение')) return Gavel;
  if (text.includes('риск') || text.includes('допуск') || text.includes('качество') || text.includes('evidence') || text.includes('факт')) return ShieldCheck;
  if (text.includes('лот') || text.includes('парт')) return Package;
  return ClipboardList;
}

function toDockLinks(role: PlatformRole, nav: PlatformV7RoleNavItem[]): DockLink[] {
  return nav.map((item, index) => ({
    id: `${role}-${index}-${item.href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`,
    href: item.href,
    label: item.label,
    icon: iconFor(item, index),
  }));
}

function safeRoleNav(role: PlatformRole, items: PlatformV7RoleNavItem[]) {
  return items.filter((item) => platformV7RoleCanOpenHref(role, item.href));
}

export function PlatformV7ShellUxController() {
  const pathname = usePathname();
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);
  const clearRoleSelection = usePlatformV7RStore((state) => state.clearRoleSelection);
  const [actionsNode, setActionsNode] = React.useState<HTMLElement | null>(null);
  const [drawerNode, setDrawerNode] = React.useState<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [noticesOpen, setNoticesOpen] = React.useState(false);
  const [noticesSeen, setNoticesSeen] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const activeRole = mounted ? readActiveRole(role) : role;
  const roleHome = platformV7RoleRoute(activeRole);
  const publicPath = isPublicPath(pathname ?? '/platform-v7');
  const bottomNav = safeRoleNav(activeRole, platformV7NavByRole(activeRole));
  const drawerNav = safeRoleNav(activeRole, [...bottomNav, ...platformV7DrawerNavByRole(activeRole)]);
  const dockLinks = toDockLinks(activeRole, bottomNav.length ? bottomNav : [{ href: roleHome, label: 'Главная', note: 'Домашний экран роли' }]);
  const notices = (NOTICES_BY_ROLE[activeRole] ?? []).filter((item) => platformV7RoleCanOpenHref(activeRole, item.href));
  const dockCount = dockLinks.length;

  React.useEffect(() => {
    setActionsNode(document.querySelector<HTMLElement>('.pc-v4-header .pc-v4-actions'));
    setDrawerNode(document.querySelector<HTMLElement>('.pc-v4-drawer'));
  }, [pathname]);

  React.useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>('.pc-v4-header .pc-v4-brand, .pc-v4-drawer .pc-v4-brand').forEach((item) => {
      item.href = roleHome ?? '/platform-v7';
      item.setAttribute('aria-label', 'Прозрачная Цена — в мой кабинет');
    });
  }, [pathname, roleHome]);

  const logout = React.useCallback(() => {
    clearRoleSelection();
    clearShellSession();
    router.replace('/platform-v7');
  }, [clearRoleSelection, router]);

  const showMenuButton = notices.length > 0;
  const hasExtraMenuItems = bottomNav.length > 0;
  const showShellControls = mounted && !publicPath;

  return (
    <>
      <style>{`
        html,body,.pc-shell-root-v4{max-width:100vw!important;overflow-x:hidden!important}
        .pc-v4-main{max-width:100vw!important;overflow-x:hidden!important;contain:inline-size}
        .pc-v4-main *,.pc-v4-drawer *,.pc-v7-role-dock *{box-sizing:border-box;min-width:0;max-width:100%}
        .pc-v4-main [style*='grid-template-columns'],.pc-v4-main [class*='grid'],.pc-v4-main [class*='row'],.pc-v4-main [class*='cards']{min-width:0!important}
        .pc-v4-main img,.pc-v4-main svg,.pc-v4-main canvas{max-width:100%!important}
        .pc-v4-bottomnav{display:none!important}
        .pc-v4-switch-cabinet{display:none!important}
        .pc-v4-drawer .pc-v4-nav{display:none!important}
        .pc-v4-drawer > div:not(:first-child){display:none!important}
        .pc-v4-actions button[aria-label='Открыть уведомления']{display:none!important}
        .pc-v7-safe-drawer-nav{position:absolute;left:0;right:0;top:150px;bottom:0;overflow:auto;display:grid;align-content:start;gap:7px;padding:12px;background:var(--pc-bg-card)}
        .pc-v7-safe-drawer-link{display:grid;gap:3px;padding:12px;border-radius:15px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);text-decoration:none;color:var(--pc-text-primary)}
        .pc-v7-safe-drawer-link[data-active='true']{background:var(--pc-accent-bg);border-color:var(--pc-accent-border);color:var(--pc-accent-strong)}
        .pc-v7-safe-drawer-link strong{font-size:13px;font-weight:950}.pc-v7-safe-drawer-link span{font-size:11px;color:var(--pc-text-muted);line-height:1.35}
        .pc-v7-role-dock{position:fixed;left:0;right:0;bottom:0;z-index:101;padding:8px 8px calc(env(safe-area-inset-bottom) + 8px);background:color-mix(in srgb,var(--pc-bg-header) 96%,transparent);border-top:1px solid var(--pc-border);backdrop-filter:blur(18px);box-shadow:0 -12px 30px rgba(3,8,7,.10)}
        .pc-v7-role-dock-inner{max-width:720px;margin:0 auto;display:grid;grid-template-columns:repeat(var(--pc-v7-dock-count),minmax(0,1fr));gap:5px}
        .pc-v7-role-dock-item{min-width:0;min-height:54px;border-radius:16px;border:1px solid transparent;background:transparent;color:var(--pc-text-muted);display:grid;place-items:center;gap:3px;text-decoration:none;font-size:10px;font-weight:900;line-height:1.1;cursor:pointer}
        .pc-v7-role-dock-item[data-active='true']{background:var(--pc-accent-bg);border-color:var(--pc-accent-border);color:var(--pc-accent-strong)}
        .pc-v7-role-dock-item span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pc-v7-role-dock-item svg{width:19px;height:19px}
        .pc-v7-logout-btn{color:#9f1d1d!important;border-color:rgba(159,29,29,.22)!important;background:rgba(159,29,29,.06)!important}.pc-v7-logout-btn:hover{color:#7f1d1d!important;border-color:rgba(159,29,29,.34)!important}
        .pc-v7-notice-wrap{position:relative}.pc-v7-notice-dot{position:absolute;right:7px;top:7px;width:8px;height:8px;border-radius:999px;background:#FF8B90;border:2px solid var(--pc-bg-card)}
        .pc-v7-notice-panel{position:absolute;right:0;top:50px;width:340px;max-width:calc(100vw - 32px);max-height:70vh;overflow:auto;border-radius:18px;border:1px solid var(--pc-border);background:var(--pc-bg-card);box-shadow:var(--pc-shadow-lg);padding:12px;display:grid;gap:10px}
        .pc-v7-notice-link{display:grid;gap:4px;padding:10px 11px;border-radius:14px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);text-decoration:none;color:var(--pc-text-primary)}
        .pc-v4-main{padding-bottom:calc(env(safe-area-inset-bottom) + 96px)!important}
        @media (max-width:640px){.pc-v4-main{padding-left:12px!important;padding-right:12px!important}.pc-v4-main [style*='grid-template-columns']{grid-template-columns:1fr!important}.pc-v7-logout-btn{min-width:42px!important}.pc-v7-safe-drawer-nav{top:138px}.pc-v7-notice-panel{position:fixed;left:10px;right:10px;top:calc(env(safe-area-inset-top) + 62px);width:auto;max-width:none}}
        @media (max-width:380px){.pc-v7-role-dock-inner{gap:4px}.pc-v7-role-dock-item{font-size:9.5px;min-height:50px}.pc-v7-role-dock-item svg{width:18px;height:18px}}
      `}</style>

      {showShellControls && actionsNode ? createPortal(
        <>
          <div className="pc-v7-notice-wrap">
            <button className="pc-v4-iconbtn" onClick={() => { setNoticesOpen((value) => !value); setNoticesSeen(true); }} aria-label="Открыть уведомления роли" title="Уведомления роли">
              <Bell size={17} />
              {!noticesSeen && notices.length ? <span className="pc-v7-notice-dot" /> : null}
            </button>
            {noticesOpen ? <div className="pc-v7-notice-panel">
              <strong style={{ color: 'var(--pc-text-primary)', fontSize: 14 }}>Уведомления роли</strong>
              {notices.map((item) => <Link key={item.id} href={item.href} className="pc-v7-notice-link" onClick={() => setNoticesOpen(false)}><strong style={{ fontSize: 12 }}>{item.title}</strong><span style={{ color: 'var(--pc-text-muted)', fontSize: 11 }}>{item.note}</span></Link>)}
            </div> : null}
          </div>
          <button className="pc-v4-iconbtn pc-v7-logout-btn" onClick={logout} aria-label="Выйти из кабинета" title="Выйти из кабинета"><LogOut size={17} /></button>
        </>,
        actionsNode,
      ) : null}

      {showShellControls && drawerNode ? createPortal(
        <nav className="pc-v7-safe-drawer-nav" aria-label="Полное меню функций роли">
          {drawerNav.map((item) => {
            const active = activePath(pathname, item.href);
            return <Link key={`${item.href}:${item.label}`} href={item.href} className="pc-v7-safe-drawer-link" data-active={active ? 'true' : 'false'} onClick={() => window.setTimeout(closeLegacyDrawer, 0)}><strong>{item.label}</strong><span>{item.note}</span></Link>;
          })}
        </nav>,
        drawerNode,
      ) : null}

      {showShellControls ? (
        <nav className="pc-v7-role-dock" aria-label="Быстрые действия кабинета">
          <div className="pc-v7-role-dock-inner" style={{ '--pc-v7-dock-count': String(Math.max(dockCount, 1)) } as React.CSSProperties}>
            {dockLinks.map((item) => {
              const Icon = item.icon;
              const active = activePath(pathname, item.href);
              return <Link key={item.id} href={item.href} className="pc-v7-role-dock-item" data-active={active ? 'true' : 'false'}><Icon /><span>{item.label}</span></Link>;
            })}
          </div>
        </nav>
      ) : null}
    </>
  );
}
