'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
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
import { CommandPalette } from '@/components/v7r/CommandPalette';
import { BrandMark } from '@/components/v7r/BrandMark';
import { NOTIFICATIONS, NOTIFICATION_GROUPS, type NotificationGroup } from '@/lib/v7r/data';
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

const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  deals: FolderOpen,
  lots: Wheat,
  create: FileCheck,
  logistics: Truck,
  analytics: BarChart3,
  integrations: ShieldCheck,
  bank: Landmark,
  disputes: AlertTriangle,
  cabinet: Briefcase,
  procurement: FileText,
  receiving: Building2,
  lab: FlaskConical,
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

const NAV_BY_ROLE: Record<PlatformRole, Array<{ href: string; label: string; icon: SectionKey; note?: string }>> = {
  operator: [
    { href: '/platform-v7/control-tower', label: 'Центр управления', icon: 'dashboard', note: 'блокеры и следующий шаг' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'реестр и статусы' },
    { href: '/platform-v7/lots', label: 'Лоты и запросы', icon: 'lots', note: 'предсделочный контур' },
    { href: '/platform-v7/logistics', label: 'Логистика', icon: 'logistics', note: 'рейсы и отклонения' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank', note: 'резерв и банковская проверка' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes', note: 'удержания и доказательства' },
    { href: '/platform-v7/connectors', label: 'Подключения', icon: 'integrations', note: 'ФГИС, банк, ЭДО' },
    { href: '/platform-v7/executive', label: 'Сводка', icon: 'analytics', note: 'управленческий срез' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Кабинет', icon: 'cabinet', note: 'мои заявки и сделки' },
    { href: '/platform-v7/procurement', label: 'Закупки', icon: 'procurement', note: 'потребности и предложения' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'исполнение и документы' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank', note: 'резерв и условия банка' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Кабинет', icon: 'cabinet', note: 'мои партии и офферы' },
    { href: '/platform-v7/lots', label: 'Лоты и запросы', icon: 'lots', note: 'заявки и партии' },
    { href: '/platform-v7/lots/create', label: 'Создать лот', icon: 'create', note: 'партия к продаже' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'исполнение и деньги' },
  ],
  logistics: [
    { href: '/platform-v7/logistics', label: 'Диспетчерская', icon: 'logistics', note: 'заявки и рейсы' },
    { href: '/platform-v7/driver', label: 'Водитель', icon: 'cabinet', note: 'маршрут и события' },
    { href: '/platform-v7/elevator', label: 'Приёмка', icon: 'receiving', note: 'вес и документы' },
    { href: '/platform-v7/lab', label: 'Лаборатория', icon: 'lab', note: 'пробы и качество' },
  ],
  driver: [
    { href: '/platform-v7/driver', label: 'Маршрут', icon: 'logistics', note: 'рейс, фото, GPS' },
    { href: '/platform-v7/deals/DL-9103', label: 'Сделка', icon: 'deals', note: 'только свой рейс' },
  ],
  surveyor: [
    { href: '/platform-v7/surveyor', label: 'Назначения', icon: 'cabinet', note: 'осмотр и фиксация' },
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
    { href: '/platform-v7/bank', label: 'Банковый контур', icon: 'bank', note: 'резерв, удержание, подтверждение' },
    { href: '/platform-v7/bank/factoring', label: 'Факторинг', icon: 'bank', note: 'заявка и статус' },
    { href: '/platform-v7/bank/escrow', label: 'Эскроу', icon: 'bank', note: 'условия удержания' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'проверка условий' },
    { href: '/platform-v7/disputes', label: 'Удержания', icon: 'disputes', note: 'споры по деньгам' },
  ],
  arbitrator: [
    { href: '/platform-v7/arbitrator', label: 'Разбор', icon: 'analytics', note: 'решение по спору' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes', note: 'очередь арбитража' },
  ],
  compliance: [
    { href: '/platform-v7/compliance', label: 'Допуск', icon: 'cabinet', note: 'контрагенты и правила' },
    { href: '/platform-v7/connectors', label: 'Подключения', icon: 'integrations', note: 'внешние системы' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'проверка рисков' },
  ],
  executive: [
    { href: '/platform-v7/executive', label: 'Сводка', icon: 'analytics', note: 'деньги и риски' },
    { href: '/platform-v7/control-tower', label: 'Центр управления', icon: 'dashboard', note: 'операционная картина' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank', note: 'резерв и основания' },
  ],
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
};

const ROLE_OWNED_PREFIXES: Array<{ prefix: string; role: PlatformRole }> = [
  { prefix: '/platform-v7/control-tower', role: 'operator' },
  { prefix: '/platform-v7/operator', role: 'operator' },
  { prefix: '/platform-v7/buyer', role: 'buyer' },
  { prefix: '/platform-v7/procurement', role: 'buyer' },
  { prefix: '/platform-v7/seller', role: 'seller' },
  { prefix: '/platform-v7/lots', role: 'seller' },
  { prefix: '/platform-v7/logistics', role: 'logistics' },
  { prefix: '/platform-v7/driver', role: 'driver' },
  { prefix: '/platform-v7/surveyor', role: 'surveyor' },
  { prefix: '/platform-v7/elevator', role: 'elevator' },
  { prefix: '/platform-v7/lab', role: 'lab' },
  { prefix: '/platform-v7/bank', role: 'bank' },
  { prefix: '/platform-v7/arbitrator', role: 'arbitrator' },
  { prefix: '/platform-v7/disputes', role: 'arbitrator' },
  { prefix: '/platform-v7/compliance', role: 'compliance' },
  { prefix: '/platform-v7/connectors', role: 'compliance' },
  { prefix: '/platform-v7/executive', role: 'executive' },
  { prefix: '/platform-v7/analytics', role: 'executive' },
];

const PUBLIC_SHELL_PATHS = new Set<string>(['/platform-v7', '/platform-v7/roles']);

function breadcrumbs(pathname: string) {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  return parts.map((part, index) => ({
    href: '/' + parts.slice(0, index + 1).join('/'),
    label: CRUMB_LABELS[part] ?? part,
    isLast: index === parts.length - 1,
  }));
}

function roleOwnerForPath(pathname: string): PlatformRole | null {
  const match = ROLE_OWNED_PREFIXES.find((item) => pathname === item.prefix || pathname.startsWith(item.prefix + '/'));
  return match?.role ?? null;
}

function isSharedRolePath(pathname: string, role: PlatformRole) {
  if (role === 'operator' && ['/platform-v7/bank', '/platform-v7/disputes', '/platform-v7/logistics', '/platform-v7/lots', '/platform-v7/connectors', '/platform-v7/executive'].some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))) return true;
  if (role === 'executive' && ['/platform-v7/bank', '/platform-v7/control-tower'].some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))) return true;
  if (role === 'logistics' && ['/platform-v7/driver', '/platform-v7/elevator', '/platform-v7/lab'].some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))) return true;
  if (role === 'surveyor' && (pathname === '/platform-v7/disputes' || pathname.startsWith('/platform-v7/disputes/'))) return true;
  if (role === 'bank' && (pathname === '/platform-v7/disputes' || pathname.startsWith('/platform-v7/disputes/'))) return true;
  if (role === 'buyer' && (pathname === '/platform-v7/bank' || pathname.startsWith('/platform-v7/bank/'))) return true;
  return false;
}

function isForeignRolePath(pathname: string, role: PlatformRole) {
  if (isSharedRolePath(pathname, role)) return false;
  const owner = roleOwnerForPath(pathname);
  return Boolean(owner && owner !== role);
}

function stageColors(tone: 'pilot' | 'test' | 'field') {
  if (tone === 'pilot') return { bg: 'rgba(126,242,196,0.12)', border: 'rgba(126,242,196,0.24)', color: 'var(--pc-accent)' };
  if (tone === 'test') return { bg: 'rgba(92,158,255,0.12)', border: 'rgba(92,158,255,0.24)', color: '#2563EB' };
  return { bg: 'rgba(245,180,30,0.12)', border: 'rgba(245,180,30,0.24)', color: '#B45309' };
}

function statusPalette(tone: 'ok' | 'review' | 'risk') {
  if (tone === 'ok') return { bg: 'rgba(126,242,196,0.10)', border: 'rgba(126,242,196,0.22)', color: 'var(--pc-accent)' };
  if (tone === 'review') return { bg: 'rgba(245,180,30,0.10)', border: 'rgba(245,180,30,0.22)', color: '#B45309' };
  return { bg: 'rgba(255,139,144,0.10)', border: 'rgba(255,139,144,0.22)', color: '#B91C1C' };
}

function systemStatus(pathname: string) {
  return [
    { label: 'ФГИС', detail: pathname.startsWith('/platform-v7/connectors') ? 'требует проверки' : 'контур проверки', tone: 'review' as const, icon: ShieldCheck },
    { label: 'Банк', detail: pathname.startsWith('/platform-v7/bank') ? 'ручная проверка' : 'ожидает подтверждение', tone: 'review' as const, icon: Landmark },
    { label: 'Споры', detail: pathname.startsWith('/platform-v7/disputes') ? 'в работе' : 'без критического стопа', tone: pathname.startsWith('/platform-v7/disputes') ? 'risk' as const : 'ok' as const, icon: AlertTriangle },
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

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShellV4({ children, initialRole = 'operator' }: { children: React.ReactNode; initialRole?: PlatformRole }) {
  const rawPathname = usePathname();
  const pathname = rawPathname || '/platform-v7';
  const router = useRouter();
  const { role, setRole } = usePlatformV7RStore();
  const safeInitialRole: PlatformRole = initialRole || 'operator';
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

  const displayRole: PlatformRole = mounted ? (role || safeInitialRole) : safeInitialRole;
  const items = NAV_BY_ROLE[displayRole];
  const stage = ROLE_STAGE[displayRole];
  const stageTone = stageColors(stage.tone);
  const crumbs = breadcrumbs(pathname);
  const showProtectedChrome = !PUBLIC_SHELL_PATHS.has(pathname);
  const showCrumbs = showProtectedChrome && crumbs.length > 1;
  const statuses = systemStatus(pathname);
  const groupedNotifications = React.useMemo(() => groupNotifications(), []);
  const RoleIcon = ROLE_ICONS[displayRole];

  React.useEffect(() => {
    if (!mounted || role) return;
    setRole(safeInitialRole);
  }, [mounted, role, setRole, safeInitialRole]);

  React.useEffect(() => {
    if (!mounted || !pathname.startsWith('/platform-v7')) return;
    if (pathname.startsWith('/platform-v7/ai')) {
      router.replace(ROLE_HOME[displayRole]);
      return;
    }
    if (!PUBLIC_SHELL_PATHS.has(pathname) && isForeignRolePath(pathname, displayRole)) {
      router.replace(ROLE_HOME[displayRole]);
    }
  }, [mounted, pathname, router, displayRole]);

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
        window.localStorage.setItem(PLATFORM_V7_THEME_VERSION_KEY, PLATFORM_V7_LIGHT_DEFAULT_VERSION);
      }
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  return (
    <div className='pc-shell-root-v4' style={{ minHeight: '100dvh', background: 'var(--pc-bg)', overflowX: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { overflow-x: hidden; max-width: 100%; }
        *, *::before, *::after { box-sizing: border-box; }
        .pc-shell-root-v4 { --pc-header-offset: 98px; }
        .pc-v4-header { position: fixed; inset: 0 0 auto 0; z-index: 100; background: color-mix(in srgb, var(--pc-bg-header) 94%, transparent); backdrop-filter: blur(18px); border-bottom: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-sm); }
        .pc-v4-header-inner { max-width: 1440px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 8px) 16px 8px; display: grid; gap: 8px; }
        .pc-v4-top { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; }
        .pc-v4-brand { display: flex; align-items: center; gap: 12px; min-width: 0; text-decoration: none; color: inherit; }
        .pc-v4-title { display: block; font-size: 16px; font-weight: 950; color: var(--pc-text-primary); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-v4-subtitle { display: block; font-size: 11px; color: var(--pc-text-muted); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-v4-actions { display: flex; align-items: center; gap: 8px; justify-content: flex-end; min-width: 0; }
        .pc-v4-iconbtn { position: relative; min-width: 44px; min-height: 44px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-iconbtn:hover { color: var(--pc-text-primary); border-color: var(--pc-border-light); }
        .pc-v4-iconbtn:active, .pc-v4-bn-item:active, .pc-v4-nav-item:active { transform: none; }
        .pc-v4-search { min-height: 44px; min-width: 220px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); display: inline-flex; align-items: center; gap: 10px; padding: 0 14px; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-search strong { color: var(--pc-text-primary); font-size: 13px; }
        .pc-v4-stage { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; border-radius: 999px; padding: 0 11px; border: 1px solid var(--stage-border); background: var(--stage-bg); color: var(--stage-color); font-size: 11px; font-weight: 900; white-space: nowrap; }
        .pc-v4-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
        .pc-v4-crumbs { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
        .pc-v4-statuses { display: flex; align-items: center; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        .pc-v4-status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border-radius: 999px; border: 1px solid var(--status-border); background: var(--status-bg); color: var(--status-color); font-size: 11px; font-weight: 850; white-space: nowrap; }
        .pc-v4-main { max-width: 1440px; margin: 0 auto; padding: calc(var(--pc-header-offset) + 12px) 16px 24px; }
        .pc-v4-pilot-note { margin: 0 0 14px; padding: 10px 14px; border-radius: 16px; background: var(--pc-bg-card); border: 1px solid var(--pc-border); color: var(--pc-text-secondary); font-size: 12px; line-height: 1.55; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-drawer { position: fixed; top: 0; bottom: 0; left: 0; width: 360px; max-width: 88vw; z-index: 120; transform: translateX(-100%); transition: transform 0.2s ease; background: var(--pc-bg-card); border-right: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-lg); display: flex; flex-direction: column; }
        .pc-v4-drawer[data-open='true'] { transform: translateX(0); }
        .pc-v4-nav { display: grid; gap: 6px; padding: 12px; overflow-y: auto; }
        .pc-v4-nav-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; text-decoration: none; padding: 10px 11px; border-radius: 16px; border: 1px solid transparent; background: transparent; color: var(--pc-text-secondary); }
        .pc-v4-nav-item:hover { background: var(--pc-bg-elevated); border-color: var(--pc-border); }
        .pc-v4-nav-item[data-active='true'] { background: var(--pc-accent-bg); border-color: var(--pc-accent-border); color: var(--pc-accent-strong); }
        .pc-v4-nav-label { display: block; font-size: 13px; font-weight: 900; color: var(--pc-text-primary); }
        .pc-v4-nav-note { display: block; font-size: 11px; color: var(--pc-text-muted); margin-top: 2px; line-height: 1.35; }
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
        @media (max-width: 980px) {
          .pc-shell-root-v4 { --pc-header-offset: 92px; }
          .pc-v4-search { min-width: 44px; padding: 0 12px; }
          .pc-v4-search strong, .pc-v4-search span { display: none; }
          .pc-v4-stage { display: none; }
          .pc-v4-statuses { display: none; }
        }
        @media (max-width: 640px) {
          .pc-shell-root-v4 { --pc-header-offset: 82px; }
          .pc-v4-header-inner { padding: calc(env(safe-area-inset-top) + 7px) 10px 7px; gap: 6px; }
          .pc-v4-top { gap: 8px; }
          .pc-v4-subtitle, .pc-v4-crumbs { display: none; }
          .pc-v4-title { font-size: 14px; }
          .pc-v4-actions { gap: 6px; }
          .pc-v4-iconbtn, .pc-v4-search { min-width: 42px; min-height: 42px; border-radius: 13px; }
          .pc-v4-meta { display: none; }
          .pc-v4-main { padding: calc(var(--pc-header-offset) + 10px) 10px 20px; }
          .pc-v4-pilot-note { font-size: 11px; padding: 9px 11px; }
          .pc-v4-alert-panel { position: fixed; left: 10px; right: 10px; top: calc(env(safe-area-inset-top) + 62px); width: auto; max-width: none; }
        }
      ` }} />

      {sidebarOpen ? <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,7,0.62)', zIndex: 110 }} aria-hidden /> : null}

      <aside className='pc-v4-drawer' data-open={sidebarOpen ? 'true' : 'false'} aria-label='Меню текущей роли'>
        <div style={{ padding: 16, borderBottom: '1px solid var(--pc-border)', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div className='pc-v4-brand' aria-label='Прозрачная Цена'>
              <BrandMark size={36} />
              <span style={{ minWidth: 0 }}>
                <span className='pc-v4-title'>Прозрачная Цена</span>
                <span className='pc-v4-subtitle'>Контур исполнения сделки</span>
              </span>
            </div>
            <button className='pc-v4-iconbtn' onClick={() => setSidebarOpen(false)} aria-label='Закрыть меню'><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 16, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--pc-text-primary)', fontSize: 14, fontWeight: 950 }}><RoleIcon size={17} />{ROLE_LABELS[displayRole]}</span>
              <span className='pc-v4-stage' style={{ '--stage-bg': stageTone.bg, '--stage-border': stageTone.border, '--stage-color': stageTone.color } as React.CSSProperties}>{stage.label}</span>
            </div>
            <p style={{ margin: 0, color: 'var(--pc-text-muted)', fontSize: 12, lineHeight: 1.5 }}>Роль зафиксирована после входа. Чужой кабинет возвращает пользователя в свой контур.</p>
          </div>
        </div>

        <nav className='pc-v4-nav'>
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = SECTION_ICONS[item.icon];
            return (
              <Link key={item.href} href={item.href} className='pc-v4-nav-item' data-active={active ? 'true' : 'false'} aria-current={active ? 'page' : undefined} onClick={() => setSidebarOpen(false)}>
                <span style={{ color: iconTone(active), display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /></span>
                <span style={{ minWidth: 0 }}>
                  <span className='pc-v4-nav-label'>{item.label}</span>
                  {item.note ? <span className='pc-v4-nav-note'>{item.note}</span> : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--pc-border)', display: 'grid', gap: 10 }}>
          <div style={{ border: '1px solid var(--pc-border)', borderRadius: 16, background: 'var(--pc-bg-elevated)', padding: 12, color: 'var(--pc-text-muted)', fontSize: 12, lineHeight: 1.45 }}>
            Доступ ограничен функциями текущей роли.
          </div>
          <Link href='/platform-v7/execution-map' style={drawerUtilityLink} onClick={() => setSidebarOpen(false)}>Карта исполнения</Link>
        </div>
      </aside>

      <header className='pc-v4-header'>
        <div className='pc-v4-header-inner'>
          <div className='pc-v4-top'>
            <button className='pc-v4-iconbtn' onClick={() => setSidebarOpen(true)} aria-label='Открыть меню текущей роли'><Menu size={19} /></button>

            <Link href={showProtectedChrome ? ROLE_HOME[displayRole] : '/platform-v7'} className='pc-v4-brand' aria-label='Прозрачная Цена'>
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
              {showProtectedChrome ? <span className='pc-v4-stage' style={{ '--stage-bg': stageTone.bg, '--stage-border': stageTone.border, '--stage-color': stageTone.color } as React.CSSProperties}>{stage.label}</span> : null}
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
                  {crumb.isLast ? <span style={{ color: 'var(--pc-text-primary)', fontSize: 12, fontWeight: 900 }}>{crumb.label}</span> : <span style={{ color: 'var(--pc-text-muted)', fontSize: 12, fontWeight: 750 }}>{crumb.label}</span>}
                </React.Fragment>
              )) : <span style={{ color: 'var(--pc-text-muted)', fontSize: 12 }}>{showProtectedChrome ? ROLE_LABELS[displayRole] : 'Главный экран'}</span>}
            </nav>
            {showProtectedChrome ? (
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
            ) : null}
          </div>
        </div>
      </header>

      <main className='pc-v4-main' id='main-content'>
        {showProtectedChrome ? (
          <p className='pc-v4-pilot-note'>Внешние контуры требуют договоров, доступов и подтверждений. Экран показывает основания, документы, статус, удержание и причину остановки.</p>
        ) : null}
        {children}
      </main>

      {showProtectedChrome ? (
        <nav className='pc-v4-bottomnav' aria-label='Навигация кабинета'>
          <div className='pc-v4-bottomnav-inner'>
            {items.slice(0, 5).map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = SECTION_ICONS[item.icon];
              return (
                <Link key={item.href} href={item.href} className='pc-v4-bn-item' data-active={active ? 'true' : 'false'} aria-current={active ? 'page' : undefined}>
                  <span className='pc-v4-bn-icon'><Icon size={20} /></span>
                  <span className='pc-v4-bn-label'>{item.label}</span>
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

const drawerUtilityLink: React.CSSProperties = {
  textDecoration: 'none',
  padding: '10px 11px',
  borderRadius: 14,
  border: '1px solid var(--pc-border)',
  background: 'var(--pc-bg-elevated)',
  color: 'var(--pc-text-primary)',
  fontSize: 13,
  fontWeight: 850,
};
