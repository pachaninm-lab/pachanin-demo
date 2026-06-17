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

type SafeLink = { href: string; label: string; note: string };

const SAFE_NAV_BY_ROLE: Record<PlatformRole, SafeLink[]> = {
  operator: [
    { href: '/platform-v7/control-tower', label: 'Центр управления', note: 'блокеры, ответственные, следующий шаг' },
    { href: '/platform-v7/deals', label: 'Сделки', note: 'реестр исполнения' },
    { href: '/platform-v7/lots', label: 'Лоты', note: 'предсделочный контур' },
    { href: '/platform-v7/procurement', label: 'Закупки', note: 'запросы и потребности' },
    { href: '/platform-v7/logistics', label: 'Логистика', note: 'рейсы и отклонения' },
    { href: '/platform-v7/bank', label: 'Банковское основание', note: 'резерв, удержания, проверка' },
    { href: '/platform-v7/disputes', label: 'Споры', note: 'доказательства и разбор' },
    { href: '/platform-v7/compliance', label: 'Комплаенс', note: 'допуск и риски' },
    { href: '/platform-v7/executive', label: 'Сводка', note: 'управленческий срез' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Кабинет покупателя', note: 'мои заявки и контроль поставки' },
    { href: '/platform-v7/procurement', label: 'Мои закупки', note: 'потребности, предложения, выбор' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Кабинет продавца', note: 'партии, офферы, документы продавца' },
  ],
  logistics: [
    { href: '/platform-v7/logistics', label: 'Диспетчерская', note: 'рейсы, перевозчики, отклонения' },
  ],
  driver: [
    { href: '/platform-v7/driver', label: 'Мой маршрут', note: 'рейс, прибытие, фото, события' },
  ],
  surveyor: [
    { href: '/platform-v7/surveyor', label: 'Мои назначения', note: 'осмотр и фиксация фактов' },
  ],
  elevator: [
    { href: '/platform-v7/elevator', label: 'Приёмка', note: 'вес, очередь, выгрузка, акты' },
  ],
  lab: [
    { href: '/platform-v7/lab', label: 'Пробы и протоколы', note: 'качество и лабораторный результат' },
  ],
  bank: [
    { href: '/platform-v7/bank', label: 'Банковское основание', note: 'проверка документов и статусов' },
    { href: '/platform-v7/bank/factoring', label: 'Факторинг', note: 'заявка и статус проверки' },
    { href: '/platform-v7/bank/escrow', label: 'Эскроу', note: 'условия удержания' },
  ],
  arbitrator: [
    { href: '/platform-v7/arbitrator', label: 'Комнаты разбора', note: 'спор и доказательства по роли' },
  ],
  compliance: [
    { href: '/platform-v7/compliance', label: 'Комплаенс', note: 'допуск, стоп-факторы, риски' },
  ],
  executive: [
    { href: '/platform-v7/executive', label: 'Сводка', note: 'деньги, риски, статус контура' },
    { href: '/platform-v7/control-tower', label: 'Центр управления', note: 'операционная картина' },
    { href: '/platform-v7/deals', label: 'Сделки', note: 'реестр исполнения' },
    { href: '/platform-v7/bank', label: 'Банковское основание', note: 'основания и удержания' },
    { href: '/platform-v7/disputes', label: 'Споры', note: 'разбор и доказательства' },
  ],
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
  const [drawerNode, setDrawerNode] = React.useState<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const activeRole = mounted ? readActiveRole(role) : role;
  const roleHome = ROLE_HOME[activeRole] ?? '/platform-v7/login';
  const publicPath = isPublicPath(pathname ?? '/platform-v7');
  const safeNav = SAFE_NAV_BY_ROLE[activeRole] ?? [{ href: roleHome, label: 'Главная', note: 'Домашний экран роли' }];

  React.useEffect(() => {
    setActionsNode(document.querySelector<HTMLElement>('.pc-v4-header .pc-v4-actions'));
    setDrawerNode(document.querySelector<HTMLElement>('.pc-v4-drawer'));
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

  const showShellControls = mounted && !publicPath;

  return (
    <>
      <style>{`
        .pc-v4-bottomnav{display:none!important}
        .pc-v4-switch-cabinet{display:none!important}
        .pc-v4-drawer .pc-v4-nav{display:none!important}
        .pc-v7-safe-drawer-nav{position:absolute;left:0;right:0;top:150px;bottom:76px;overflow:auto;display:grid;align-content:start;gap:7px;padding:12px;background:var(--pc-bg-card)}
        .pc-v7-safe-drawer-link{display:grid;gap:3px;padding:12px;border-radius:15px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);text-decoration:none;color:var(--pc-text-primary)}
        .pc-v7-safe-drawer-link[data-active='true']{background:var(--pc-accent-bg);border-color:var(--pc-accent-border);color:var(--pc-accent-strong)}
        .pc-v7-safe-drawer-link strong{font-size:13px;font-weight:950}.pc-v7-safe-drawer-link span{font-size:11px;color:var(--pc-text-muted);line-height:1.35}
        .pc-v7-role-dock{position:fixed;left:0;right:0;bottom:0;z-index:101;padding:8px 10px calc(env(safe-area-inset-bottom) + 8px);background:color-mix(in srgb,var(--pc-bg-header) 96%,transparent);border-top:1px solid var(--pc-border);backdrop-filter:blur(18px);box-shadow:0 -12px 30px rgba(3,8,7,.10)}
        .pc-v7-role-dock-inner{max-width:680px;margin:0 auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
        .pc-v7-role-dock-item{min-width:0;min-height:52px;border-radius:16px;border:1px solid transparent;background:transparent;color:var(--pc-text-muted);display:grid;place-items:center;gap:3px;text-decoration:none;font-size:10.5px;font-weight:900;line-height:1.1;cursor:pointer}
        .pc-v7-role-dock-item[data-active='true']{background:var(--pc-accent-bg);border-color:var(--pc-accent-border);color:var(--pc-accent-strong)}
        .pc-v7-role-dock-item span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pc-v7-logout-btn{color:#9f1d1d!important;border-color:rgba(159,29,29,.22)!important;background:rgba(159,29,29,.06)!important}.pc-v7-logout-btn:hover{color:#7f1d1d!important;border-color:rgba(159,29,29,.34)!important}
        .pc-v4-main{padding-bottom:calc(env(safe-area-inset-bottom) + 92px)!important}
        @media (max-width:640px){.pc-v7-role-dock-item{min-height:50px;font-size:10px}.pc-v7-role-dock-inner{gap:5px}.pc-v7-logout-btn{min-width:42px!important}.pc-v7-safe-drawer-nav{top:138px;bottom:72px}}
      `}</style>

      {showShellControls && actionsNode ? createPortal(
        <button className="pc-v4-iconbtn pc-v7-logout-btn" onClick={logout} aria-label="Выйти из кабинета" title="Выйти из кабинета"><LogOut size={17} /></button>,
        actionsNode,
      ) : null}

      {showShellControls && drawerNode ? createPortal(
        <nav className="pc-v7-safe-drawer-nav" aria-label="Безопасное меню роли">
          {safeNav.map((item) => {
            const active = normalize(pathname) === normalize(item.href) || normalize(pathname).startsWith(`${normalize(item.href)}/`);
            return <Link key={item.href} href={item.href} className="pc-v7-safe-drawer-link" data-active={active ? 'true' : 'false'}><strong>{item.label}</strong><span>{item.note}</span></Link>;
          })}
        </nav>,
        drawerNode,
      ) : null}

      {showShellControls ? (
        <nav className="pc-v7-role-dock" aria-label="Быстрые действия кабинета">
          <div className="pc-v7-role-dock-inner">
            <Link href={roleHome} className="pc-v7-role-dock-item" data-active={normalize(pathname) === normalize(roleHome) ? 'true' : 'false'}><Home size={19} /><span>Главная</span></Link>
            <button type="button" className="pc-v7-role-dock-item" onClick={() => clickByLabel('Открыть поиск')}><Search size={19} /><span>Поиск</span></button>
            <button type="button" className="pc-v7-role-dock-item" onClick={() => clickByLabel('Открыть уведомления')}><Bell size={19} /><span>Сигналы</span></button>
            <button type="button" className="pc-v7-role-dock-item" onClick={() => clickByLabel('Открыть меню')}><Menu size={19} /><span>Меню</span></button>
          </div>
        </nav>
      ) : null}
    </>
  );
}
