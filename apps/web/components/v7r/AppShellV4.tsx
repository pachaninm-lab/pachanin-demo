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
import { CommandPalette } from '@/components/v7r/CommandPalette';
import { BrandMark } from '@/components/v7r/BrandMark';
import { NOTIFICATIONS, NOTIFICATION_GROUPS, type NotificationGroup } from '@/lib/v7r/data';
import { platformV7NavByRole, platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';
import { PLATFORM_V7_AI_ROUTE } from '@/lib/platform-v7/routes';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_LIGHT_DEFAULT_VERSION, PLATFORM_V7_THEME_VERSION_KEY } from '@/components/v7r/PlatformThemeSync';

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

// Bank nav copy policy — wording enforced by platformV7ShellBankSafeCopy.test.ts
// The platform shows reserve status and bank-controlled decisions; it never claims to release money autonomously.
const BANK_NAV_COPY_POLICY = [
  { section: 'reserve', note: 'резерв и банковская проверка' },
  { section: 'conditions', note: 'резерв и условия банка' },
  { section: 'hold', note: 'резерв, удержание, подтверждение' },
] as const;

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

function stageColors(tone: 'pilot' | 'test' | 'field') {
  if (tone === 'pilot') return { bg: 'rgba(126,242,196,0.12)', border: 'rgba(126,242,196,0.24)', color: 'var(--pc-accent)' };
  if (tone === 'test') return { bg: 'rgba(92,158,255,0.12)', border: 'rgba(92,158,255,0.24)', color: '#93C5FD' };
  return { bg: 'rgba(245,180,30,0.12)', border: 'rgba(245,180,30,0.24)', color: '#F5B41E' };
}

function statusPalette(tone: 'ok' | 'review' | 'risk') {
  if (tone === 'ok') return { bg: 'rgba(126,242,196,0.10)', border: 'rgba(126,242,196,0.22)', color: 'var(--pc-accent)' };
  if (tone === 'review') return { bg: 'rgba(245,180,30,0.10)', border: 'rgba(245,180,30,0.22)', color: '#F5B41E' };
  return { bg: 'rgba(255,139,144,0.10)', border: 'rgba(255,139,144,0.22)', color: '#FF8B90' };
}

function systemStatus(pathname: string) {
  return [
    {
      label: 'ФГИС',
      detail: pathname.startsWith('/platform-v7/connectors') ? 'требует проверки' : 'контур проверки',
      tone: 'review' as const,
      icon: ShieldCheck,
    },
    {
      label: 'Банк',
      detail: pathname.startsWith('/platform-v7/bank') ? 'ручная проверка' : 'ожидает подтверждение',
      tone: 'review' as const,
      icon: Landmark,
    },
    {
      label: 'Споры',
      detail: pathname.startsWith('/platform-v7/disputes') ? 'в работе' : 'без критического стопа',
      tone: pathname.startsWith('/platform-v7/disputes') ? 'risk' as const : 'ok' as const,
      icon: AlertTriangle,
    },
  ];
}

function groupNotifications() {
  return NOTIFICATIONS.reduce<Record<NotificationGroup, typeof NOTIFICATIONS>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {} as Record<NotificationGroup, typeof NOTIFICATIONS>);
}

function iconTone(active: boolean) {
  return active ? 'var(--pc-accent)' : 'var(--pc-text-muted)';
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

function isPublicPlatformSurface(pathname: string) {
  return pathname === '/platform-v7' || pathname === '/platform-v7/' || pathname.startsWith('/platform-v7/login') || pathname.startsWith('/platform-v7/register');
}

export function AppShellV4({ children, initialRole = 'operator' }: { children: React.ReactNode; initialRole?: PlatformRole }) {
  const pathname = usePathname();
  const { role, setRole } = usePlatformV7RStore();
  const [mounted, setMounted] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [alertsSeen, setAlertsSeen] = React.useState(false);
  const hasUnread = !alertsSeen && NOTIFICATIONS.length > 0;
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
    setAlertsOpen(false);
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
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pc-theme', next);
        window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, next);
      }
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const displayRole: PlatformRole = mounted ? (role || initialRole) : initialRole;
  const items = platformV7NavByRole(displayRole);
  const stage = ROLE_STAGE[displayRole];
  const stageTone = stageColors(stage.tone);
  const crumbs = breadcrumbs(pathname);
  const isPublicSurface = isPublicPlatformSurface(pathname);
  const showCrumbs = !isPublicSurface && pathname !== '/platform-v7/roles' && crumbs.length > 1;
  const statuses = systemStatus(pathname);
  const groupedNotifications = React.useMemo(() => groupNotifications(), []);
  const RoleIcon = ROLE_ICONS[displayRole];
  const roleHomeHref = platformV7RoleRoute(displayRole);
  const showCabinetShell = !isPublicSurface;

  return (
    <div className={`pc-shell-root-v4${isPublicSurface ? ' pc-shell-root-v4-public' : ''}`} style={{ minHeight: '100dvh', background: 'var(--pc-bg)', overflowX: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { overflow-x: hidden; max-width: 100%; }
        *, *::before, *::after { box-sizing: border-box; }
        .pc-shell-root-v4 { --pc-header-offset: 98px; }
        .pc-shell-root-v4-public { --pc-header-offset: 0px; background: transparent !important; }
        .pc-v4-header { position: fixed; inset: 0 0 auto 0; z-index: 100; background: color-mix(in srgb, var(--pc-bg-header) 94%, transparent); backdrop-filter: blur(18px); border-bottom: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-sm); }
        .pc-v4-header-inner { max-width: 1440px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 8px) 16px 8px; display: grid; gap: 8px; }
        .pc-v4-top { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; }
        .pc-v4-brand { display: flex; align-items: center; gap: 12px; min-width: 0; text-decoration: none; color: inherit; }
        .pc-v4-title { font-size: 16px; font-weight: 950; color: var(--pc-text-primary); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-v4-subtitle { font-size: 11px; color: var(--pc-text-muted); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-v4-actions { display: flex; align-items: center; gap: 8px; justify-content: flex-end; min-width: 0; }
        .pc-v4-iconbtn { position: relative; min-width: 44px; min-height: 44px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-iconbtn:hover { color: var(--pc-text-primary); border-color: var(--pc-border-light); }
        .pc-v4-search { min-height: 44px; min-width: 260px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); display: inline-flex; align-items: center; gap: 10px; padding: 0 14px; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-search strong { color: var(--pc-text-primary); font-size: 13px; }
        .pc-v4-stage { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; border-radius: 999px; padding: 0 11px; border: 1px solid var(--stage-border); background: var(--stage-bg); color: var(--stage-color); font-size: 11px; font-weight: 900; white-space: nowrap; }
        .pc-v4-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
        .pc-v4-crumbs { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
        .pc-v4-statuses { display: flex; align-items: center; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        .pc-v4-status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border-radius: 999px; border: 1px solid var(--status-border); background: var(--status-bg); color: var(--status-color); font-size: 11px; font-weight: 850; white-space: nowrap; }
        .pc-v4-main { max-width: 1440px; margin: 0 auto; padding: calc(var(--pc-header-offset) + 12px) 16px 24px; }
        .pc-v4-main-public { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
        .pc-v4-pilot-note { margin: 0 0 14px; padding: 10px 14px; border-radius: 16px; background: var(--pc-bg-card); border: 1px solid var(--pc-border); color: var(--pc-text-secondary); font-size: 12px; line-height: 1.55; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-drawer { position: fixed; top: 0; bottom: 0; left: 0; width: 360px; max-width: 88vw; z-index: 120; transform: translateX(-100%); transition: transform 0.2s ease; background: var(--pc-bg-card); border-right: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-lg); display: flex; flex-direction: column; }
        .pc-v4-drawer[data-open='true'] { transform: translateX(0); }
        .pc-v4-nav { display: grid; gap: 6px; padding: 12px; overflow-y: auto; }
        .pc-v4-nav-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; text-decoration: none; padding: 10px 11px; border-radius: 16px; border: 1px solid transparent; background: transparent; color: var(--pc-text-secondary); }
        .pc-v4-nav-item:hover { background: var(--pc-bg-elevated); border-color: var(--pc-border); }
        .pc-v4-nav-item[data-active='true'] { background: var(--pc-accent-bg); border-color: var(--pc-accent-border); color: var(--pc-accent-strong); }
        .pc-v4-nav-label { font-size: 13px; font-weight: 900; color: var(--pc-text-primary); }
        .pc-v4-nav-note { font-size: 11px; color: var(--pc-text-muted); margin-top: 2px; line-height: 1.35; }
        .pc-v4-alert-panel { position: absolute; right: 0; top: 50px; width: 370px; max-width: calc(100vw - 32px); max-height: 70vh; overflow: auto; border-radius: 18px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); box-shadow: var(--pc-shadow-lg); padding: 12px; display: grid; gap: 10px; }
        .pc-v4-notification { display: grid; gap: 4px; padding: 10px 11px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-elevated); text-decoration: none; }
        .pc-v4-bottomnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 96; padding: 7px 10px calc(env(safe-area-inset-bottom) + 7px); background: color-mix(in srgb, var(--pc-bg-header) 96%, transparent); backdrop-filter: blur(18px); border-top: 1px solid var(--pc-border); box-shadow: 0 -10px 28px rgba(3,8,7,0.10); }
        .pc-v4-bottomnav-inner { max-width: 720px; margin: 0 auto; width: 100%; display: flex; gap: 4px; justify-content: space-around; }
        .pc-v4-bn-item { flex: 1 1 0; min-width: 0; display: grid; justify-items: center; gap: 3px; padding: 6px 4px; border-radius: 14px; text-decoration: none; color: var(--pc-text-muted); border: 1px solid transparent; transition: background 0.15s ease, color 0.15s ease; }
        .pc-v4-bn-item:hover { color: var(--pc-text-primary); }
        .pc-v4-bn-item[data-active='true'] { color: var(--pc-accent-strong); background: var(--pc-accent-bg); border-color: var(--pc-accent-border); }
        .pc-v4-bn-icon { display: inline-flex; align-items: center; justify-content: center; }
        .pc-v4-bn-label { font-size: 10.5px; font-weight: 850; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.1; }
        .pc-v4-main { padding-bottom: calc(env(safe-area-inset-bottom) + 84px) !important; }
        .pc-v4-main-public { padding: 0 !important; padding-bottom: 0 !important; }
        @media (max-width: 980px) {
          .pc-shell-root-v4 { --pc-header-offset: 92px; }
          .pc-shell-root-v4-public { --pc-header-offset: 0px; }
          .pc-v4-search { min-width: 44px; padding: 0 12px; }
          .pc-v4-search strong, .pc-v4-search span { display: none; }
          .pc-v4-stage { display: none; }
          .pc-v4-statuses { display: none; }
        }
        @media (max-width: 640px) {
          .pc-shell-root-v4 { --pc-header-offset: 82px; }
          .pc-shell-root-v4-public { --pc-header-offset: 0px; }
          .pc-v4-header-inner { padding: calc(env(safe-area-inset-top) + 7px) 10px 7px; gap: 6px; }
          .pc-v4-top { grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; }
          .pc-v4-brand { gap: 9px; }
          .pc-v4-subtitle, .pc-v4-crumbs { display: none; }
          .pc-v4-title { font-size: 14px; }
          .pc-v4-actions { gap: 6px; }
          .pc-v4-iconbtn, .pc-v4-search { min-width: 42px; min-height: 42px; border-radius: 13px; }
          .pc-v4-meta { display: none; }
          .pc-v4-main { padding: calc(var(--pc-header-offset) + 10px) 10px 20px; }
          .pc-v4-main-public { padding: 0 !important; padding-bottom: 0 !important; }
          .pc-v4-pilot-note { font-size: 11px; padding: 9px 11px; }
          .pc-v4-alert-panel { position: fixed; left: 10px; right: 10px; top: calc(env(safe-area-inset-top) + 62px); width: auto; max-width: none; }
        }
      ` }} />

      {showCabinetShell && sidebarOpen ? <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,7,0.62)', zIndex: 110 }} aria-hidden /> : null}

      {showCabinetShell ? (
        <aside className='pc-v4-drawer' data-open={sidebarOpen ? 'true' : 'false'} aria-label='Основное меню'>
          <div style={{ padding: 16, borderBottom: '1px solid var(--pc-border)', display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <Link href={roleHomeHref} className='pc-v4-brand' aria-label='Прозрачная Цена — в мой кабинет' onClick={() => setSidebarOpen(false)}>
                <BrandMark size={36} />
                <span style={{ minWidth: 0 }}>
                  <span className='pc-v4-title'>Прозрачная Цена</span>
                  <span className='pc-v4-subtitle'>Контур исполнения сделки</span>
                </span>
              </Link>
              <button className='pc-v4-iconbtn' onClick={() => setSidebarOpen(false)} aria-label='Закрыть меню'><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 16, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-elevated)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 950 }}><RoleIcon size={17} />{ROLE_LABELS[displayRole]}</span>
                <span className='pc-v4-stage' style={{ '--stage-bg': stageTone.bg, '--stage-border': stageTone.border, '--stage-color': stageTone.color } as React.CSSProperties}>{stage.label}</span>
              </div>
              <p style={{ margin: 0, color: 'var(--pc-text-muted)', fontSize: 12, lineHeight: 1.5 }}>Внешние подключения требуют договоров, доступов и подтверждения на реальных сделках.</p>
            </div>
          </div>

          <nav className='pc-v4-nav'>
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = iconForHref(item.href);
              return (
                <Link key={item.href} href={item.href} className='pc-v4-nav-item' data-active={active ? 'true' : 'false'}>
                  <span style={{ color: iconTone(active), display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className='pc-v4-nav-label'>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>
      ) : null}

      {showCabinetShell ? (
        <header className='pc-v4-header'>
          <div className='pc-v4-header-inner'>
            <div className='pc-v4-top'>
              <button className='pc-v4-iconbtn' onClick={() => setSidebarOpen(true)} aria-label='Открыть меню'><Menu size={19} /></button>

              <Link href={roleHomeHref} className='pc-v4-brand' aria-label='Прозрачная Цена — в мой кабинет'>
                <BrandMark size={38} />
                <span style={{ minWidth: 0 }}>
                  <span className='pc-v4-title'>Прозрачная Цена</span>
                  <span className='pc-v4-subtitle'>Сделка · логистика · документы · деньги</span>
                </span>
              </Link>

              <div className='pc-v4-actions'>
                <button className='pc-v4-search' onClick={() => setPaletteOpen(true)} aria-label='Открыть поиск'>
                  <Search size={17} />
                  <strong>Поиск</strong>
                  <span style={{ color: 'var(--pc-text-muted)', fontSize: 12 }}>⌘K</span>
                </button>
                <span className='pc-v4-stage' style={{ '--stage-bg': stageTone.bg, '--stage-border': stageTone.border, '--stage-color': stageTone.color } as React.CSSProperties}>{stage.label}</span>
                <button className='pc-v4-iconbtn pc-v4-theme-toggle' onClick={toggleTheme} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
                <div style={{ position: 'relative' }}>
                  <button className='pc-v4-iconbtn' onClick={() => { setAlertsOpen((value) => !value); setAlertsSeen(true); }} aria-label='Открыть уведомления'>
                    <Bell size={17} />
                    {hasUnread ? <span style={{ position: 'absolute', right: 7, top: 7, width: 8, height: 8, borderRadius: 999, background: '#FF8B90', border: '2px solid var(--pc-bg-card)' }} /> : null}
                  </button>
                  {alertsOpen ? (
                    <div className='pc-v4-alert-panel'>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <strong style={{ color: 'var(--pc-text-primary)', fontSize: 14 }}>Уведомления</strong>
                        <button className='pc-v4-iconbtn' onClick={() => setAlertsOpen(false)} aria-label='Закрыть уведомления' style={{ minWidth: 34, minHeight: 34, borderRadius: 12 }}><X size={15} /></button>
                      </div>
                      {(Object.keys(groupedNotifications) as NotificationGroup[]).map((group) => (
                        <div key={group} style={{ display: 'grid', gap: 6 }}>
                          <div style={{ color: 'var(--pc-text-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{NOTIFICATION_GROUPS[group]}</div>
                          {groupedNotifications[group].map((item) => (
                            <Link key={item.id} href={item.href} className='pc-v4-notification'>
                              <span style={{ color: 'var(--pc-text-primary)', fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>{item.text}</span>
                              <span style={{ color: 'var(--pc-text-muted)', fontSize: 11 }}>{new Date(item.ts).toLocaleString('ru-RU')}</span>
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className='pc-v4-meta'>
              <nav className='pc-v4-crumbs' aria-label='Путь'>
                {showCrumbs ? crumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 ? <span style={{ color: 'var(--pc-text-muted)', fontSize: 12 }}>/</span> : null}
                    {crumb.isLast || crumb.href === '/platform-v7' ? (
                      <span style={{ color: crumb.isLast ? 'var(--pc-text-primary)' : 'var(--pc-text-muted)', fontSize: 12, fontWeight: crumb.isLast ? 900 : 750 }}>{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} style={{ color: 'var(--pc-text-muted)', fontSize: 12, fontWeight: 750, textDecoration: 'none' }}>{crumb.label}</Link>
                    )}
                  </React.Fragment>
                )) : <span style={{ color: 'var(--pc-text-muted)', fontSize: 12 }}>Мой кабинет</span>}
              </nav>
              <div className='pc-v4-statuses'>
                {statuses.map((item) => {
                  const Icon = item.icon;
                  const tone = statusPalette(item.tone);
                  return (
                    <span key={item.label} className='pc-v4-status' style={{ '--status-bg': tone.bg, '--status-border': tone.border, '--status-color': tone.color } as React.CSSProperties}>
                      <Icon size={13} /> {item.label}: {item.detail}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </header>
      ) : null}

      <main className={`pc-v4-main${isPublicSurface ? ' pc-v4-main-public' : ''}`} id='main-content'>
        {showCabinetShell && pathname !== '/platform-v7/roles' ? (
          <p className='pc-v4-pilot-note'>Внешние контуры требуют договоров, доступов и подтверждений. Экран показывает основания, документы, статус, удержание и причину остановки.</p>
        ) : null}
        {children}
      </main>

      {showCabinetShell && pathname !== '/platform-v7/roles' ? (
        <nav className='pc-v4-bottomnav' aria-label='Навигация кабинета'>
          <div className='pc-v4-bottomnav-inner'>
            {items.slice(0, 5).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = iconForHref(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className='pc-v4-bn-item'
                  data-active={active ? 'true' : 'false'}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className='pc-v4-bn-icon'><Icon size={20} /></span>
                  <span className='pc-v4-bn-label'>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      {showCabinetShell ? <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
