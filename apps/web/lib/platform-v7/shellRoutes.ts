import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_AI_ROUTE,
  PLATFORM_V7_ARBITRATOR_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_BUYER_ROUTE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DRIVER_FIELD_ROUTE,
  PLATFORM_V7_ELEVATOR_ROUTE,
  PLATFORM_V7_EXECUTIVE_ROUTE,
  PLATFORM_V7_LAB_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_OPERATOR_QUEUES_ROUTE,
  PLATFORM_V7_PROFILE_ROUTE,
  PLATFORM_V7_ROLES_ROUTE,
  PLATFORM_V7_SELLER_ROUTE,
  PLATFORM_V7_STATUS_ROUTE,
  PLATFORM_V7_SURVEYOR_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export interface PlatformV7ShellNavItem { href: string; label: string; }
export interface PlatformV7RoleNavItem extends PlatformV7ShellNavItem { note?: string; }
export interface PlatformV7RoleNavigationEntry { home: string; bottom: PlatformV7RoleNavItem[]; drawer: PlatformV7RoleNavItem[]; command: PlatformV7RoleNavItem[]; allowedPrefixes: string[]; }

const child = (home: string, segment: string) => `${home.replace(/\/$/, '')}/${segment}`;

export const PLATFORM_V7_ROLE_ROUTES: Record<PlatformRole, string> = {
  operator: PLATFORM_V7_CONTROL_TOWER_ROUTE,
  buyer: PLATFORM_V7_BUYER_ROUTE,
  seller: PLATFORM_V7_SELLER_ROUTE,
  logistics: PLATFORM_V7_LOGISTICS_ROUTE,
  driver: PLATFORM_V7_DRIVER_FIELD_ROUTE,
  surveyor: PLATFORM_V7_SURVEYOR_ROUTE,
  elevator: PLATFORM_V7_ELEVATOR_ROUTE,
  lab: PLATFORM_V7_LAB_ROUTE,
  bank: PLATFORM_V7_BANK_ROUTE,
  arbitrator: PLATFORM_V7_ARBITRATOR_ROUTE,
  compliance: PLATFORM_V7_COMPLIANCE_ROUTE,
  executive: PLATFORM_V7_EXECUTIVE_ROUTE,
};

const SHARED_PREFIXES = [PLATFORM_V7_AI_ROUTE, PLATFORM_V7_PROFILE_ROUTE, PLATFORM_V7_STATUS_ROUTE];
const DENIED_PREFIXES = [PLATFORM_V7_ROLES_ROUTE, '/platform-v7r/roles', '/platform-v7/auth'];

const NAV_SEGMENTS: Record<PlatformRole, Array<[string, string]>> = {
  operator: [['', 'Контроль'], [PLATFORM_V7_DEALS_ROUTE, 'Сделки'], [child(PLATFORM_V7_CONTROL_TOWER_ROUTE, 'blockers'), 'Задержки'], [PLATFORM_V7_OPERATOR_QUEUES_ROUTE, 'Очереди'], [PLATFORM_V7_COMPLIANCE_ROUTE, 'Проверки']],
  buyer: [['', 'Кабинет'], ['deals', 'Сделки'], ['quality', 'Качество'], ['documents', 'Документы'], ['money', 'Расчёты']],
  seller: [['', 'Кабинет'], ['lots', 'Партии'], ['documents', 'Документы'], ['money', 'Расчёты'], ['blockers', 'Задержки']],
  logistics: [['', 'Диспетчер'], ['routes', 'Рейсы'], ['drivers', 'Водители'], ['documents', 'Документы'], ['blockers', 'Задержки']],
  driver: [['', 'Рейс'], ['route', 'Маршрут'], ['events', 'События'], ['proofs', 'Фотофиксация'], ['documents', 'Документы']],
  surveyor: [['', 'Осмотр'], ['inspections', 'Факты'], ['evidence', 'Доказательства'], ['documents', 'Акт'], ['blockers', 'Расхождения']],
  elevator: [['', 'Приёмка'], ['queue', 'Очередь'], ['acceptance', 'Вес'], ['documents', 'Акты'], ['blockers', 'Расхождения']],
  lab: [['', 'Пробы'], ['samples', 'Образцы'], ['results', 'Результаты'], ['documents', 'Протокол'], ['blockers', 'Расхождения']],
  bank: [['', 'Основание'], ['checks', 'Проверки'], ['basis', 'Основание'], ['money', 'Расчёты'], ['audit', 'Журнал']],
  arbitrator: [['', 'Споры'], ['disputes', 'Кейсы'], ['evidence', 'Доказательства'], ['decision', 'Решение'], ['audit', 'Журнал']],
  compliance: [['', 'Допуск'], ['risks', 'Риски'], ['leakage', 'Риск обхода'], ['documents', 'Документы'], ['audit', 'Журнал']],
  executive: [['', 'Сводка'], ['deals', 'Сделки'], ['money', 'Расчёты'], ['blockers', 'Задержки'], ['risk', 'Риски']],
};

function buildBottom(role: PlatformRole): PlatformV7RoleNavItem[] {
  const home = PLATFORM_V7_ROLE_ROUTES[role];
  return NAV_SEGMENTS[role].map(([segmentOrRoute, label]) => ({
    href: segmentOrRoute.startsWith('/platform-v7') ? segmentOrRoute : segmentOrRoute ? child(home, segmentOrRoute) : home,
    label,
  }));
}

export const PLATFORM_V7_ROLE_NAVIGATION: Record<PlatformRole, PlatformV7RoleNavigationEntry> = Object.fromEntries(
  (Object.keys(PLATFORM_V7_ROLE_ROUTES) as PlatformRole[]).map((role) => {
    const bottom = buildBottom(role);
    const home = PLATFORM_V7_ROLE_ROUTES[role];
    return [role, { home, bottom, drawer: [], command: bottom, allowedPrefixes: [home] }];
  }),
) as Record<PlatformRole, PlatformV7RoleNavigationEntry>;

export const PLATFORM_V7_NAV_BY_ROLE = Object.fromEntries(
  (Object.keys(PLATFORM_V7_ROLE_NAVIGATION) as PlatformRole[]).map((role) => [role, PLATFORM_V7_ROLE_NAVIGATION[role].bottom]),
) as Record<PlatformRole, PlatformV7ShellNavItem[]>;

function normalizeHref(href: string) { return href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/platform-v7'; }
function hrefMatchesPrefix(href: string, prefix: string) { const h = normalizeHref(href); const p = normalizeHref(prefix); return h === p || h.startsWith(`${p}/`); }

export function platformV7RoleRoute(role: PlatformRole): PlatformV7ShellRouteSurface { return PLATFORM_V7_ROLE_ROUTES[role] as PlatformV7ShellRouteSurface; }
export function platformV7NavByRole(role: PlatformRole): PlatformV7ShellNavItem[] { return PLATFORM_V7_ROLE_NAVIGATION[role].bottom; }
export function platformV7DrawerNavByRole(role: PlatformRole): PlatformV7RoleNavItem[] { return PLATFORM_V7_ROLE_NAVIGATION[role].drawer; }
export function platformV7CommandNavByRole(role: PlatformRole): PlatformV7RoleNavItem[] { return PLATFORM_V7_ROLE_NAVIGATION[role].command; }
export function platformV7RoleCanOpenHref(role: PlatformRole, href: string) { const path = normalizeHref(href); if (DENIED_PREFIXES.some((prefix) => hrefMatchesPrefix(path, prefix))) return false; if (SHARED_PREFIXES.some((prefix) => hrefMatchesPrefix(path, prefix))) return true; return hrefMatchesPrefix(path, PLATFORM_V7_ROLE_ROUTES[role]); }
export function platformV7ShellRouteSurface(): readonly PlatformV7ShellRouteSurface[] { const bottomRoutes = Object.values(PLATFORM_V7_ROLE_NAVIGATION).flatMap((entry) => entry.bottom.map((item) => normalizeHref(item.href))); return Array.from(new Set([...PLATFORM_V7_SHELL_ROUTE_SURFACE, ...bottomRoutes])) as PlatformV7ShellRouteSurface[]; }
