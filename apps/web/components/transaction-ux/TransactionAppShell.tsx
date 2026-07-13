'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
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
import { Button, StatusChip, Surface } from '@pc/design-system-v8';
import { CommandPalette } from '@/components/v7r/CommandPalette';
import { BrandMark } from '@/components/v7r/BrandMark';
import { NOTIFICATIONS, NOTIFICATION_GROUPS, type NotificationGroup } from '@/lib/v7r/data';
import { platformV7NavByRole, platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';
import { PLATFORM_V7_AI_ROUTE } from '@/lib/platform-v7/routes';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';
import styles from './TransactionAppShell.module.css';

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

const ROLE_STAGE: Record<PlatformRole, { label: string; tone: 'success' | 'information' | 'warning' }> = {
  operator: { label: 'Рабочий контур', tone: 'success' },
  buyer: { label: 'Рабочий контур', tone: 'success' },
  seller: { label: 'Рабочий контур', tone: 'success' },
  logistics: { label: 'Рабочий контур', tone: 'success' },
  executive: { label: 'Рабочий контур', tone: 'success' },
  bank: { label: 'Контур проверки', tone: 'information' },
  arbitrator: { label: 'Контур проверки', tone: 'information' },
  compliance: { label: 'Контур проверки', tone: 'information' },
  driver: { label: 'Полевой режим', tone: 'warning' },
  surveyor: { label: 'Полевой режим', tone: 'warning' },
  elevator: { label: 'Полевой режим', tone: 'warning' },
  lab: { label: 'Полевой режим', tone: 'warning' },
};

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
  notifications: 'Уведомления',
  'execution-map': 'Карта исполнения',
  ai: 'AI-помощник',
};

type StatusTone = 'success' | 'warning' | 'critical' | 'information';

type SystemStatus = {
  label: string;
  detail: string;
  tone: StatusTone;
  icon: LucideIcon;
};

function breadcrumbs(pathname: string) {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  return parts.map((part, index) => ({
    href: `/${parts.slice(0, index + 1).join('/')}`,
    label: CRUMB_LABELS[part] ?? part,
    isLast: index === parts.length - 1,
  }));
}

function systemStatuses(pathname: string): SystemStatus[] {
  return [
    {
      label: 'ФГИС',
      detail: pathname.startsWith('/platform-v7/connectors') ? 'требует проверки' : 'контур проверки',
      tone: 'warning',
      icon: ShieldCheck,
    },
    {
      label: 'Банк',
      detail: pathname.startsWith('/platform-v7/bank') ? 'ручная проверка' : 'ожидает подтверждение',
      tone: 'warning',
      icon: Landmark,
    },
    {
      label: 'Споры',
      detail: pathname.startsWith('/platform-v7/disputes') ? 'в работе' : 'без критического стопа',
      tone: pathname.startsWith('/platform-v7/disputes') ? 'critical' : 'success',
      icon: AlertTriangle,
    },
  ];
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

function groupNotifications() {
  return NOTIFICATIONS.reduce<Record<NotificationGroup, typeof NOTIFICATIONS>>((groups, item) => {
    (groups[item.group] ||= []).push(item);
    return groups;
  }, {} as Record<NotificationGroup, typeof NOTIFICATIONS>);
}

function activeRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TransactionAppShell({ children, initialRole = 'operator' }: { children: React.ReactNode; initialRole?: PlatformRole }) {
  const pathname = usePathname();
  const { role, setRole } = usePlatformV7RStore();
  const [mounted, setMounted] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [alertsSeen, setAlertsSeen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    usePlatformV7RStore.persist.rehydrate();
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const stored = window.localStorage.getItem('pc-theme');
    const storedVersion = window.localStorage.getItem(PLATFORM_V7_THEME_VERSION_KEY);
    const nextTheme: 'light' | 'dark' = stored === 'dark' && storedVersion === PLATFORM_V7_LIGHT_DEFAULT_VERSION ? 'dark' : 'light';
    setTheme(nextTheme);
    window.localStorage.setItem('pc-theme', nextTheme);
    window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }, []);

  React.useEffect(() => {
    if (!mounted || role) return;
    setRole(initialRole);
  }, [initialRole, mounted, role, setRole]);

  React.useEffect(() => {
    setSidebarOpen(false);
    setAlertsOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        setAlertsOpen(false);
        setPaletteOpen(false);
        return;
      }
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
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('pc-theme', next);
      window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const displayRole: PlatformRole = mounted ? (role || initialRole) : initialRole;
  const items = platformV7NavByRole(displayRole);
  const roleHomeHref = platformV7RoleRoute(displayRole);
  const stage = ROLE_STAGE[displayRole];
  const RoleIcon = ROLE_ICONS[displayRole];
  const crumbs = breadcrumbs(pathname);
  const showCrumbs = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles' && crumbs.length > 1;
  const statuses = systemStatuses(pathname);
  const groupedNotifications = React.useMemo(groupNotifications, []);
  const showWorkNavigation = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles';
  const hasUnread = !alertsSeen && NOTIFICATIONS.length > 0;

  return (
    <div className={`${styles.root} pc-shell-root-v4`} data-transaction-shell='v8'>
      {sidebarOpen ? (
        <button className={styles.overlay} type='button' aria-label='Закрыть основное меню' onClick={() => setSidebarOpen(false)} />
      ) : null}

      <aside className={`${styles.drawer} ${sidebarOpen ? styles.drawerOpen : ''}`} aria-label='Основное меню' aria-hidden={!sidebarOpen}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeading}>
            <Link href={roleHomeHref} className={styles.brand} aria-label='Прозрачная Цена — в мой кабинет' onClick={() => setSidebarOpen(false)}>
              <BrandMark size={36} />
              <span className={styles.brandCopy}>
                <span className={styles.title}>Прозрачная Цена</span>
                <span className={styles.subtitle}>Контур исполнения сделки</span>
              </span>
            </Link>
            <Button className={styles.iconButton} variant='secondary' onClick={() => setSidebarOpen(false)} aria-label='Закрыть меню'>
              <X size={19} aria-hidden='true' />
            </Button>
          </div>

          <Surface className={styles.roleCard} variant='subtle'>
            <div className={styles.roleLine}>
              <span className={styles.roleName}><RoleIcon size={18} aria-hidden='true' />{ROLE_LABELS[displayRole]}</span>
              <StatusChip tone={stage.tone}>{stage.label}</StatusChip>
            </div>
            <p className={styles.roleNote}>Внешние подключения требуют договоров, доступов и подтверждения на реальных сделках.</p>
          </Surface>
        </div>

        <nav className={styles.navigation} aria-label='Разделы кабинета'>
          {items.map((item) => {
            const active = activeRoute(pathname, item.href);
            const Icon = iconForHref(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.navIcon}><Icon size={19} aria-hidden='true' /></span>
                <span className={styles.navCopy}><span className={styles.navLabel}>{item.label}</span></span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className={`${styles.header} pc-v4-header`}>
        <div className={styles.headerInner}>
          <div className={styles.top}>
            <Button
              className={styles.iconButton}
              variant='secondary'
              onClick={() => setSidebarOpen(true)}
              aria-label='Открыть меню'
              aria-expanded={sidebarOpen}
            >
              <Menu size={20} aria-hidden='true' />
            </Button>

            <Link href={roleHomeHref} className={styles.brand} aria-label='Прозрачная Цена — в мой кабинет'>
              <BrandMark size={38} />
              <span className={styles.brandCopy}>
                <span className={styles.title}>Прозрачная Цена</span>
                <span className={styles.subtitle}>Сделка · логистика · документы · деньги</span>
              </span>
            </Link>

            <div className={`${styles.actions} pc-v4-actions`}>
              <Button className={styles.searchButton} variant='secondary' onClick={() => setPaletteOpen(true)} aria-label='Открыть поиск'>
                <Search size={18} aria-hidden='true' />
                <strong>Поиск</strong>
                <span className={styles.searchHint}>⌘K</span>
              </Button>
              <span className={styles.desktopStage}><StatusChip tone={stage.tone}>{stage.label}</StatusChip></span>
              <Button
                className={styles.iconButton}
                variant='secondary'
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
              >
                {theme === 'dark' ? <Sun size={18} aria-hidden='true' /> : <Moon size={18} aria-hidden='true' />}
              </Button>
              <div className={styles.notificationAnchor}>
                <Button
                  className={styles.iconButton}
                  variant='secondary'
                  onClick={() => {
                    setAlertsOpen((value) => !value);
                    setAlertsSeen(true);
                  }}
                  aria-label='Открыть уведомления'
                  aria-expanded={alertsOpen}
                >
                  <Bell size={18} aria-hidden='true' />
                  {hasUnread ? <span className={styles.unreadDot} aria-hidden='true' /> : null}
                </Button>
                {alertsOpen ? (
                  <section className={styles.alertPanel} aria-label='Уведомления'>
                    <div className={styles.alertHeader}>
                      <strong className={styles.alertTitle}>Уведомления</strong>
                      <Button className={styles.iconButton} variant='secondary' onClick={() => setAlertsOpen(false)} aria-label='Закрыть уведомления'>
                        <X size={17} aria-hidden='true' />
                      </Button>
                    </div>
                    {(Object.keys(groupedNotifications) as NotificationGroup[]).map((group) => (
                      <div className={styles.alertGroup} key={group}>
                        <div className={styles.alertGroupTitle}>{NOTIFICATION_GROUPS[group]}</div>
                        {groupedNotifications[group].map((item) => (
                          <Link key={item.id} href={item.href} className={styles.notification}>
                            <span className={styles.notificationCopy}>
                              <span className={styles.notificationText}>{item.text}</span>
                              <span className={styles.notificationTime}>{new Date(item.ts).toLocaleString('ru-RU')}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </section>
                ) : null}
              </div>
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
            <div className={styles.statuses} aria-label='Состояние внешних контуров'>
              {statuses.map((item) => {
                const Icon = item.icon;
                return (
                  <StatusChip key={item.label} tone={item.tone}>
                    <Icon size={14} aria-hidden='true' /> {item.label}: {item.detail}
                  </StatusChip>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main} id='main-content'>
        {showWorkNavigation ? (
          <p className={styles.integrationNote}>
            Внешние контуры требуют договоров, доступов и подтверждений. Экран показывает основания, документы, статус, удержание и причину остановки.{' '}
            <Link href='/platform-v7/execution-map' className={styles.integrationLink}>Карта исполнения</Link>
          </p>
        ) : null}
        {children}
      </main>

      {showWorkNavigation ? (
        <nav className={styles.bottomNavigation} aria-label='Навигация кабинета'>
          <div className={styles.bottomNavigationInner}>
            {items.slice(0, 5).map((item) => {
              const active = activeRoute(pathname, item.href);
              const Icon = iconForHref(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.bottomItem} ${active ? styles.bottomItemActive : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={21} aria-hidden='true' />
                  <span className={styles.bottomLabel}>{item.label}</span>
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
