'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Briefcase,
  FileCheck,
  FileText,
  FlaskConical,
  FolderOpen,
  Gavel,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Truck,
  User,
  Wheat,
  X,
  type LucideIcon,
} from 'lucide-react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

type SectionKey =
  | 'dashboard'
  | 'deals'
  | 'lots'
  | 'create'
  | 'logistics'
  | 'analytics'
  | 'integrations'
  | 'bank'
  | 'disputes'
  | 'cabinet'
  | 'procurement'
  | 'receiving'
  | 'lab';

type NavItem = { href: string; label: string; icon: SectionKey; note?: string };
type RouteOwner = { prefix: string; role: PlatformRole; also?: PlatformRole[] };

const ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

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

const ROLE_ICONS: Record<PlatformRole, LucideIcon> = {
  operator: LayoutDashboard,
  buyer: Briefcase,
  seller: Wheat,
  logistics: Truck,
  driver: User,
  surveyor: ShieldCheck,
  elevator: Briefcase,
  lab: FlaskConical,
  bank: Landmark,
  arbitrator: Gavel,
  compliance: ShieldCheck,
  executive: BarChart3,
};

const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  deals: FolderOpen,
  lots: Wheat,
  create: FileCheck,
  logistics: Truck,
  analytics: BarChart3,
  integrations: ShieldCheck,
  bank: Landmark,
  disputes: ShieldCheck,
  cabinet: Briefcase,
  procurement: FileText,
  receiving: Briefcase,
  lab: FlaskConical,
};

const NAV_BY_ROLE: Record<PlatformRole, NavItem[]> = {
  operator: [
    { href: '/platform-v7/control-tower', label: 'Центр', icon: 'dashboard', note: 'блокеры и следующий шаг' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'реестр и статусы' },
    { href: '/platform-v7/logistics', label: 'Логистика', icon: 'logistics', note: 'рейсы и отклонения' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank', note: 'резерв и проверка' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes', note: 'удержания и доказательства' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Кабинет', icon: 'cabinet', note: 'мои заявки и сделки' },
    { href: '/platform-v7/procurement', label: 'Закупки', icon: 'procurement', note: 'потребности и предложения' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'исполнение и документы' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Кабинет', icon: 'cabinet', note: 'мои партии и офферы' },
    { href: '/platform-v7/lots', label: 'Лоты', icon: 'lots', note: 'заявки и партии' },
    { href: '/platform-v7/lots/create', label: 'Создать', icon: 'create', note: 'партия к продаже' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'исполнение и деньги' },
  ],
  logistics: [
    { href: '/platform-v7/logistics', label: 'Диспетчерская', icon: 'logistics', note: 'заявки и рейсы' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'рейсы в сделках' },
  ],
  driver: [
    { href: '/platform-v7/driver', label: 'Маршрут', icon: 'logistics', note: 'рейс, фото, GPS' },
    { href: '/platform-v7/deals/DL-9103', label: 'Сделка', icon: 'deals', note: 'только свой рейс' },
  ],
  surveyor: [
    { href: '/platform-v7/surveyor', label: 'Осмотр', icon: 'cabinet', note: 'фиксация фактов' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes', note: 'доказательства' },
  ],
  elevator: [
    { href: '/platform-v7/elevator', label: 'Приёмка', icon: 'receiving', note: 'вес и допуск' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'связанные поставки' },
  ],
  lab: [
    { href: '/platform-v7/lab', label: 'Пробы', icon: 'lab', note: 'качество и протоколы' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'привязка к рейсам' },
  ],
  bank: [
    { href: '/platform-v7/bank', label: 'Банк', icon: 'bank', note: 'резерв, удержание, основание' },
    { href: '/platform-v7/bank/factoring', label: 'Факторинг', icon: 'bank', note: 'заявка и статус' },
    { href: '/platform-v7/bank/escrow', label: 'Эскроу', icon: 'bank', note: 'условия удержания' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'проверка условий' },
  ],
  arbitrator: [
    { href: '/platform-v7/arbitrator', label: 'Разбор', icon: 'analytics', note: 'решение по спору' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes', note: 'очередь арбитража' },
  ],
  compliance: [
    { href: '/platform-v7/compliance', label: 'Допуск', icon: 'cabinet', note: 'контрагенты и правила' },
    { href: '/platform-v7/connectors', label: 'Подключения', icon: 'integrations', note: 'ФГИС, банк, ЭДО' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'проверка рисков' },
  ],
  executive: [
    { href: '/platform-v7/executive', label: 'Сводка', icon: 'analytics', note: 'деньги и риски' },
    { href: '/platform-v7/control-tower', label: 'Центр', icon: 'dashboard', note: 'операционная картина' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank', note: 'резерв и основания' },
  ],
};

const ROUTE_OWNERS: RouteOwner[] = [
  { prefix: '/platform-v7/driver', role: 'driver' },
  { prefix: '/platform-v7/surveyor', role: 'surveyor' },
  { prefix: '/platform-v7/elevator', role: 'elevator' },
  { prefix: '/platform-v7/lab', role: 'lab' },
  { prefix: '/platform-v7/bank', role: 'bank', also: ['operator', 'executive'] },
  { prefix: '/platform-v7/arbitrator', role: 'arbitrator' },
  { prefix: '/platform-v7/disputes', role: 'arbitrator', also: ['surveyor', 'operator', 'bank'] },
  { prefix: '/platform-v7/compliance', role: 'compliance' },
  { prefix: '/platform-v7/connectors', role: 'compliance', also: ['operator'] },
  { prefix: '/platform-v7/buyer', role: 'buyer' },
  { prefix: '/platform-v7/procurement', role: 'buyer' },
  { prefix: '/platform-v7/seller', role: 'seller' },
  { prefix: '/platform-v7/lots', role: 'seller', also: ['buyer', 'operator'] },
  { prefix: '/platform-v7/logistics', role: 'logistics', also: ['operator'] },
  { prefix: '/platform-v7/executive', role: 'executive' },
  { prefix: '/platform-v7/analytics', role: 'executive' },
  { prefix: '/platform-v7/control-tower', role: 'operator', also: ['executive'] },
];

const PUBLIC_PATHS = new Set(['/platform-v7', '/platform-v7/roles']);

function routeMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isForeignRolePath(pathname: string, role: PlatformRole) {
  const owner = ROUTE_OWNERS.find((item) => routeMatches(pathname, item.prefix));
  if (!owner) return false;
  return owner.role !== role && !owner.also?.includes(role);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveThemeFromStorage(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('pc-theme');
  const storedVersion = window.localStorage.getItem(PLATFORM_V7_THEME_VERSION_KEY);
  return stored === 'dark' && storedVersion === PLATFORM_V7_LIGHT_DEFAULT_VERSION ? 'dark' : 'light';
}

export function AppShellV4({ children, initialRole = 'operator' }: { children: React.ReactNode; initialRole?: PlatformRole }) {
  const pathname = usePathname() || '/platform-v7';
  const router = useRouter();
  const role = usePlatformV7RStore((state) => state.role);
  const roleSelected = usePlatformV7RStore((state) => state.roleSelected);
  const setRole = usePlatformV7RStore((state) => state.setRole);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const displayRole = roleSelected ? role : initialRole;
  const navItems = NAV_BY_ROLE[displayRole] ?? NAV_BY_ROLE.operator;
  const RoleIcon = ROLE_ICONS[displayRole] ?? LayoutDashboard;
  const showProtectedChrome = !PUBLIC_PATHS.has(pathname);

  React.useEffect(() => {
    const nextTheme = resolveThemeFromStorage();
    setTheme(nextTheme);
    window.localStorage.setItem('pc-theme', nextTheme);
    window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }, []);

  React.useEffect(() => {
    if (!roleSelected) setRole(initialRole);
  }, [initialRole, roleSelected, setRole]);

  React.useEffect(() => {
    if (!pathname.startsWith('/platform-v7')) return;
    if (pathname.startsWith('/platform-v7/ai')) {
      router.replace(ROLE_HOME[displayRole]);
      return;
    }
    if (showProtectedChrome && isForeignRolePath(pathname, displayRole)) {
      router.replace(ROLE_HOME[displayRole]);
    }
  }, [displayRole, pathname, router, showProtectedChrome]);

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const toggleTheme = React.useCallback(() => {
    setTheme((previous) => {
      const next = previous === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('pc-theme', next);
      window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  return (
    <div className="pc-shell-root-v4" style={{ minHeight: '100dvh', background: 'var(--pc-bg)', overflowX: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { overflow-x: hidden; max-width: 100%; }
        *, *::before, *::after { box-sizing: border-box; }
        .pc-v4-header { position: sticky; top: 0; z-index: 100; background: color-mix(in srgb, var(--pc-bg-header) 94%, transparent); backdrop-filter: blur(18px); border-bottom: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-sm); }
        .pc-v4-header-inner { max-width: 1440px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 8px) 16px 8px; display: grid; gap: 8px; }
        .pc-v4-top { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; }
        .pc-v4-brand { display: flex; align-items: center; gap: 12px; min-width: 0; text-decoration: none; color: inherit; }
        .pc-v4-title { display: block; font-size: 16px; font-weight: 950; color: var(--pc-text-primary); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-v4-subtitle { display: block; font-size: 11px; color: var(--pc-text-muted); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-v4-actions { display: flex; align-items: center; gap: 8px; justify-content: flex-end; min-width: 0; }
        .pc-v4-iconbtn { position: relative; min-width: 44px; min-height: 44px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-search { min-height: 44px; min-width: 180px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); display: inline-flex; align-items: center; gap: 10px; padding: 0 14px; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-stage { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; border-radius: 999px; padding: 0 11px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); font-size: 11px; font-weight: 900; white-space: nowrap; }
        .pc-v4-main { max-width: 1440px; margin: 0 auto; padding: 18px 16px calc(env(safe-area-inset-bottom) + 92px); }
        .pc-v4-drawer { position: fixed; top: 0; bottom: 0; left: 0; width: 360px; max-width: 88vw; z-index: 120; transform: translateX(-100%); transition: transform 0.2s ease; background: var(--pc-bg-card); border-right: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-lg); display: flex; flex-direction: column; }
        .pc-v4-drawer[data-open='true'] { transform: translateX(0); }
        .pc-v4-nav { display: grid; gap: 6px; padding: 12px; overflow-y: auto; }
        .pc-v4-nav-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; text-decoration: none; padding: 10px 11px; border-radius: 16px; border: 1px solid transparent; background: transparent; color: var(--pc-text-secondary); }
        .pc-v4-nav-item[data-active='true'] { background: var(--pc-accent-bg); border-color: var(--pc-accent-border); color: var(--pc-accent-strong); }
        .pc-v4-nav-label { display: block; font-size: 13px; font-weight: 900; color: var(--pc-text-primary); }
        .pc-v4-nav-note { display: block; font-size: 11px; color: var(--pc-text-muted); margin-top: 2px; line-height: 1.35; }
        .pc-v4-bottomnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 96; padding: 7px 10px calc(env(safe-area-inset-bottom) + 7px); background: color-mix(in srgb, var(--pc-bg-header) 96%, transparent); backdrop-filter: blur(18px); border-top: 1px solid var(--pc-border); box-shadow: 0 -10px 28px rgba(3,8,7,0.10); }
        .pc-v4-bottomnav-inner { max-width: 720px; margin: 0 auto; width: 100%; display: flex; gap: 4px; justify-content: space-around; }
        .pc-v4-bn-item { flex: 1 1 0; min-width: 0; display: grid; justify-items: center; gap: 3px; padding: 6px 4px; border-radius: 14px; text-decoration: none; color: var(--pc-text-muted); border: 1px solid transparent; }
        .pc-v4-bn-item[data-active='true'] { color: var(--pc-accent-strong); background: var(--pc-accent-bg); border-color: var(--pc-accent-border); }
        .pc-v4-bn-label { font-size: 10.5px; font-weight: 850; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.1; }
        @media (max-width: 760px) { .pc-v4-search strong, .pc-v4-stage { display: none; } .pc-v4-title { font-size: 14px; } }
      ` }} />

      <header className="pc-v4-header">
        <div className="pc-v4-header-inner">
          <div className="pc-v4-top">
            <Link href={ROLE_HOME[displayRole]} className="pc-v4-brand">
              <BrandMark size={34} />
              <span style={{ minWidth: 0 }}>
                <span className="pc-v4-title">Прозрачная Цена</span>
                <span className="pc-v4-subtitle">Кабинет: {ROLE_LABELS[displayRole]}</span>
              </span>
            </Link>
            <button type="button" className="pc-v4-search" aria-label="Поиск по платформе">
              <Search size={17} />
              <strong>Поиск</strong>
            </button>
            <div className="pc-v4-actions">
              <span className="pc-v4-stage"><RoleIcon size={15} /> controlled pilot</span>
              <button type="button" className="pc-v4-iconbtn" aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'} onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button type="button" className="pc-v4-iconbtn" aria-label="Уведомления">
                <Bell size={18} />
              </button>
              <button type="button" className="pc-v4-iconbtn" aria-label="Открыть меню" onClick={() => setSidebarOpen(true)}>
                <Menu size={19} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <aside className="pc-v4-drawer" data-open={sidebarOpen} aria-label="Навигация роли">
        <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--pc-border)' }}>
          <strong>{ROLE_LABELS[displayRole]}</strong>
          <button type="button" className="pc-v4-iconbtn" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <nav className="pc-v4-nav" aria-label="Навигация роли">
          {navItems.map((item) => {
            const Icon = SECTION_ICONS[item.icon];
            return (
              <Link key={item.href} href={item.href} className="pc-v4-nav-item" data-active={isActivePath(pathname, item.href)}>
                <Icon size={18} />
                <span>
                  <span className="pc-v4-nav-label">{item.label}</span>
                  {item.note ? <span className="pc-v4-nav-note">{item.note}</span> : null}
                </span>
              </Link>
            );
          })}
        </nav>
        <p style={{ margin: 'auto 14px 14px', color: 'var(--pc-text-muted)', fontSize: 12, lineHeight: 1.5 }}>Доступ ограничен функциями текущей роли.</p>
      </aside>

      <main className="pc-v4-main">{children}</main>

      {showProtectedChrome ? (
        <nav className="pc-v4-bottomnav" aria-label="Навигация кабинета">
          <div className="pc-v4-bottomnav-inner">
            {navItems.slice(0, 5).map((item) => {
              const Icon = SECTION_ICONS[item.icon];
              return (
                <Link key={item.href} href={item.href} className="pc-v4-bn-item" data-active={isActivePath(pathname, item.href)}>
                  <Icon size={18} />
                  <span className="pc-v4-bn-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
