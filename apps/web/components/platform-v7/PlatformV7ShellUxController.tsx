'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Home, LogOut, Menu, Search } from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/open', '/platform-v7/login', '/platform-v7/register']);

const ROLE_HOME: Record<PlatformRole, string> = {
  operator: '/platform-v7/control-tower',
  buyer: '/platform-v7/buyer',
  seller: '/platform-v7/seller',
  logistics: '/platform-v7/logistics',
  driver: '/platform-v7/driver',
  surveyor: '/platform-v7/surveyor',
  elevator: '/platform-v7/elevator',
  lab: '/platform-v7/lab',
  bank: '/platform-v7/bank',
  arbitrator: '/platform-v7/arbitrator',
  compliance: '/platform-v7/compliance',
  executive: '/platform-v7/executive',
};

function normalize(pathname: string) {
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(normalize(pathname));
}

function readActiveRole(role: PlatformRole): PlatformRole {
  if (typeof window === 'undefined') return role;
  const stored = window.sessionStorage.getItem(ACTIVE_ROLE_KEY) as PlatformRole | null;
  return stored && ROLE_HOME[stored] ? stored : role;
}

function clickByLabel(label: string) {
  const target = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  target?.click();
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

export function PlatformV7ShellUxController() {
  const pathname = usePathname();
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);
  const clearRoleSelection = usePlatformV7RStore((state) => state.clearRoleSelection);
  const [actionsNode, setActionsNode] = React.useState<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const activeRole = mounted ? readActiveRole(role) : role;
  const roleHome = ROLE_HOME[activeRole] ?? '/platform-v7/login';
  const publicPath = isPublicPath(pathname ?? '/platform-v7');

  React.useEffect(() => {
    const node = document.querySelector<HTMLElement>('.pc-v4-header .pc-v4-actions');
    setActionsNode(node);
  }, [pathname]);

  React.useEffect(() => {
    const targetHref = publicPath ? '/platform-v7' : roleHome;
    document.querySelectorAll<HTMLAnchorElement>('.pc-v4-header .pc-v4-brand, .pc-v4-drawer .pc-v4-brand').forEach((item) => {
      item.href = targetHref;
      item.setAttribute('aria-label', publicPath ? 'Прозрачная Цена — главная страница' : 'Прозрачная Цена — главная страница кабинета');
    });
  }, [pathname, publicPath, roleHome]);

  const logout = React.useCallback(() => {
    clearRoleSelection();
    clearShellSession();
    router.replace('/platform-v7');
  }, [clearRoleSelection, router]);

  const showDock = mounted && !publicPath;

  return (
    <>
      <style>{`
        .pc-v4-bottomnav{display:none!important}
        .pc-v7-role-dock{position:fixed;left:0;right:0;bottom:0;z-index:101;padding:8px 10px calc(env(safe-area-inset-bottom) + 8px);background:color-mix(in srgb,var(--pc-bg-header) 96%,transparent);border-top:1px solid var(--pc-border);backdrop-filter:blur(18px);box-shadow:0 -12px 30px rgba(3,8,7,.10)}
        .pc-v7-role-dock-inner{max-width:680px;margin:0 auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
        .pc-v7-role-dock-item{min-width:0;min-height:52px;border-radius:16px;border:1px solid transparent;background:transparent;color:var(--pc-text-muted);display:grid;place-items:center;gap:3px;text-decoration:none;font-size:10.5px;font-weight:900;line-height:1.1;cursor:pointer}
        .pc-v7-role-dock-item[data-active='true']{background:var(--pc-accent-bg);border-color:var(--pc-accent-border);color:var(--pc-accent-strong)}
        .pc-v7-role-dock-item span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pc-v7-logout-btn{color:#9f1d1d!important;border-color:rgba(159,29,29,.22)!important;background:rgba(159,29,29,.06)!important}
        .pc-v7-logout-btn:hover{color:#7f1d1d!important;border-color:rgba(159,29,29,.34)!important}
        .pc-v4-main{padding-bottom:calc(env(safe-area-inset-bottom) + 92px)!important}
        .pc-v4-switch-cabinet{display:none!important}
        @media (max-width:640px){.pc-v7-role-dock-item{min-height:50px;font-size:10px}.pc-v7-role-dock-inner{gap:5px}.pc-v7-logout-btn{min-width:42px!important}}
      `}</style>

      {mounted && !publicPath && actionsNode ? createPortal(
        <button className="pc-v4-iconbtn pc-v7-logout-btn" onClick={logout} aria-label="Выйти из кабинета" title="Выйти из кабинета">
          <LogOut size={17} />
        </button>,
        actionsNode,
      ) : null}

      {showDock ? (
        <nav className="pc-v7-role-dock" aria-label="Быстрые действия кабинета">
          <div className="pc-v7-role-dock-inner">
            <Link href={roleHome} className="pc-v7-role-dock-item" data-active={normalize(pathname) === normalize(roleHome) ? 'true' : 'false'}>
              <Home size={19} />
              <span>Главная</span>
            </Link>
            <button type="button" className="pc-v7-role-dock-item" onClick={() => clickByLabel('Открыть поиск')}>
              <Search size={19} />
              <span>Поиск</span>
            </button>
            <button type="button" className="pc-v7-role-dock-item" onClick={() => clickByLabel('Открыть уведомления')}>
              <Bell size={19} />
              <span>Сигналы</span>
            </button>
            <button type="button" className="pc-v7-role-dock-item" onClick={() => clickByLabel('Открыть меню')}>
              <Menu size={19} />
              <span>Меню</span>
            </button>
          </div>
        </nav>
      ) : null}
    </>
  );
}
