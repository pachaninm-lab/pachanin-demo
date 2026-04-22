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
  ChevronRight,
  Compass,
  FileCheck,
  FileText,
  FlaskConical,
  FolderOpen,
  Gavel,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  Scale,
  Search,
  ShieldCheck,
  Sun,
  Truck,
  User,
  Wheat,
  X,
  type LucideIcon,
} from 'lucide-react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import { NOTIFICATIONS, NOTIFICATION_GROUPS, type NotificationGroup } from '@/lib/v7r/data';
import { CommandPalette } from '@/components/v7r/CommandPalette';
import { BrandMark } from '@/components/v7r/BrandMark';
import { trackRoleSwitch, trackGigaChatAsked } from '@/lib/analytics/track';

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

const ROLE_STAGE: Record<PlatformRole, { label: string; tone: 'pilot' | 'demo' | 'field' }> = {
  operator: { label: 'Controlled pilot', tone: 'pilot' },
  buyer: { label: 'Controlled pilot', tone: 'pilot' },
  seller: { label: 'Controlled pilot', tone: 'pilot' },
  logistics: { label: 'Controlled pilot', tone: 'pilot' },
  driver: { label: 'Полевой режим', tone: 'field' },
  surveyor: { label: 'Полевой режим', tone: 'field' },
  elevator: { label: 'Полевой режим', tone: 'field' },
  lab: { label: 'Полевой режим', tone: 'field' },
  bank: { label: 'Sandbox + callbacks', tone: 'demo' },
  arbitrator: { label: 'Sandbox + evidence', tone: 'demo' },
  compliance: { label: 'Sandbox + rules', tone: 'demo' },
  executive: { label: 'Controlled pilot', tone: 'pilot' },
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
  surveyor: Scale,
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
  | 'lab'
  | 'investor'
  | 'demo'
  | 'roles';

const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  deals: FolderOpen,
  lots: Wheat,
  create: FileCheck,
  logistics: Truck,
  analytics: BarChart3,
  integrations: Compass,
  bank: Landmark,
  disputes: AlertTriangle,
  cabinet: Briefcase,
  procurement: FileText,
  receiving: Building2,
  lab: FlaskConical,
  investor: BarChart3,
  demo: LayoutDashboard,
  roles: User,
};

const NAV_BY_ROLE: Record<PlatformRole, Array<{ href: string; label: string; icon: SectionKey }>> = {
  operator: [
    { href: '/platform-v7/control-tower', label: 'Control Tower', icon: 'dashboard' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals' },
    { href: '/platform-v7/lots', label: 'Лоты', icon: 'lots' },
    { href: '/platform-v7/logistics', label: 'Логистика', icon: 'logistics' },
    { href: '/platform-v7/executive', label: 'Аналитика', icon: 'analytics' },
    { href: '/platform-v7/connectors', label: 'Интеграции', icon: 'integrations' },
    { href: '/platform-v7/bank', label: 'Банк', icon: 'bank' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes' },
  ],
  buyer: [
    { href: '/platform-v7/buyer', label: 'Кабинет', icon: 'cabinet' },
    { href: '/platform-v7/procurement', label: 'Закупки', icon: 'procurement' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank' },
  ],
  seller: [
    { href: '/platform-v7/seller', label: 'Кабинет', icon: 'cabinet' },
    { href: '/platform-v7/lots', label: 'Лоты', icon: 'lots' },
    { href: '/platform-v7/lots/create', label: 'Создать лот', icon: 'create' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals' },
  ],
  logistics: [
    { href: '/platform-v7/logistics', label: 'Диспетчерская', icon: 'logistics' },
    { href: '/platform-v7/driver', label: 'Водитель', icon: 'cabinet' },
    { href: '/platform-v7/elevator', label: 'Приёмка', icon: 'receiving' },
    { href: '/platform-v7/lab', label: 'Лаборатория', icon: 'lab' },
  ],
  driver: [
    { href: '/platform-v7/driver', label: 'Маршрут', icon: 'logistics' },
    { href: '/platform-v7/deals/DL-9103', label: 'Сделка', icon: 'deals' },
  ],
  surveyor: [
    { href: '/platform-v7/surveyor', label: 'Назначения', icon: 'cabinet' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes' },
  ],
  elevator: [
    { href: '/platform-v7/elevator', label: 'Приёмка', icon: 'receiving' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals' },
  ],
  lab: [
    { href: '/platform-v7/lab', label: 'Пробы', icon: 'lab' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals' },
  ],
  bank: [
    { href: '/platform-v7/bank', label: 'Банковый контур', icon: 'bank' },
    { href: '/platform-v7/bank/factoring', label: 'Факторинг', icon: 'bank' },
    { href: '/platform-v7/bank/escrow', label: 'Эскроу', icon: 'bank' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals' },
    { href: '/platform-v7/disputes', label: 'Удержания', icon: 'disputes' },
  ],
  arbitrator: [
    { href: '/platform-v7/arbitrator', label: 'Разбор', icon: 'analytics' },
    { href: '/platform-v7/disputes', label: 'Споры', icon: 'disputes' },
  ],
  compliance: [
    { href: '/platform-v7/compliance', label: 'Допуск', icon: 'cabinet' },
    { href: '/platform-v7/connectors', label: 'Интеграции', icon: 'integrations' },
    { href: '/platform-v7/deals', label: 'Сделки', icon: 'deals' },
  ],
  executive: [
    { href: '/platform-v7/executive', label: 'Сводка', icon: 'analytics' },
    { href: '/platform-v7/control-tower', label: 'Control Tower', icon: 'dashboard' },
    { href: '/platform-v7/bank', label: 'Деньги', icon: 'bank' },
  ],
};

const CRUMB_LABELS: Record<string, string> = {
  'platform-v7': 'Прозрачная Цена',
  'control-tower': 'Control Tower',
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
  connectors: 'Интеграции',
  investor: 'Инвестор',
  demo: 'Демо',
  market: 'Рынок',
  notifications: 'Уведомления',
};

function stageColors(tone: 'pilot' | 'demo' | 'field') {
  if (tone === 'pilot') {
    return { bg: 'rgba(126,242,196,0.12)', border: 'rgba(126,242,196,0.22)', color: '#7EF2C4' };
  }
  if (tone === 'demo') {
    return { bg: 'rgba(92,158,255,0.12)', border: 'rgba(92,158,255,0.22)', color: '#93C5FD' };
  }
  return { bg: 'rgba(245,180,30,0.12)', border: 'rgba(245,180,30,0.22)', color: '#F5B41E' };
}

function statusPalette(tone: 'ok' | 'review' | 'risk') {
  if (tone === 'ok') {
    return { bg: 'rgba(126,242,196,0.10)', border: 'rgba(126,242,196,0.18)', color: '#7EF2C4' };
  }
  if (tone === 'review') {
    return { bg: 'rgba(245,180,30,0.10)', border: 'rgba(245,180,30,0.18)', color: '#F5B41E' };
  }
  return { bg: 'rgba(255,139,144,0.10)', border: 'rgba(255,139,144,0.18)', color: '#FF8B90' };
}

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

function gigaChatChips(pathname: string): string[] {
  const dealMatch = pathname.match(/\/deals\/([^/]+)/);
  if (dealMatch) {
    const id = dealMatch[1];
    return [
      `Почему сделка ${id} заблокирована?`,
      `Кто держит следующий шаг по ${id}?`,
      `Каких документов не хватает в ${id}?`,
      `Что нужно для выпуска денег по ${id}?`,
    ];
  }
  const lotMatch = pathname.match(/\/lots\/([^/]+)/);
  if (lotMatch && lotMatch[1] !== 'create') {
    const id = lotMatch[1];
    return [
      `Что за лот ${id}?`,
      `Какие документы нужны по ${id}?`,
      `Почему ${id} в REVIEW?`,
      `Как перевести ${id} в PASS?`,
    ];
  }
  if (pathname.startsWith('/platform-v7/disputes')) {
    return [
      'Почему спор держит деньги?',
      'Какие доказательства обязательны?',
      'Кто следующий владелец по спору?',
      'Что нужно для закрытия спора?',
    ];
  }
  if (pathname.startsWith('/platform-v7/bank')) {
    return [
      'Почему деньги стоят?',
      'Какой блокер сейчас главный?',
      'Что нужно для release?',
      'Есть ли конфликт по callback?',
    ];
  }
  return [
    'Почему выпуск заблокирован?',
    'Кто держит следующий шаг?',
    'Каких документов не хватает?',
    'Куда идти дальше?',
  ];
}

function systemStatus(pathname: string) {
  return [
    {
      label: 'ФГИС',
      detail: pathname.startsWith('/platform-v7/connectors') ? 'проверка' : 'контур',
      tone: pathname.startsWith('/platform-v7/connectors') ? 'review' as const : 'ok' as const,
      icon: ShieldCheck,
    },
    {
      label: 'Банк',
      detail: pathname.startsWith('/platform-v7/bank') ? 'ручной review' : 'callbacks',
      tone: pathname.startsWith('/platform-v7/bank') ? 'review' as const : 'ok' as const,
      icon: Landmark,
    },
    {
      label: 'Споры',
      detail: pathname.startsWith('/platform-v7/disputes') ? 'в фокусе' : 'evidence-first',
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

export function AppShellV3({ children, initialRole = 'operator' }: { children: React.ReactNode; initialRole?: PlatformRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, clearRoleSelection } = usePlatformV7RStore();
  const [mounted, setMounted] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const gSequenceRef = React.useRef(false);

  React.useEffect(() => {
    usePlatformV7RStore.persist.rehydrate();
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('pc-theme') : null;
    const nextTheme: 'light' | 'dark' = stored === 'light' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    const inferred = inferRoleFromPath(pathname, role || initialRole);
    if (inferred !== role) setRole(inferred);
  }, [pathname, role, setRole, mounted, initialRole]);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pc-theme', next);
      }
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const displayRole: PlatformRole = mounted ? role : initialRole;
  const items = NAV_BY_ROLE[displayRole];
  const stage = ROLE_STAGE[displayRole];
  const stageTone = stageColors(stage.tone);
  const crumbs = breadcrumbs(pathname);
  const showCrumbs = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles' && crumbs.length > 1;
  const statuses = systemStatus(pathname);
  const chips = gigaChatChips(pathname);
  const groupedNotifications = React.useMemo(() => groupNotifications(), []);
  const showBanner = pathname !== '/platform-v7' && pathname !== '/platform-v7/roles';
  const RoleIcon = ROLE_ICONS[displayRole];

  React.useEffect(() => {
    setSidebarOpen(false);
    setAlertsOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }

      if (!isTyping && event.key === '/') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (isTyping) return;

      if (gSequenceRef.current) {
        gSequenceRef.current = false;
        if (event.key.toLowerCase() === 'd') {
          event.preventDefault();
          router.push('/platform-v7/control-tower');
          return;
        }
        if (event.key.toLowerCase() === 's') {
          event.preventDefault();
          router.push('/platform-v7/deals');
          return;
        }
        if (event.key.toLowerCase() === 'l') {
          event.preventDefault();
          router.push('/platform-v7/lots');
          return;
        }
      }

      if (event.key.toLowerCase() === 'g') {
        gSequenceRef.current = true;
        window.setTimeout(() => {
          gSequenceRef.current = false;
        }, 900);
        return;
      }

      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        router.push('/platform-v7/lots/create');
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div className='pc-shell-root' style={{ minHeight: '100dvh', background: 'var(--pc-bg)', overflowX: 'hidden' }}>
      <style>{`
        html, body { overflow-x: hidden; max-width: 100%; }
        *, *::before, *::after { box-sizing: border-box; }
        .pc-shell-root { --pc-header-offset: 148px; }
        .pc-shell-header { max-width: 1440px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 10px) 16px 12px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
        .pc-shell-header > * { min-width: 0; }
        .pc-header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
        .pc-header-brand { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1 1 auto; }
        .pc-brand-copy { min-width: 0; display: grid; gap: 2px; }
        .pc-brand-title { font-size: 16px; font-weight: 900; color: var(--pc-text-primary); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-brand-subtitle { font-size: 11px; color: var(--pc-text-muted); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-brand-crumbs { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
        .pc-header-actions { display: flex; align-items: center; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
        .pc-header-search { width: 100%; min-width: 0; max-width: none !important; display: flex; align-items: center; gap: 10px; padding: 11px 14px; min-height: 48px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); cursor: pointer; box-shadow: var(--pc-shadow-sm); }
        .pc-alert-panel { position: absolute; right: 0; top: 52px; width: 360px; max-width: calc(100vw - 32px); background: var(--pc-bg-card); border: 1px solid var(--pc-border); border-radius: 16px; box-shadow: var(--pc-shadow-lg); padding: 10px; z-index: 71; max-height: 70vh; overflow-y: auto; overflow-x: hidden; }
        .pc-role-banner { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 16px; background: linear-gradient(180deg, rgba(20,33,29,0.92) 0%, rgba(14,23,20,0.98) 100%); border: 1px solid var(--pc-border); margin-bottom: 14px; font-size: 12px; color: var(--pc-text-secondary); flex-wrap: wrap; box-shadow: var(--pc-shadow-sm); }
        .pc-giga { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 14px; border-radius: 18px; background: linear-gradient(180deg, rgba(22,37,32,0.96) 0%, rgba(11,21,19,0.98) 100%); border: 1px solid var(--pc-accent-border); margin-top: 12px; box-shadow: var(--pc-shadow-sm); }
        .pc-giga-title { font-size: 13px; font-weight: 900; color: var(--pc-text-primary); }
        .pc-giga-text { font-size: 12px; color: var(--pc-text-secondary); line-height: 1.5; margin-top: 4px; }
        .pc-giga-chiprow { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .pc-giga-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 999px; background: var(--pc-bg-elevated); border: 1px solid var(--pc-accent-border); color: var(--pc-accent); font-size: 11px; font-weight: 800; cursor: pointer; }
        .pc-giga-chip:hover { background: var(--pc-accent-bg); }
        .pc-mobile-role { display: none; }
        .pc-fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: var(--pc-bg-header); backdrop-filter: blur(18px); border-bottom: 1px solid var(--pc-border); box-shadow: var(--pc-shadow-sm); }
        .pc-main { padding: calc(var(--pc-header-offset) + 16px) 16px 16px; max-width: 1440px; margin: 0 auto; overflow-x: hidden; }
        .pc-nav-item { display: flex; align-items: center; gap: 12px; text-decoration: none; padding: 12px 13px; border-radius: 14px; border: 1px solid transparent; color: var(--pc-text-secondary); font-size: 13px; font-weight: 700; background: transparent; }
        .pc-nav-item:hover { background: rgba(255,255,255,0.03); border-color: var(--pc-border-light); color: var(--pc-text-primary); }
        .pc-nav-item[data-active='true'] { background: linear-gradient(180deg, rgba(126,242,196,0.12) 0%, rgba(126,242,196,0.06) 100%); border-color: var(--pc-accent-border); color: var(--pc-accent-strong); }
        .pc-status-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; border: 1px solid transparent; }
        .pc-shell-select { min-width: 160px; border: 1px solid var(--pc-border); border-radius: 14px; padding: 10px 12px; min-height: 46px; font-size: 13px; background: var(--pc-bg-card); color: var(--pc-text-primary); font-weight: 700; box-shadow: var(--pc-shadow-sm); }
        .pc-shell-iconbtn { position: relative; background: var(--pc-bg-card); border: 1px solid var(--pc-border); border-radius: 14px; padding: 10px; min-width: 46px; min-height: 46px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; line-height: 0; color: var(--pc-text-secondary); box-shadow: var(--pc-shadow-sm); }
        .pc-shell-iconbtn:hover { color: var(--pc-text-primary); border-color: var(--pc-border-light); }
        .pc-role-tile { display: grid; gap: 4px; padding: 12px; border-radius: 14px; border: 1px solid var(--pc-border); background: linear-gradient(180deg, rgba(21,28,25,0.96) 0%, rgba(11,21,19,0.98) 100%); }
        @media (max-width: 960px) {
          .pc-shell-root { --pc-header-offset: 172px; }
          .pc-header-actions { gap: 8px; flex-wrap: nowrap; justify-content: flex-end; }
          .pc-header-actions .v9-desktop-only { display: none !important; }
          .pc-shell-select { display: none !important; }
          .pc-mobile-role { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; max-width: 132px; padding: 8px 12px; border-radius: 14px; border: 1px solid var(--pc-border); background: var(--pc-bg-card); font-size: 13px; font-weight: 700; color: var(--pc-text-primary); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: var(--pc-shadow-sm); }
        }
        @media (max-width: 768px) {
          .pc-shell-root { --pc-header-offset: 188px; }
          .pc-shell-header { padding: calc(env(safe-area-inset-top) + 8px) 12px 12px; }
          .pc-header-top { align-items: flex-start; }
          .pc-header-brand { gap: 10px; }
          .pc-brand-title { font-size: 15px; }
          .pc-brand-subtitle, .pc-brand-crumbs { display: none; }
          .pc-alert-panel { position: fixed; left: 12px; right: 12px; top: calc(env(safe-area-inset-top) + 74px); width: auto; max-width: none; max-height: min(70vh, calc(100dvh - 96px)); }
          .pc-header-actions { gap: 6px; }
          .pc-header-search { padding: 11px 12px; min-height: 46px; }
          .pc-giga { grid-template-columns: 1fr; }
          .pc-main { padding: calc(var(--pc-header-offset) + 12px) 12px 16px; }
        }
        @media (max-width: 560px) {
          .pc-shell-root { --pc-header-offset: 196px; }
          .pc-role-banner { align-items: flex-start; }
          .pc-mobile-role { max-width: 118px; }
          .pc-main { padding-inline: 10px; }
        }
      `}</style>

      {sidebarOpen ? (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,7,0.62)', zIndex: 79 }}
          aria-hidden
        />
      ) : null}
      {alertsOpen ? (
        <div
          onClick={() => setAlertsOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 69 }}
          aria-hidden
        />
      ) : null}

      <aside
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: 304,
          maxWidth: '88vw',
          zIndex: 110,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
          background: 'linear-gradient(180deg, rgba(17,28,25,0.98) 0%, rgba(9,16,14,0.99) 100%)',
          borderRight: '1px solid var(--pc-border)',
          boxShadow: sidebarOpen ? 'var(--pc-shadow-lg)' : 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: 18, borderBottom: '1px solid var(--pc-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              <BrandMark size={42} rounded={16} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pc-text-primary)' }}>Прозрачная Цена</div>
                <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', marginTop: 4 }}>
                  Цифровой контур исполнения сделки
                </div>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label='Закрыть меню'
              className='pc-shell-iconbtn'
              style={{ minWidth: 42, minHeight: 42, padding: 8 }}
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          <div className='pc-role-tile' style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: 'rgba(126,242,196,0.10)',
                    border: '1px solid rgba(126,242,196,0.18)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--pc-accent)',
                    flexShrink: 0,
                  }}
                >
                  <RoleIcon size={18} strokeWidth={2.1} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--pc-text-muted)' }}>Текущий кабинет</div>
                  <div
                    suppressHydrationWarning
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: 'var(--pc-text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ROLE_LABELS[displayRole]}
                  </div>
                </div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: stageTone.bg,
                  border: `1px solid ${stageTone.border}`,
                  color: stageTone.color,
                  fontSize: 10,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {stage.label}
              </span>
            </div>
          </div>
        </div>

        <nav style={{ padding: 12, display: 'grid', gap: 6, overflowY: 'auto' }}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = SECTION_ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className='pc-nav-item'
                data-active={active}
              >
                <Icon size={16} strokeWidth={2.1} style={{ color: iconTone(active), flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1 }}>{item.label}</span>
                <ChevronRight size={15} strokeWidth={2.1} style={{ color: iconTone(active), flexShrink: 0 }} />
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--pc-border)', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Link
              href='/platform-v7/investor'
              onClick={() => setSidebarOpen(false)}
              className='pc-nav-item'
              style={{ justifyContent: 'center' }}
            >
              <BarChart3 size={16} strokeWidth={2.1} />
              <span>Инвестор</span>
            </Link>
            <Link
              href='/platform-v7/demo'
              onClick={() => setSidebarOpen(false)}
              className='pc-nav-item'
              style={{ justifyContent: 'center' }}
            >
              <LayoutDashboard size={16} strokeWidth={2.1} />
              <span>Демо</span>
            </Link>
          </div>
          <Link
            href='/platform-v7/roles'
            onClick={() => {
              clearRoleSelection();
              setSidebarOpen(false);
            }}
            className='pc-nav-item'
          >
            <User size={16} strokeWidth={2.1} />
            <span>Все роли</span>
          </Link>
        </div>
      </aside>

      <div>
        <header className='pc-fixed-header'>
          <div className='pc-shell-header'>
            <div className='pc-header-top'>
              <div className='pc-header-brand'>
                <button onClick={() => setSidebarOpen(true)} aria-label='Открыть меню' className='pc-shell-iconbtn'>
                  <Menu size={18} aria-hidden />
                </button>

                <BrandMark size={44} rounded={16} />

                <div className='pc-brand-copy'>
                  <div className='pc-brand-title'>Прозрачная Цена</div>
                  {showCrumbs ? (
                    <nav className='pc-brand-crumbs' aria-label='Хлебные крошки'>
                      {crumbs.map((crumb, index) => (
                        <React.Fragment key={crumb.href}>
                          {index > 0 ? (
                            <span style={{ color: 'var(--pc-text-muted)', fontSize: 12 }}>/</span>
                          ) : null}
                          {crumb.isLast ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pc-text-primary)' }}>
                              {crumb.label}
                            </span>
                          ) : (
                            <Link
                              href={crumb.href}
                              style={{ textDecoration: 'none', color: 'var(--pc-text-muted)', fontSize: 12, fontWeight: 600 }}
                            >
                              {crumb.label}
                            </Link>
                          )}
                        </React.Fragment>
                      ))}
                    </nav>
                  ) : (
                    <div className='pc-brand-subtitle'>Цена → сделка → логистика → документы → деньги → спор</div>
                  )}
                </div>
              </div>

              <div className='pc-header-actions'>
                {statuses.map((item) => {
                  const palette = statusPalette(item.tone);
                  const StatusIcon = item.icon;
                  return (
                    <span
                      key={item.label}
                      className='pc-status-chip v9-desktop-only'
                      style={{
                        background: palette.bg,
                        borderColor: palette.border,
                        color: palette.color,
                      }}
                    >
                      <StatusIcon size={14} strokeWidth={2.1} />
                      {item.label} · {item.detail}
                    </span>
                  );
                })}

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setAlertsOpen((value) => !value)}
                    aria-label={`Уведомления: ${NOTIFICATIONS.length}`}
                    aria-expanded={alertsOpen}
                    className='pc-shell-iconbtn'
                  >
                    <Bell size={18} aria-hidden />
                    <span
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -3,
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        background: '#E5484D',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                      }}
                    >
                      {NOTIFICATIONS.length}
                    </span>
                  </button>

                  {alertsOpen ? (
                    <div role='dialog' aria-label='Уведомления' className='pc-alert-panel'>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 6px 10px',
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--pc-text-primary)' }}>
                          Уведомления
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--pc-text-muted)', whiteSpace: 'nowrap' }}>
                          {NOTIFICATIONS.length} активных
                        </span>
                      </div>

                      {Object.entries(groupedNotifications).map(([group, notifications]) => (
                        <div key={group} style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                          <div
                            style={{
                              padding: '4px 6px',
                              fontSize: 10,
                              fontWeight: 800,
                              color: 'var(--pc-text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                            }}
                          >
                            {NOTIFICATION_GROUPS[group as NotificationGroup]} · {notifications.length}
                          </div>

                          {notifications.map((item) => (
                            <Link
                              key={item.id}
                              href={item.href}
                              onClick={() => setAlertsOpen(false)}
                              style={{
                                textDecoration: 'none',
                                padding: '11px 12px',
                                borderRadius: 12,
                                background: 'var(--pc-bg-subtle)',
                                border: '1px solid var(--pc-border)',
                                color: 'var(--pc-text-primary)',
                                fontSize: 12,
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                                boxShadow: 'var(--pc-shadow-sm)',
                              }}
                            >
                              {item.text}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
                  title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                  className='pc-shell-iconbtn'
                >
                  {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
                </button>

                <button
                  suppressHydrationWarning
                  className='pc-mobile-role'
                  type='button'
                  onClick={() => setSidebarOpen(true)}
                  aria-label={`Текущая роль: ${ROLE_LABELS[displayRole]}. Открыть меню роли`}
                >
                  {ROLE_LABELS[displayRole]}
                </button>

                <select
                  suppressHydrationWarning
                  value={displayRole}
                  onChange={(event) => {
                    const nextRole = event.target.value as PlatformRole;
                    setRole(nextRole);
                    trackRoleSwitch(nextRole);
                    router.push(ROLE_ROUTES[nextRole]);
                  }}
                  className='pc-shell-select'
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type='button'
              className='pc-header-search'
              onClick={() => setPaletteOpen(true)}
              aria-label='Открыть поиск по платформе'
            >
              <Search size={16} strokeWidth={2.1} style={{ color: 'var(--pc-text-muted)' }} />
              <div style={{ display: 'grid', gap: 2, textAlign: 'left', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>
                  Быстрый переход по платформе
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--pc-text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Сделка, лот, спор, интеграция, деньги, кабинет · ⌘K
                </span>
              </div>
            </button>
          </div>
        </header>

        <main className='pc-main'>
          {showBanner ? (
            <div className='pc-role-banner'>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: 'rgba(126,242,196,0.10)',
                  border: '1px solid rgba(126,242,196,0.18)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--pc-accent)',
                  flexShrink: 0,
                }}
              >
                <RoleIcon size={18} strokeWidth={2.1} />
              </span>

              <div style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--pc-text-primary)' }}>
                  {ROLE_LABELS[displayRole]}
                </div>
                <div style={{ fontSize: 12, color: 'var(--pc-text-secondary)', lineHeight: 1.5 }}>
                  Навигация, иконки, статусы и карточки выровнены в один канон. Платформа не обещает live там, где есть только sandbox или pilot.
                </div>
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '5px 9px',
                  borderRadius: 999,
                  background: stageTone.bg,
                  border: `1px solid ${stageTone.border}`,
                  color: stageTone.color,
                  fontSize: 10,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {stage.label}
              </span>
            </div>
          ) : null}

          <div className='pc-giga'>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: 'rgba(126,242,196,0.10)',
                    border: '1px solid rgba(126,242,196,0.18)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--pc-accent)',
                    flexShrink: 0,
                  }}
                >
                  <Search size={16} strokeWidth={2.1} />
                </div>
                <div>
                  <div className='pc-giga-title'>Вопросы к AI по текущему экрану</div>
                  <div className='pc-giga-text'>
                    Только по подтверждённым данным платформы: блокер, следующий владелец, документы, release, спор.
                  </div>
                </div>
              </div>

              <div className='pc-giga-chiprow'>
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type='button'
                    className='pc-giga-chip'
                    onClick={() => {
                      trackGigaChatAsked(chip);
                      router.push(`/assistant?q=${encodeURIComponent(chip)}`);
                    }}
                  >
                    <Search size={12} strokeWidth={2.2} />
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <button
              type='button'
              className='pc-nav-item'
              style={{ justifyContent: 'center', minHeight: 46, paddingInline: 14 }}
              onClick={() => {
                trackGigaChatAsked(pathname);
                router.push('/assistant');
              }}
            >
              <Search size={16} strokeWidth={2.1} />
              <span>Открыть AI</span>
            </button>
          </div>

          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
