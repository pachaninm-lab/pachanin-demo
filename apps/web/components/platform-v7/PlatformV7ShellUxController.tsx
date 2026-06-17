'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Bot, ClipboardList, Gavel, Home, Landmark, LogOut, Menu, Package, Route, ShieldCheck, Truck, Wheat, type LucideIcon } from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const STORE_KEY = 'pc-session-v10';
const AI_HREF = '/platform-v7/ai';
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
type DockLink = { id: string; href: string; label: string; icon: LucideIcon };
type RoleNotice = { id: string; title: string; note: string; href: string };

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
    { href: AI_HREF, label: 'ИИ-помощник', note: 'роль, блокер, следующий шаг' },
    { href: '/platform-v7/executive', label: 'Сводка', note: 'управленческий срез' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Кабинет покупателя', note: 'мои заявки и контроль поставки' },
    { href: '/platform-v7/procurement', label: 'Мои закупки', note: 'потребности, предложения, выбор' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'качество, приёмка, документы' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Кабинет продавца', note: 'партии, офферы, документы продавца' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'документы, удержания, следующий шаг' },
  ],
  logistics: [
    { href: '/platform-v7/logistics', label: 'Диспетчерская', note: 'рейсы, перевозчики, отклонения' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'маршрут, документы, отклонения' },
  ],
  driver: [
    { href: '/platform-v7/driver', label: 'Мой маршрут', note: 'рейс, прибытие, фото, события' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'следующий шаг по рейсу' },
  ],
  surveyor: [
    { href: '/platform-v7/surveyor', label: 'Мои назначения', note: 'осмотр и фиксация фактов' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'пакет доказательств' },
  ],
  elevator: [
    { href: '/platform-v7/elevator', label: 'Приёмка', note: 'вес, очередь, выгрузка, акты' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'приёмка, вес, следующий факт' },
  ],
  lab: [
    { href: '/platform-v7/lab', label: 'Пробы и протоколы', note: 'качество и лабораторный результат' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'качество, дельта, повторный анализ' },
  ],
  bank: [
    { href: '/platform-v7/bank', label: 'Банковское основание', note: 'проверка документов и статусов' },
    { href: '/platform-v7/bank/factoring', label: 'Факторинг', note: 'заявка и статус проверки' },
    { href: '/platform-v7/bank/escrow', label: 'Эскроу', note: 'условия удержания' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'основание, удержания, события' },
  ],
  arbitrator: [
    { href: '/platform-v7/arbitrator', label: 'Комнаты разбора', note: 'спор и доказательства по роли' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'доказательства и решение' },
  ],
  compliance: [
    { href: '/platform-v7/compliance', label: 'Комплаенс', note: 'допуск, стоп-факторы, риски' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'риски, допуск, блокеры' },
  ],
  executive: [
    { href: '/platform-v7/executive', label: 'Сводка', note: 'деньги, риски, статус контура' },
    { href: '/platform-v7/control-tower', label: 'Центр управления', note: 'операционная картина' },
    { href: '/platform-v7/deals', label: 'Сделки', note: 'реестр исполнения' },
    { href: '/platform-v7/bank', label: 'Банковское основание', note: 'основания и удержания' },
    { href: '/platform-v7/disputes', label: 'Споры', note: 'разбор и доказательства' },
    { href: AI_HREF, label: 'ИИ-помощник', note: 'управленческий следующий шаг' },
  ],
};

const DOCK_BY_ROLE: Record<PlatformRole, DockLink[]> = {
  operator: [
    { id: 'home', href: '/platform-v7/control-tower', label: 'Центр', icon: Home },
    { id: 'deals', href: '/platform-v7/deals', label: 'Сделки', icon: ClipboardList },
    { id: 'bank', href: '/platform-v7/bank', label: 'Деньги', icon: Landmark },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  buyer: [
    { id: 'home', href: '/platform-v7/buyer', label: 'Главная', icon: Home },
    { id: 'procurement', href: '/platform-v7/procurement', label: 'Закупки', icon: ClipboardList },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  seller: [
    { id: 'home', href: '/platform-v7/seller', label: 'Главная', icon: Home },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  logistics: [
    { id: 'home', href: '/platform-v7/logistics', label: 'Рейсы', icon: Truck },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  driver: [
    { id: 'home', href: '/platform-v7/driver', label: 'Маршрут', icon: Route },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  surveyor: [
    { id: 'home', href: '/platform-v7/surveyor', label: 'Осмотр', icon: ClipboardList },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  elevator: [
    { id: 'home', href: '/platform-v7/elevator', label: 'Приёмка', icon: Home },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  lab: [
    { id: 'home', href: '/platform-v7/lab', label: 'Пробы', icon: ClipboardList },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  bank: [
    { id: 'home', href: '/platform-v7/bank', label: 'Основание', icon: Landmark },
    { id: 'factoring', href: '/platform-v7/bank/factoring', label: 'Факторинг', icon: Package },
    { id: 'escrow', href: '/platform-v7/bank/escrow', label: 'Эскроу', icon: ShieldCheck },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  arbitrator: [
    { id: 'home', href: '/platform-v7/arbitrator', label: 'Разбор', icon: Gavel },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  compliance: [
    { id: 'home', href: '/platform-v7/compliance', label: 'Допуск', icon: ShieldCheck },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
  executive: [
    { id: 'home', href: '/platform-v7/executive', label: 'Сводка', icon: Home },
    { id: 'control', href: '/platform-v7/control-tower', label: 'Центр', icon: ClipboardList },
    { id: 'bank', href: '/platform-v7/bank', label: 'Деньги', icon: Landmark },
    { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot },
  ],
};

const NOTICES_BY_ROLE: Record<PlatformRole, RoleNotice[]> = {
  operator: [
    { id: 'op-1', title: 'Есть блокеры исполнения', note: 'Проверь центр управления и очередь сделок.', href: '/platform-v7/control-tower' },
    { id: 'op-2', title: 'Нужна проверка документов', note: 'Есть сделки с незакрытым пакетом.', href: '/platform-v7/deals' },
  ],
  buyer: [{ id: 'buyer-1', title: 'Проверь закупки', note: 'Есть шаги по заявке покупателя.', href: '/platform-v7/procurement' }],
  seller: [{ id: 'seller-1', title: 'Проверь партии', note: 'Есть действия по кабинету продавца.', href: '/platform-v7/seller' }],
  logistics: [{ id: 'log-1', title: 'Проверь рейсы', note: 'Есть маршрут или отклонение по логистике.', href: '/platform-v7/logistics' }],
  driver: [{ id: 'driver-1', title: 'Проверь маршрут', note: 'Зафиксируй ближайшее событие рейса.', href: '/platform-v7/driver' }],
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

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(normalize(pathname));
}

function readActiveRole(role: PlatformRole): PlatformRole {
  if (typeof window === 'undefined') return role;
  const stored = window.sessionStorage.getItem(ACTIVE_ROLE_KEY) as PlatformRole | null;
  return stored && ROLE_HOME[stored] ? stored : role;
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

function hasExtraMenuItems(nav: SafeLink[], dock: DockLink[]) {
  const dockHrefs = new Set(dock.map((item) => normalize(item.href)));
  return nav.some((item) => !dockHrefs.has(normalize(item.href)));
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
  const roleHome = ROLE_HOME[activeRole] ?? '/platform-v7/login';
  const publicPath = isPublicPath(pathname ?? '/platform-v7');
  const safeNav = SAFE_NAV_BY_ROLE[activeRole] ?? [{ href: roleHome, label: 'Главная', note: 'Домашний экран роли' }];
  const dockLinks = DOCK_BY_ROLE[activeRole] ?? [{ id: 'home', href: roleHome, label: 'Главная', icon: Home }, { id: 'ai', href: AI_HREF, label: 'ИИ', icon: Bot }];
  const showMenuButton = hasExtraMenuItems(safeNav, dockLinks);
  const notices = NOTICES_BY_ROLE[activeRole] ?? [];
  const dockCount = dockLinks.length + (showMenuButton ? 1 : 0);

  React.useEffect(() => {
    setActionsNode(document.querySelector<HTMLElement>('.pc-v4-header .pc-v4-actions'));
    setDrawerNode(document.querySelector<HTMLElement>('.pc-v4-drawer'));
  }, [pathname]);

  React.useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>('.pc-v4-header .pc-v4-brand, .pc-v4-drawer .pc-v4-brand').forEach((item) => {
      item.href = '/platform-v7';
      item.setAttribute('aria-label', 'Прозрачная Цена — главная страница с описанием платформы и выбором роли');
    });
  }, [pathname]);

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
        .pc-v4-actions button[aria-label='Открыть уведомления']{display:none!important}
        .pc-v7-safe-drawer-nav{position:absolute;left:0;right:0;top:150px;bottom:76px;overflow:auto;display:grid;align-content:start;gap:7px;padding:12px;background:var(--pc-bg-card)}
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
        @media (max-width:380px){.pc-v7-role-dock-inner{gap:4px}.pc-v7-role-dock-item{font-size:9.5px;min-height:50px}.pc-v7-role-dock-item svg{width:18px;height:18px}}
        @media (max-width:640px){.pc-v7-logout-btn{min-width:42px!important}.pc-v7-safe-drawer-nav{top:138px;bottom:72px}.pc-v7-notice-panel{position:fixed;left:10px;right:10px;top:calc(env(safe-area-inset-top) + 62px);width:auto;max-width:none}}
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
          <div className="pc-v7-role-dock-inner" style={{ '--pc-v7-dock-count': String(Math.max(dockCount, 1)) } as React.CSSProperties}>
            {dockLinks.map((item) => {
              const Icon = item.icon;
              const active = normalize(pathname) === normalize(item.href) || normalize(pathname).startsWith(`${normalize(item.href)}/`);
              return <Link key={item.id} href={item.href} className="pc-v7-role-dock-item" data-active={active ? 'true' : 'false'}><Icon /><span>{item.label}</span></Link>;
            })}
            {showMenuButton ? <button type="button" className="pc-v7-role-dock-item" onClick={() => document.querySelector<HTMLButtonElement>('button[aria-label="Открыть меню"]')?.click()}><Menu /><span>Меню</span></button> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
