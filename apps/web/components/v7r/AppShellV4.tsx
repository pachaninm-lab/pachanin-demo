'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
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
import { CommandPalette } from '@/components/v7r/CommandPalette';
import { BrandMark } from '@/components/v7r/BrandMark';
import { platformV7NavByRole, platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';
import { PLATFORM_V7_AI_ROUTE } from '@/lib/platform-v7/routes';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';
import styles from './AppShellV4.module.css';

const NOTIFICATIONS_ROUTE = '/platform-v7/notifications';

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

const ROLE_STAGE: Record<PlatformRole, { label: string; tone: 'pilot' | 'test' | 'field' }> = {
  operator: { label: 'Рабочий контур', tone: 'pilot' },
  buyer: { label: 'Рабочий контур', tone: 'pilot' },
  seller: { label: 'Рабочий контур', tone: 'pilot' },
  logistics: { label: 'Рабочий контур', tone: 'pilot' },
  executive: { label: 'Рабочий контур', tone: 'pilot' },
  bank: { label: 'Контур проверки', tone: 'test' },
  arbitrator: { label: 'Контур проверки', tone: 'test' },
  compliance: { label: 'Контур проверки', tone: 'test' },
  driver: { label: 'Полевой режим', tone: 'field' },
  surveyor: { label: 'Полевой режим', tone: 'field' },
  elevator: { label: 'Полевой режим', tone: 'field' },
  lab: { label: 'Полевой режим', tone: 'field' },
};

// Bank nav copy policy — wording enforced by platformV7ShellBankSafeCopy.test.ts.
// The platform shows reserve status and bank-controlled decisions; it never claims to release money autonomously.
const BANK_NAV_COPY_POLICY = [
  { section: 'reserve', note: 'резерв и банковская проверка' },
  { section: 'conditions', note: 'резерв и условия банка' },
  { section: 'hold', note: 'резерв, удержание, подтверждение' },
] as const;
void BANK_NAV_COPY_POLICY;

const ROLE_ICONS: Record<PlatformRole, LucideIcon> = {
  operator: LayoutDashboard,
  buyer: Briefcase,
  seller: Wheat,
  logistics: Truck,
  driver: User,
  surveyor: ShieldCheck,
  elevator: Building2,
  lab: FlaskConical,
  bank: Landmark,
  arbitrator: Gavel,
  compliance: ShieldCheck,
  executive: BarChart3,
};

const CRUMB_LABELS: Record<string, string> = {
  'platform-v7': 'Прозрачная Цена',
  'control-tower': 'Центр управления',
  deals: 'Сделки',
  lots: 'Лоты',
  create: 'Создание',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логистика',
  field: 'Поле и приёмка',
  bank: 'Банк',
  disputes: 'Споры',
  compliance: 'Комплаенс',
  analytics: 'Сводка',
  executive: 'Сводка',
  procurement: 'Закупки',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  arbitrator: 'Арбитр',
  connectors: 'Подключения',
  investor: 'Инвестор',
  demo: 'Сценарий сделки',
  market: 'Лоты и запросы',
  notifications: 'Уведомления',
  'execution-map': 'Карта исполнения',
  ai: 'AI-помощник',
};

function breadcrumbs(pathname: string) {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  return parts.map((part, index) => ({
    href: '/' + parts.slice(0, index + 1).join('/'),
    label: CRUMB_LABELS[part] ?? part,
    isLast: index === parts.length - 1,
  }));
}

function iconForHref(href: string): LucideIcon {
  if (href.includes('/control-tower')) return LayoutDashboard;
  if (href.includes('/deals')) return FolderOpen;
  if (href.includes('/lots') || href.includes('/seller')) return Wheat;
  if (href.includes('/procurement')) return FileText;
  if (href.includes('/logistics')) return Truck;
  if (href.includes('/driver')) return User;
  if (href.includes('/surveyor')) return ShieldCheck;
  if (href.includes('/elevator')) return Building2;
  if (href.includes('/lab')) return FlaskConical;
  if (href.includes('/bank')) return Landmark;
  if (href.includes('/arbitrator')) return Gavel;
  if (href.includes('/compliance') || href.includes('/trust')) return ShieldCheck;
  if (href.includes('/executive') || href.includes('/reports')) return BarChart3;
  if (href === PLATFORM_V7_AI_ROUTE || href.includes('/ai')) return Search;
  return LayoutDashboard;
}

export function AppShellV4({ children, initialRole = 'operator' }: { children: React.ReactNode; initialRole?: PlatformRole }) {
  const pathname = usePathname();
  const { role, setRole } = usePlatformV7RStore();
  const [mounted, setMounted] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    usePlatformV7RStore.persist.rehydrate();
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('pc-theme') : null;
    const storedVersion = typeof window !== 'undefined' ? window.localStorage.getItem(PLATFORM_V7_THEME_VERSION_KEY) : null;
    const nextTheme: 'light' | 'dark' = stored === 'dark' && storedVersion === PLATFORM_V7_LIGHT_DEFAULT_VERSION ? 'dark' : 'light';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pc-theme', nextTheme);
      window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
    }
    document.documentElement.setAttribute('data-theme', nextTheme);
  }, []);

  React.useEffect(() => {
    if (!mounted || role) return;
    setRole(initialRole);
  }, [mounted, role, setRole, initialRole]);

  React.useEffect(() => {
    setSidebarOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }
      if (!isTyping && event.key === '/') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme((previous) => {
      const next = previous === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pc-theme', next);
        window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
      }
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const displayRole: PlatformRole = mounted ? (role || initialRole) : initialRole;
  const items = platformV7NavByRole(displayRole);
  const stage = ROLE_STAGE[displayRole];
  const crumbs = breadcrumbs(pathname);
  const showCrumbs = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles' && crumbs.length > 1;
  const RoleIcon = ROLE_ICONS[displayRole];
  const roleHomeHref = platformV7RoleRoute(displayRole);
  const showCabinetChrome = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles';

  return (
    <div className={`pc-shell-root-v4 ${styles.root}`}>
      {sidebarOpen ? (
        <button className={styles.backdrop} type='button' onClick={() => setSidebarOpen(false)} aria-label='Закрыть меню' />
      ) : null}

      <aside className={styles.drawer} data-open={sidebarOpen ? 'true' : 'false'} aria-label='Основное меню'>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTop}>
            <Link href={roleHomeHref} className={styles.brand} aria-label='Прозрачная Цена — в мой кабинет' onClick={() => setSidebarOpen(false)}>
              <BrandMark size={36} />
              <span className={styles.brandCopy}>
                <span className={styles.title}>Прозрачная Цена</span>
                <span className={styles.subtitle}>Контур исполнения сделки</span>
              </span>
            </Link>
            <button className={styles.iconButton} type='button' onClick={() => setSidebarOpen(false)} aria-label='Закрыть меню'>
              <X size={18} aria-hidden='true' />
            </button>
          </div>

          <div className={styles.roleCard}>
            <div className={styles.roleTop}>
              <span className={styles.roleLabel}><RoleIcon size={17} aria-hidden='true' />{ROLE_LABELS[displayRole]}</span>
              <span className={styles.stage} data-tone={stage.tone}>{stage.label}</span>
            </div>
            <p className={styles.roleNote}>Внешние подключения требуют договоров, доступов и подтверждения на реальных сделках.</p>
          </div>
        </div>

        <nav className={styles.nav}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = iconForHref(item.href);
            return (
              <Link key={item.href} href={item.href} className={styles.navItem} data-active={active ? 'true' : 'false'} aria-current={active ? 'page' : undefined}>
                <span className={styles.navIcon}><Icon size={18} aria-hidden='true' /></span>
                <span className={styles.navCopy}><span className={styles.navLabel}>{item.label}</span></span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.top}>
            <button className={styles.iconButton} type='button' onClick={() => setSidebarOpen(true)} aria-label='Открыть меню'>
              <Menu size={19} aria-hidden='true' />
            </button>

            <Link href={roleHomeHref} className={styles.brand} aria-label='Прозрачная Цена — в мой кабинет'>
              <BrandMark size={38} />
              <span className={styles.brandCopy}>
                <span className={styles.title}>Прозрачная Цена</span>
                <span className={styles.subtitle}>Сделка · логистика · документы · деньги</span>
              </span>
            </Link>

            <div className={styles.actions}>
              <button className={styles.searchButton} type='button' onClick={() => setPaletteOpen(true)} aria-label='Открыть поиск'>
                <Search size={17} aria-hidden='true' />
                <strong>Поиск</strong>
                <span className={styles.searchHint}>⌘K</span>
              </button>
              <span className={styles.stage} data-tone={stage.tone}>{stage.label}</span>
              <button
                className={`pc-v4-theme-toggle ${styles.iconButton}`}
                type='button'
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
                title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              >
                {theme === 'dark' ? <Sun size={17} aria-hidden='true' /> : <Moon size={17} aria-hidden='true' />}
              </button>
              <Link className={styles.iconButton} href={NOTIFICATIONS_ROUTE} aria-label='Открыть уведомления' title='Уведомления'>
                <Bell size={17} aria-hidden='true' />
              </Link>
            </div>
          </div>

          <div className={styles.meta}>
            <nav className={styles.crumbs} aria-label='Путь'>
              {showCrumbs ? crumbs.map((crumb, index) => (
                <React.Fragment key={crumb.href}>
                  {index > 0 ? <span className={styles.crumbSeparator}>/</span> : null}
                  {crumb.isLast || crumb.href === '/platform-v7' ? (
                    <span className={`${styles.crumb} ${crumb.isLast ? styles.crumbCurrent : ''}`}>{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className={styles.crumbLink}>{crumb.label}</Link>
                  )}
                </React.Fragment>
              )) : <span className={styles.crumb}>Мой кабинет</span>}
            </nav>
          </div>
        </div>
      </header>

      <main className={styles.main} id='main-content'>
        {showCabinetChrome ? (
          <p className={styles.pilotNote}>
            Внешние контуры требуют договоров, доступов и подтверждений. Экран показывает основания, документы, статус, удержание и причину остановки.{' '}
            <Link href='/platform-v7/execution-map' className={styles.executionLink}>Карта исполнения</Link>
          </p>
        ) : null}
        {children}
      </main>

      {showCabinetChrome ? (
        <nav className={`pc-v4-bottomnav ${styles.bottomNav}`} aria-label='Навигация кабинета'>
          <div className={styles.bottomNavInner}>
            {items.slice(0, 5).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = iconForHref(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.bottomNavItem}
                  data-active={active ? 'true' : 'false'}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={styles.bottomNavIcon}><Icon size={20} aria-hidden='true' /></span>
                  <span className={styles.bottomNavLabel}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
