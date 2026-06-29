import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_AI_ROUTE,
  PLATFORM_V7_ARBITRATOR_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE,
  PLATFORM_V7_BUYER_ROUTE,
  PLATFORM_V7_BUYER_RFQ_ROUTE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_CONNECTORS_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_DOCUMENTS_ROUTE,
  PLATFORM_V7_DRIVER_FIELD_ROUTE,
  PLATFORM_V7_ELEVATOR_ROUTE,
  PLATFORM_V7_EXECUTIVE_ROUTE,
  PLATFORM_V7_LAB_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_MONEY_ROUTE,
  PLATFORM_V7_OPERATOR_QUEUES_ROUTE,
  PLATFORM_V7_OPERATOR_ROUTE,
  PLATFORM_V7_PROCUREMENT_ROUTE,
  PLATFORM_V7_PROFILE_ROUTE,
  PLATFORM_V7_PROPOSALS_ROUTE,
  PLATFORM_V7_REPORTS_ROUTE,
  PLATFORM_V7_ROLES_ROUTE,
  PLATFORM_V7_SELLER_BATCHES_ROUTE,
  PLATFORM_V7_SELLER_LOTS_ROUTE,
  PLATFORM_V7_SELLER_ROUTE,
  PLATFORM_V7_SIMULATOR_ROUTE,
  PLATFORM_V7_STATUS_ROUTE,
  PLATFORM_V7_SURVEYOR_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
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
// Navigation policy: entry.command = [...entry.bottom, ...entry.drawer]
const ROLE_BLOCKED_PREFIXES = [PLATFORM_V7_ROLES_ROUTE, '/platform-v7r/roles', '/platform-v7/auth'];

export const PLATFORM_V7_ROLE_NAVIGATION: Record<PlatformRole, PlatformV7RoleNavigationEntry> = {
  operator: {
    home: PLATFORM_V7_CONTROL_TOWER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
      { href: PLATFORM_V7_OPERATOR_ROUTE, label: 'Блокеры' },
      { href: PLATFORM_V7_OPERATOR_QUEUES_ROUTE, label: 'Очереди' },
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Контроль' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
      { href: PLATFORM_V7_OPERATOR_ROUTE, label: 'Блокеры' },
      { href: PLATFORM_V7_OPERATOR_QUEUES_ROUTE, label: 'Очереди' },
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Контроль' },
      { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Банк' },
      { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'Банк события' },
      { href: PLATFORM_V7_TRUST_ROUTE, label: 'Доверие' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    ],
    allowedPrefixes: [PLATFORM_V7_CONTROL_TOWER_ROUTE, PLATFORM_V7_OPERATOR_ROUTE, PLATFORM_V7_DEALS_ROUTE, PLATFORM_V7_OPERATOR_QUEUES_ROUTE, PLATFORM_V7_COMPLIANCE_ROUTE, PLATFORM_V7_BANK_CLEAN_ROUTE, PLATFORM_V7_BANK_EVENTS_ROUTE, PLATFORM_V7_TRUST_ROUTE, PLATFORM_V7_REPORTS_ROUTE],
  },
  buyer: {
    home: PLATFORM_V7_BUYER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_BUYER_ROUTE, label: 'Кабинет' },
      { href: PLATFORM_V7_BUYER_RFQ_ROUTE, label: 'Запросы' },
      { href: PLATFORM_V7_PROPOSALS_ROUTE, label: 'Офферы' },
      { href: PLATFORM_V7_DOCUMENTS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_MONEY_ROUTE, label: 'Деньги' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_BUYER_ROUTE, label: 'Кабинет' },
      { href: PLATFORM_V7_BUYER_RFQ_ROUTE, label: 'Запросы' },
      { href: PLATFORM_V7_PROPOSALS_ROUTE, label: 'Офферы' },
      { href: PLATFORM_V7_DOCUMENTS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_MONEY_ROUTE, label: 'Деньги' },
    ],
    allowedPrefixes: [PLATFORM_V7_BUYER_ROUTE, PLATFORM_V7_PROCUREMENT_ROUTE, PLATFORM_V7_PROPOSALS_ROUTE, PLATFORM_V7_DOCUMENTS_ROUTE, PLATFORM_V7_MONEY_ROUTE],
  },
  seller: {
    home: PLATFORM_V7_SELLER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_SELLER_ROUTE, label: 'Кабинет' },
      { href: PLATFORM_V7_SELLER_LOTS_ROUTE, label: 'Партии' },
      { href: PLATFORM_V7_SELLER_BATCHES_ROUTE, label: 'Отгрузки' },
      { href: PLATFORM_V7_DOCUMENTS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_MONEY_ROUTE, label: 'Деньги' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_SELLER_ROUTE, label: 'Кабинет' },
      { href: PLATFORM_V7_SELLER_LOTS_ROUTE, label: 'Партии' },
      { href: PLATFORM_V7_SELLER_BATCHES_ROUTE, label: 'Отгрузки' },
      { href: PLATFORM_V7_DOCUMENTS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_MONEY_ROUTE, label: 'Деньги' },
    ],
    allowedPrefixes: [PLATFORM_V7_SELLER_ROUTE, PLATFORM_V7_DOCUMENTS_ROUTE, PLATFORM_V7_MONEY_ROUTE],
  },
  logistics: {
    home: PLATFORM_V7_LOGISTICS_ROUTE,
    bottom: [
      { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Диспетчер' },
      { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Закупки' },
      { href: PLATFORM_V7_DOCUMENTS_ROUTE, label: 'Документы' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Диспетчер' },
      { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Закупки' },
      { href: PLATFORM_V7_DOCUMENTS_ROUTE, label: 'Документы' },
    ],
    allowedPrefixes: [PLATFORM_V7_LOGISTICS_ROUTE, PLATFORM_V7_PROCUREMENT_ROUTE, PLATFORM_V7_DOCUMENTS_ROUTE],
  },
  driver: {
    home: PLATFORM_V7_DRIVER_FIELD_ROUTE,
    bottom: [
      { href: PLATFORM_V7_DRIVER_FIELD_ROUTE, label: 'Мой маршрут' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_DRIVER_FIELD_ROUTE, label: 'Мой маршрут' },
    ],
    allowedPrefixes: [PLATFORM_V7_DRIVER_FIELD_ROUTE],
  },
  surveyor: {
    home: PLATFORM_V7_SURVEYOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_SURVEYOR_ROUTE, label: 'Осмотр' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_SURVEYOR_ROUTE, label: 'Осмотр' },
    ],
    allowedPrefixes: [PLATFORM_V7_SURVEYOR_ROUTE],
  },
  elevator: {
    home: PLATFORM_V7_ELEVATOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_ELEVATOR_ROUTE, label: 'Приёмка' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_ELEVATOR_ROUTE, label: 'Приёмка' },
    ],
    allowedPrefixes: [PLATFORM_V7_ELEVATOR_ROUTE],
  },
  lab: {
    home: PLATFORM_V7_LAB_ROUTE,
    bottom: [
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Пробы' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Пробы' },
    ],
    allowedPrefixes: [PLATFORM_V7_LAB_ROUTE],
  },
  bank: {
    home: PLATFORM_V7_BANK_ROUTE,
    bottom: [
      { href: PLATFORM_V7_BANK_ROUTE, label: 'Основание' },
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Основания выплат' },
      { href: PLATFORM_V7_BANK_FACTORING_ROUTE, label: 'Факторинг' },
      { href: PLATFORM_V7_BANK_ESCROW_ROUTE, label: 'Эскроу' },
      { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_BANK_ROUTE, label: 'Основание' },
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Основания выплат' },
      { href: PLATFORM_V7_BANK_FACTORING_ROUTE, label: 'Факторинг' },
      { href: PLATFORM_V7_BANK_ESCROW_ROUTE, label: 'Эскроу' },
      { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События' },
      { href: PLATFORM_V7_TRUST_ROUTE, label: 'Доверие' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    ],
    allowedPrefixes: [PLATFORM_V7_BANK_ROUTE, PLATFORM_V7_TRUST_ROUTE, PLATFORM_V7_REPORTS_ROUTE],
  },
  arbitrator: {
    home: PLATFORM_V7_ARBITRATOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_ARBITRATOR_ROUTE, label: 'Арбитраж' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_ARBITRATOR_ROUTE, label: 'Арбитраж' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    ],
    allowedPrefixes: [PLATFORM_V7_ARBITRATOR_ROUTE, PLATFORM_V7_DISPUTES_ROUTE],
  },
  compliance: {
    home: PLATFORM_V7_COMPLIANCE_ROUTE,
    bottom: [
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Допуск' },
      { href: PLATFORM_V7_CONNECTORS_ROUTE, label: 'Разъёмы' },
      { href: PLATFORM_V7_TRUST_ROUTE, label: 'Доверие' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Допуск' },
      { href: PLATFORM_V7_CONNECTORS_ROUTE, label: 'Разъёмы' },
      { href: PLATFORM_V7_TRUST_ROUTE, label: 'Доверие' },
    ],
    allowedPrefixes: [PLATFORM_V7_COMPLIANCE_ROUTE, PLATFORM_V7_CONNECTORS_ROUTE, PLATFORM_V7_TRUST_ROUTE],
  },
  executive: {
    home: PLATFORM_V7_EXECUTIVE_ROUTE,
    bottom: [
      { href: PLATFORM_V7_EXECUTIVE_ROUTE, label: 'Сводка' },
      { href: PLATFORM_V7_MONEY_ROUTE, label: 'Деньги' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
      { href: PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE, label: 'Демо-поток' },
      { href: PLATFORM_V7_SIMULATOR_ROUTE, label: 'Симулятор' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_EXECUTIVE_ROUTE, label: 'Сводка' },
      { href: PLATFORM_V7_MONEY_ROUTE, label: 'Деньги' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
      { href: PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE, label: 'Демо-поток' },
      { href: PLATFORM_V7_SIMULATOR_ROUTE, label: 'Симулятор' },
      { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Банк' },
    ],
    allowedPrefixes: [PLATFORM_V7_EXECUTIVE_ROUTE, PLATFORM_V7_MONEY_ROUTE, PLATFORM_V7_REPORTS_ROUTE, PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE, PLATFORM_V7_SIMULATOR_ROUTE, PLATFORM_V7_BANK_CLEAN_ROUTE],
  },
};

export const PLATFORM_V7_NAV_BY_ROLE = Object.fromEntries(
  (Object.keys(PLATFORM_V7_ROLE_NAVIGATION) as PlatformRole[]).map((role) => [role, PLATFORM_V7_ROLE_NAVIGATION[role].command]),
) as Record<PlatformRole, PlatformV7ShellNavItem[]>;

function normalizeHref(href: string) { return href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/platform-v7'; }
function hrefMatchesPrefix(href: string, prefix: string) { const h = normalizeHref(href); const p = normalizeHref(prefix); return h === p || h.startsWith(`${p}/`); }

export function platformV7RoleRoute(role: PlatformRole): PlatformV7ShellRouteSurface { return PLATFORM_V7_ROLE_ROUTES[role] as PlatformV7ShellRouteSurface; }
export function platformV7NavByRole(role: PlatformRole): PlatformV7ShellNavItem[] { return PLATFORM_V7_ROLE_NAVIGATION[role].command; }
export function platformV7DrawerNavByRole(role: PlatformRole): PlatformV7RoleNavItem[] { return PLATFORM_V7_ROLE_NAVIGATION[role].drawer; }
export function platformV7CommandNavByRole(role: PlatformRole): PlatformV7RoleNavItem[] { return PLATFORM_V7_ROLE_NAVIGATION[role].command; }
export function platformV7RoleCanOpenHref(role: PlatformRole, href: string) { const path = normalizeHref(href); if (ROLE_BLOCKED_PREFIXES.some((prefix) => hrefMatchesPrefix(path, prefix))) return false; if (SHARED_PREFIXES.some((prefix) => hrefMatchesPrefix(path, prefix))) return true; return PLATFORM_V7_ROLE_NAVIGATION[role].allowedPrefixes.some((prefix) => hrefMatchesPrefix(path, prefix)); }
export function platformV7ShellRouteSurface(): readonly PlatformV7ShellRouteSurface[] { return PLATFORM_V7_SHELL_ROUTE_SURFACE; }
