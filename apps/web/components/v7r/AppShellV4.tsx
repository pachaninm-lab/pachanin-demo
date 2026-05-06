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
import { trackRoleSwitch } from '@/lib/analytics/track';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

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
  operator: { label: 'Пилотный режим', tone: 'pilot' },
  buyer: { label: 'Пилотный режим', tone: 'pilot' },
  seller: { label: 'Пилотный режим', tone: 'pilot' },
  logistics: { label: 'Пилотный режим', tone: 'pilot' },
  executive: { label: 'Пилотный режим', tone: 'pilot' },
  bank: { label: 'Тестовая среда', tone: 'test' },
  arbitrator: { label: 'Тестовая среда', tone: 'test' },
  compliance: { label: 'Тестовая среда', tone: 'test' },
  driver: { label: 'Полевой режим', tone: 'field' },
  surveyor: { label: 'Полевой режим', tone: 'field' },
  elevator: { label: 'Полевой режим', tone: 'field' },
  lab: { label: 'Полевой режим', tone: 'field' },
};

const ROLE_ROUTES: Record<PlatformRole, string> = {
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

const NAV_BY_ROLE: Record<PlatformRole, Array<{ href: string; label: string; icon: SectionKey; note?: string }>> = {
  operator: [
    { href: '/platform-v7/control-tower', label: 'Центр управления', icon: 'dashboard', note: 'блокеры и следующий шаг' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'реестр и статусы' },
    { href: '/platform-v7/lots', label: 'Лоты и запросы', icon: 'lots', note: 'предсделочный контур' },
    { href: '/platform-v7/logistics', label: 'Логистика', icon: 'logistics', note: 'рейсы и отклонения' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank', note: 'резерв и выпуск' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes', note: 'удержания и доказательства' },
    { href: '/platform-v7/connectors', label: 'Подключения', icon: 'integrations', note: 'ФГИС, банк, ЭДО' },
    { href: '/platform-v7/executive', label: 'Сводка', icon: 'analytics', note: 'управленческий срез' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Кабинет', icon: 'cabinet', note: 'мои заявки и сделки' },
    { href: '/platform-v7/procurement', label: 'Закупки', icon: 'procurement', note: 'потребности и предложения' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals', note: 'исполнение и документы' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank', note: 'резерв и условия выпуска' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Кабинет', icon: 'cabinet', note: 'мои партии и офферы' },
    { href: '/platform-v7/lots', label: 'Лоты и запросы', icon: 'lots', note: 'рынок заявок' },
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
    { href: '/platform-v7/bank', label: 'Банковый контур', icon: 'bank', note: 'резерв, удержание, выпуск' },
    { href: '/platform-v7/bank/factoring', label: 'Факторинг', icon: 'bank', note: 'предпилотный сценарий' },
    { href: '/platform-v7/bank/escrow', label: 'Эскроу', icon: 'bank', note: 'безопасная оплата' },
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
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank', note: 'резерв и выпуск' },
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
  demo: 'Демо-сценарий',
  market: 'Лоты и запросы',
  notifications: 'Уведомления',
};

function breadcrumbs(pathname: string) {
  const parts = pathname.split('?')[0].split('/').filter(Boolean);
  return parts.map((part, index) => ({
    href: '/' + parts.slice(0, index + 1).join('/'),
    label: CRUMB_LABELS[part] ?? part,
    isLast: index === parts.length - 1,
  }));
}

function inferRoleFromPath(pathname: string, currentRole: PlatformRole): PlatformRole {
  if (pathname.startsWith('/platform-v7/control-tower')) return 'operator';
  if (pathname.startsWith('/platform-v7/buyer') || pathname.startsWith('/platform-v7/procurement')) return 'buyer';
  if (pathname.startsWith('/platform-v7/seller') || pathname.startsWith('/platform-v7/lots')) return 'seller';
  if (pathname.startsWith('/platform-v7/logistics')) return 'logistics';
  if (pathname.startsWith('/platform-v7/driver')) return 'driver';
  if (pathname.startsWith('/platform-v7/surveyor')) return 'surveyor';
  if (pathname.startsWith('/platform-v7/elevator')) return 'elevator';
  if (pathname.startsWith('/platform-v7/lab')) return 'lab';
  if (pathname.startsWith('/platform-v7/bank')) return 'bank';
  if (pathname.startsWith('/platform-v7/arbitrator')) return 'arbitrator';
  if (pathname.startsWith('/platform-v7/compliance')) return 'compliance';
  if (pathname.startsWith('/platform-v7/analytics') || pathname.startsWith('/platform-v7/executive')) return 'executive';
  return currentRole;
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
      detail: pathname.startsWith('/platform-v7/connectors') ? 'нужна проверка' : 'связь отражена',
      tone: pathname.startsWith('/platform-v7/connectors') ? 'review' as const : 'ok' as const,
      icon: ShieldCheck,
    },
    {
      label: 'Банк',
      detail: pathname.startsWith('/platform-v7/bank') ? 'ручная проверка' : 'события получены',
      tone: pathname.startsWith('/platform-v7/bank') ? 'review' as const : 'ok' as const,
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

export function AppShellV4({ children, initialRole = 'operator' }: { children: React.ReactNode; initialRole?: PlatformRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole } = usePlatformV7RStore();
  const [mounted, setMounted] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');

  React.useEffect(() => {
    usePlatformV7RStore.persist.rehydrate();
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('pc-theme') : null;
    const nextTheme: 'light' | 'dark' = stored === 'light' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    const inferred = inferRoleFromPath(pathname, role || initialRole);
    if (inferred !== role) setRole(inferred);
  }, [pathname, role, setRole, mounted, initialRole]);

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
      if (typeof window !== 'undefined') window.localStorage.setItem('pc-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const switchRole = React.useCallback((nextRole: PlatformRole) => {
    setRole(nextRole);
    trackRoleSwitch(nextRole);
    router.push(ROLE_ROUTES[nextRole]);
  }, [router, setRole]);

  const displayRole: PlatformRole = mounted ? role : initialRole;
  const items = NAV_BY_ROLE[displayRole];
  const stage = ROLE_STAGE[displayRole];
  const stageTone = stageColors(stage.tone);
  const crumbs = breadcrumbs(pathname);
  const showCrumbs = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles' && crumbs.length > 1;
  const statuses = systemStatus(pathname);
  const groupedNotifications = React.useMemo(() => groupNotifications(), []);
  const RoleIcon = ROLE_ICONS[displayRole];

  return (
    <div className='pc-shell-root-v4' style={{ minHeight: '100dvh', background: 'var(--pc-bg)', overflowX: 'hidden' }}>
      <style>{`
        html, body { overflow-x: hidden; max-width: 100%; }
        *, *::before, *::after { box-sizing: border-box; }
        .pc-shell-root-v4 { --pc-header-offset: 116px; }
        .pc-v4-header { position: fixed; inset: 0 0 auto 0; z-index: 100; background: color-mix(in srgb, var(--pc-bg-header) 94%, transparent); backdrop-filter: blur(18px); border-bottom: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-sm); }
        .pc-v4-header-inner { max-width: 1440px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 10px) 16px 10px; display: grid; gap: 10px; }
        .pc-v4-top { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; }
        .pc-v4-brand { display: flex; align-items: center; gap: 12px; min-width: 0; text-decoration: none; color: inherit; }
        .pc-v4-title { font-size: 16px; font-weight: 950; color: var(--pc-text-primary); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-v4-subtitle { font-size: 11px; color: var(--pc-text-muted); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-v4-actions { display: flex; align-items: center; gap: 8px; justify-content: flex-end; min-width: 0; }
        .pc-v4-iconbtn { position: relative; min-width: 44px; min-height: 44px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-iconbtn:hover { color: var(--pc-text-primary); border-color: var(--pc-border-light); }
        .pc-v4-search { min-height: 44px; min-width: 260px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-secondary); display: inline-flex; align-items: center; gap: 10px; padding: 0 14px; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-search strong { color: var(--pc-text-primary); font-size: 13px; }
        .pc-v4-select { min-height: 44px; min-width: 164px; border: 1px solid var(--pc-border); border-radius: 14px; background: var(--pc-bg-card); color: var(--pc-text-primary); padding: 0 12px; font-size: 13px; font-weight: 800; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-stage { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; border-radius: 999px; padding: 0 11px; border: 1px solid var(--stage-border); background: var(--stage-bg); color: var(--stage-color); font-size: 11px; font-weight: 900; white-space: nowrap; }
        .pc-v4-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
        .pc-v4-crumbs { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
        .pc-v4-statuses { display: flex; align-items: center; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        .pc-v4-status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border-radius: 999px; border: 1px solid var(--status-border); background: var(--status-bg); color: var(--status-color); font-size: 11px; font-weight: 850; white-space: nowrap; }
        .pc-v4-main { max-width: 1440px; margin: 0 auto; padding: calc(var(--pc-header-offset) + 16px) 16px 24px; }
        .pc-v4-pilot-note { margin: 0 0 14px; padding: 10px 14px; border-radius: 16px; background: var(--pc-bg-card); border: 1px solid var(--pc-border); color: var(--pc-text-secondary); font-size: 12px; line-height: 1.55; box-shadow: var(--pc-shadow-sm); }
        .pc-v4-drawer { position: fixed; top: 0; bottom: 0; left: 0; width: 360px; max-width: 88vw; z-index: 120; transform: translateX(-100%); transition: transform 0.2s ease; background: var(--pc-bg-card); border-right: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-lg); display: flex; flex-direction: column; }
        .pc-v4-drawer[data-open='true'] { transform: translateX(0); }
        .pc-v4-nav { display: grid; gap: 6px; padding: 12px; overflow-y: auto; }
        .pc-v4-nav-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; text-decoration: none; padding: 10px 11px; border-radius: 16px; border: 1px solid transparent; background: transparent; color: var(--pc-text-secondary); }
        .pc-v4-nav-item:hover { background: var(--pc-bg-elevated); border-color: var(--pc-border); }
        .pc-v4-nav-item[data-active='true'] { background: var(--pc-accent-bg); border-color: var(--pc-accent-border); color: var(--pc-accent-strong); }
        .pc-v4-nav-label { font-size: 13px; font-weight: 900; color: var(--pc-text-primary); }
        .pc-v4-nav-note { font-size: 11px; color: var(--pc-text-muted); margin-top: 2px; line-height: 1.35; }
        .pc-v4-role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pc-v4-role-btn { min-height: 42px; border-radius: 12px; border: 1px solid var(--pc-border); background: var(--pc-bg-elevated); color: var(--pc-text-primary); font-size: 12px; font-weight: 850; cursor: pointer; }
        .pc-v4-role-btn[data-active='true'] { background: var(--pc-accent-bg); border-color: var(--pc-accent-border); color: var(--pc-accent-strong); }
        .pc-v4-alert-panel { position: absolute; right: 0; top: 50px; width: 370px; max-width: calc(100vw - 32px); max-height: 70vh; overflow: auto; border-radius: 18px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); box-shadow: var(--pc-shadow-lg); padding: 12px; display: grid; gap: 10px; }
        .pc-v4-notification { display: grid; gap: 4px; padding: 10px 11px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-elevated); text-decoration: none; }
        .pc-v4-mobile-role { display: none; }
        @media (max-width: 980px) {
          .pc-shell-root-v4 { --pc-header-offset: 128px; }
          .pc-v4-search { min-width: 44px; padding: 0 12px; }
          .pc-v4-search strong, .pc-v4-search span { display: none; }
          .pc-v4-select, .pc-v4-stage { display: none; }
          .pc-v4-mobile-role { display: inline-flex; align-items: center; justify-content: center; max-width: 138px; min-height: 44px; padding: 0 12px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); color: var(--pc-text-primary); font-size: 12px; font-weight: 850; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; box-shadow: var(--pc-shadow-sm); }
          .pc-v4-statuses { display: none; }
        }
        @media (max-width: 640px) {
          .pc-shell-root-v4 { --pc-header-offset: 118px; }
          .pc-v4-header-inner { padding: calc(env(safe-area-inset-top) + 8px) 10px 9px; }
          .pc-v4-top { grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; }
          .pc-v4-brand { gap: 9px; }
          .pc-v4-subtitle, .pc-v4-crumbs { display: none; }
          .pc-v4-title { font-size: 14px; }
          .pc-v4-actions { gap: 6px; }
          .pc-v4-iconbtn, .pc-v4-search, .pc-v4-mobile-role { min-width: 42px; min-height: 42px; border-radius: 13px; }
          .pc-v4-mobile-role { max-width: 112px; }
          .pc-v4-main { padding: calc(var(--pc-header-offset) + 12px) 10px 20px; }
          .pc-v4-pilot-note { font-size: 11px; padding: 9px 11px; }
          .pc-v4-alert-panel { position: fixed; left: 10px; right: 10px; top: calc(env(safe-area-inset-top) + 62px); width: auto; max-width: none; }
        }
      `}</style>

      {sidebarOpen ? <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,7,0.62)', zIndex: 110 }} aria-hidden /> : null}

      <aside className='pc-v4-drawer' data-open={sidebarOpen ? 'true' : 'false'} aria-label='Основное меню'>
        <div style={{ padding: 16, borderBottom: '1px solid var(--pc-border)', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <Link href='/platform-v7' className='pc-v4-brand' onClick={() => setSidebarOpen(false)}>
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
            <p style={{ margin: 0, color: 'var(--pc-text-muted)', fontSize: 12, lineHeight: 1.5 }}>Боевой контур не заявляется без подтверждённых подключений и реальных сделок.</p>
          </div>
        </div>

        <nav className='pc-v4-nav'>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = SECTION_ICONS[item.icon];
            return (
              <Link key={item.href} href={item.href} className='pc-v4-nav-item' data-active={active ? 'true' : 'false'}>
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
          <details style={{ border: '1px solid var(--pc-border)', borderRadius: 16, background: 'var(--pc-bg-elevated)', padding: 10 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 900 }}>Сменить роль</summary>
            <div className='pc-v4-role-grid' style={{ marginTop: 10 }}>
              {(Object.keys(ROLE_LABELS) as PlatformRole[]).map((item) => (
                <button key={item} type='button' className='pc-v4-role-btn' data-active={item === displayRole ? 'true' : 'false'} onClick={() => switchRole(item)}>{ROLE_LABELS[item]}</button>
              ))}
            </div>
          </details>

          <details style={{ border: '1px solid var(--pc-border)', borderRadius: 16, background: 'var(--pc-bg-elevated)', padding: 10 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 900 }}>Дополнительно</summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <Link href='/platform-v7/roles' style={drawerUtilityLink}>Все роли</Link>
              <Link href='/platform-v7/investor' style={drawerUtilityLink}>Инвесторский обзор</Link>
              <Link href='/platform-v7/demo' style={drawerUtilityLink}>Демо-сценарий</Link>
            </div>
          </details>
        </div>
      </aside>

      <header className='pc-v4-header'>
        <div className='pc-v4-header-inner'>
          <div className='pc-v4-top'>
            <button className='pc-v4-iconbtn' onClick={() => setSidebarOpen(true)} aria-label='Открыть меню'><Menu size={19} /></button>

            <Link href='/platform-v7' className='pc-v4-brand'>
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
              <select className='pc-v4-select' value={displayRole} onChange={(event) => switchRole(event.target.value as PlatformRole)} aria-label='Сменить роль'>
                {(Object.keys(ROLE_LABELS) as PlatformRole[]).map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
              </select>
              <button className='pc-v4-mobile-role' onClick={() => setSidebarOpen(true)} aria-label='Открыть роли'>{ROLE_LABELS[displayRole]}</button>
              <span className='pc-v4-stage' style={{ '--stage-bg': stageTone.bg, '--stage-border': stageTone.border, '--stage-color': stageTone.color } as React.CSSProperties}>{stage.label}</span>
              <button className='pc-v4-iconbtn' onClick={toggleTheme} aria-label='Сменить тему'>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
              <div style={{ position: 'relative' }}>
                <button className='pc-v4-iconbtn' onClick={() => setAlertsOpen((value) => !value)} aria-label='Открыть уведомления'>
                  <Bell size={17} />
                  <span style={{ position: 'absolute', right: 7, top: 7, width: 8, height: 8, borderRadius: 999, background: '#FF8B90', border: '2px solid var(--pc-bg-card)' }} />
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
                  {crumb.isLast ? <span style={{ color: 'var(--pc-text-primary)', fontSize: 12, fontWeight: 900 }}>{crumb.label}</span> : <Link href={crumb.href} style={{ color: 'var(--pc-text-muted)', fontSize: 12, fontWeight: 750, textDecoration: 'none' }}>{crumb.label}</Link>}
                </React.Fragment>
              )) : <span style={{ color: 'var(--pc-text-muted)', fontSize: 12 }}>Главный экран</span>}
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

      <main className='pc-v4-main' id='main-content'>
        {pathname !== '/platform-v7' && pathname !== '/platform-v7/roles' ? (
          <p className='pc-v4-pilot-note'>Контролируемый пилот. Не промышленная эксплуатация. Боевые подключения требуют договоров, доступов и подтверждения на реальных сделках.</p>
        ) : null}
        {children}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

const drawerUtilityLink = {
  textDecoration: 'none',
  padding: '10px 11px',
  borderRadius: 12,
  border: '1px solid var(--pc-border)',
  background: 'var(--pc-bg-card)',
  color: 'var(--pc-text-primary)',
  fontSize: 12,
  fontWeight: 850,
} as const;
