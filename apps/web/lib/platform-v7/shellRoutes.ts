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
  PLATFORM_V7_STATUS_ROUTE,
  PLATFORM_V7_SURVEYOR_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export interface PlatformV7ShellNavItem { href: string; label: string; }
export interface PlatformV7RoleNavItem extends PlatformV7ShellNavItem { note?: string; }
export interface PlatformV7RoleNavigationEntry { home: string; bottom: PlatformV7RoleNavItem[]; drawer: PlatformV7RoleNavItem[]; command: PlatformV7RoleNavItem[]; allowedPrefixes: string[]; }

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

const AUCTION_ROUTE = '/platform-v7/auction';
const AUCTION_ADMISSION_ROUTE = '/platform-v7/auction/admission';
const DEAL_LOGISTICS_ROUTE = '/platform-v7/deal-logistics';
const LOGISTICS_DRIVERS_ROUTE = '/platform-v7/logistics/drivers';
const DEAL_ACCEPTANCE_ROUTE = '/platform-v7/deal-acceptance';
const DEAL_DOCUMENTS_BASIS_ROUTE = '/platform-v7/deal-documents-basis';
const FGIS_ACCESS_ROUTE = '/platform-v7/fgis-access';
const SHARED_PREFIXES = [PLATFORM_V7_AI_ROUTE, PLATFORM_V7_PROFILE_ROUTE, PLATFORM_V7_STATUS_ROUTE];
// The deal execution workspace is open to EVERY business role at the shell
// level: real authorization is the server-side fail-closed DealParticipant
// membership check, and the client guard must not reject an active
// participant (driver, lab, surveyor, …) before the server can answer.
const SHARED_ROUTE_PATTERNS = [/^\/platform-v7\/deals\/[^/]+\/execution$/];
const ROLE_BLOCKED_PREFIXES = [PLATFORM_V7_ROLES_ROUTE, '/platform-v7r/roles', '/platform-v7/auth'];

export const PLATFORM_V7_ROLE_NAVIGATION: Record<PlatformRole, PlatformV7RoleNavigationEntry> = {
  operator: {
    home: PLATFORM_V7_CONTROL_TOWER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Главная' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
      { href: FGIS_ACCESS_ROUTE, label: 'ФГИС' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр' },
      { href: FGIS_ACCESS_ROUTE, label: 'Доступ ФГИС' },
      { href: AUCTION_ROUTE, label: 'Аукцион' },
      { href: DEAL_LOGISTICS_ROUTE, label: 'Рейс сделки' },
      { href: DEAL_ACCEPTANCE_ROUTE, label: 'Приёмка сделки' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документное основание' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
      { href: PLATFORM_V7_OPERATOR_ROUTE, label: 'Остановки' },
      { href: PLATFORM_V7_OPERATOR_QUEUES_ROUTE, label: 'Очереди' },
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Контроль' },
      { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Расчёты' },
      { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События' },
      { href: PLATFORM_V7_TRUST_ROUTE, label: 'Доверие' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    ],
    allowedPrefixes: [PLATFORM_V7_CONTROL_TOWER_ROUTE, FGIS_ACCESS_ROUTE, AUCTION_ROUTE, DEAL_LOGISTICS_ROUTE, DEAL_ACCEPTANCE_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, PLATFORM_V7_OPERATOR_ROUTE, PLATFORM_V7_DEALS_ROUTE, PLATFORM_V7_OPERATOR_QUEUES_ROUTE, PLATFORM_V7_COMPLIANCE_ROUTE, PLATFORM_V7_BANK_CLEAN_ROUTE, PLATFORM_V7_BANK_EVENTS_ROUTE, PLATFORM_V7_TRUST_ROUTE, PLATFORM_V7_REPORTS_ROUTE],
  },
  buyer: {
    home: PLATFORM_V7_BUYER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_BUYER_ROUTE, label: 'Главная' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Деньги' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_BUYER_ROUTE, label: 'Кабинет' },
      { href: AUCTION_ROUTE, label: 'Аукцион' },
      { href: PLATFORM_V7_BUYER_RFQ_ROUTE, label: 'Запросы' },
      { href: PLATFORM_V7_PROPOSALS_ROUTE, label: 'Офферы' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Деньги' },
    ],
    allowedPrefixes: [PLATFORM_V7_BUYER_ROUTE, AUCTION_ROUTE, PLATFORM_V7_PROCUREMENT_ROUTE, PLATFORM_V7_PROPOSALS_ROUTE, PLATFORM_V7_DOCUMENTS_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, PLATFORM_V7_MONEY_ROUTE, PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, PLATFORM_V7_DEALS_ROUTE, DEAL_ACCEPTANCE_ROUTE, PLATFORM_V7_DISPUTES_ROUTE],
  },
  seller: {
    home: PLATFORM_V7_SELLER_ROUTE,
    bottom: [
      { href: PLATFORM_V7_SELLER_ROUTE, label: 'Главная' },
      { href: FGIS_ACCESS_ROUTE, label: 'Партии' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Деньги' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_SELLER_ROUTE, label: 'Кабинет' },
      { href: FGIS_ACCESS_ROUTE, label: 'Доступ ФГИС' },
      { href: AUCTION_ROUTE, label: 'Аукцион' },
      { href: PLATFORM_V7_SELLER_LOTS_ROUTE, label: 'Партии' },
      { href: PLATFORM_V7_SELLER_BATCHES_ROUTE, label: 'Отгрузки' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Деньги' },
    ],
    allowedPrefixes: [PLATFORM_V7_SELLER_ROUTE, FGIS_ACCESS_ROUTE, AUCTION_ROUTE, PLATFORM_V7_SELLER_LOTS_ROUTE, PLATFORM_V7_SELLER_BATCHES_ROUTE, PLATFORM_V7_DOCUMENTS_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, PLATFORM_V7_MONEY_ROUTE, PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, PLATFORM_V7_DEALS_ROUTE, DEAL_LOGISTICS_ROUTE],
  },
  logistics: {
    home: PLATFORM_V7_LOGISTICS_ROUTE,
    bottom: [
      { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Главная' },
      { href: DEAL_LOGISTICS_ROUTE, label: 'Рейсы' },
      { href: LOGISTICS_DRIVERS_ROUTE, label: 'Водители' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Диспетчерская' },
      { href: DEAL_LOGISTICS_ROUTE, label: 'Рейс сделки' },
      { href: LOGISTICS_DRIVERS_ROUTE, label: 'Водители' },
      { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Заявки' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
    ],
    allowedPrefixes: [PLATFORM_V7_LOGISTICS_ROUTE, DEAL_LOGISTICS_ROUTE, PLATFORM_V7_PROCUREMENT_ROUTE, PLATFORM_V7_DOCUMENTS_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, DEAL_ACCEPTANCE_ROUTE, PLATFORM_V7_DISPUTES_ROUTE],
  },
  driver: {
    home: PLATFORM_V7_DRIVER_FIELD_ROUTE,
    bottom: [
      { href: PLATFORM_V7_DRIVER_FIELD_ROUTE, label: 'Рейс' },
      { href: PLATFORM_V7_DRIVER_FIELD_ROUTE, label: 'Фото' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Проблема' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_DRIVER_FIELD_ROUTE, label: 'Маршрут' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы рейса' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Проблема' },
    ],
    allowedPrefixes: [PLATFORM_V7_DRIVER_FIELD_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, PLATFORM_V7_DISPUTES_ROUTE],
  },
  surveyor: {
    home: PLATFORM_V7_SURVEYOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_SURVEYOR_ROUTE, label: 'Осмотр' },
      { href: DEAL_ACCEPTANCE_ROUTE, label: 'Вес' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Спор' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_SURVEYOR_ROUTE, label: 'Осмотр' },
      { href: DEAL_ACCEPTANCE_ROUTE, label: 'Факты приёмки' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Спор' },
    ],
    allowedPrefixes: [PLATFORM_V7_SURVEYOR_ROUTE, DEAL_ACCEPTANCE_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, PLATFORM_V7_DISPUTES_ROUTE],
  },
  elevator: {
    home: PLATFORM_V7_ELEVATOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_ELEVATOR_ROUTE, label: 'Приёмка' },
      { href: DEAL_ACCEPTANCE_ROUTE, label: 'Вес' },
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Качество' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_ELEVATOR_ROUTE, label: 'Приёмка' },
      { href: DEAL_ACCEPTANCE_ROUTE, label: 'Приёмка сделки' },
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Качество' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
    ],
    allowedPrefixes: [PLATFORM_V7_ELEVATOR_ROUTE, DEAL_ACCEPTANCE_ROUTE, PLATFORM_V7_LAB_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE],
  },
  lab: {
    home: PLATFORM_V7_LAB_ROUTE,
    bottom: [
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Пробы' },
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Качество' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Спор' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Пробы' },
      { href: DEAL_ACCEPTANCE_ROUTE, label: 'Качество сделки' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Спор' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
    ],
    allowedPrefixes: [PLATFORM_V7_LAB_ROUTE, DEAL_ACCEPTANCE_ROUTE, PLATFORM_V7_DISPUTES_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE],
  },
  bank: {
    home: PLATFORM_V7_BANK_ROUTE,
    bottom: [
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Основание' },
      { href: PLATFORM_V7_BANK_ROUTE, label: 'Деньги' },
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Риски' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_BANK_ROUTE, label: 'Деньги по сделкам' },
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Платёжное основание' },
      { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События банка' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Риски' },
      { href: PLATFORM_V7_TRUST_ROUTE, label: 'Доверие' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    ],
    allowedPrefixes: [PLATFORM_V7_BANK_ROUTE, PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, PLATFORM_V7_BANK_EVENTS_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, PLATFORM_V7_COMPLIANCE_ROUTE, PLATFORM_V7_TRUST_ROUTE, PLATFORM_V7_REPORTS_ROUTE],
  },
  arbitrator: {
    home: PLATFORM_V7_ARBITRATOR_ROUTE,
    bottom: [
      { href: PLATFORM_V7_ARBITRATOR_ROUTE, label: 'Споры' },
      { href: DEAL_ACCEPTANCE_ROUTE, label: 'Вес' },
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Качество' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_ARBITRATOR_ROUTE, label: 'Арбитраж' },
      { href: DEAL_ACCEPTANCE_ROUTE, label: 'Факты приёмки' },
      { href: PLATFORM_V7_LAB_ROUTE, label: 'Качество' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
    ],
    allowedPrefixes: [PLATFORM_V7_ARBITRATOR_ROUTE, DEAL_ACCEPTANCE_ROUTE, PLATFORM_V7_LAB_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, PLATFORM_V7_DISPUTES_ROUTE],
  },
  compliance: {
    home: PLATFORM_V7_COMPLIANCE_ROUTE,
    bottom: [
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Допуск' },
      { href: FGIS_ACCESS_ROUTE, label: 'ФГИС' },
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Риски' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Допуск' },
      { href: FGIS_ACCESS_ROUTE, label: 'Доступ ФГИС' },
      { href: AUCTION_ADMISSION_ROUTE, label: 'Допуск торгов' },
      { href: DEAL_DOCUMENTS_BASIS_ROUTE, label: 'Документы' },
      { href: PLATFORM_V7_CONNECTORS_ROUTE, label: 'Подключения' },
      { href: PLATFORM_V7_TRUST_ROUTE, label: 'Доверие' },
    ],
    allowedPrefixes: [PLATFORM_V7_COMPLIANCE_ROUTE, FGIS_ACCESS_ROUTE, AUCTION_ROUTE, DEAL_DOCUMENTS_BASIS_ROUTE, PLATFORM_V7_CONNECTORS_ROUTE, PLATFORM_V7_TRUST_ROUTE],
  },
  executive: {
    home: PLATFORM_V7_EXECUTIVE_ROUTE,
    bottom: [
      { href: PLATFORM_V7_EXECUTIVE_ROUTE, label: 'Главная' },
      { href: PLATFORM_V7_BANK_ROUTE, label: 'Деньги' },
      { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Блокировки' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
      { href: PLATFORM_V7_STATUS_ROUTE, label: 'Ещё' },
    ],
    drawer: [],
    command: [
      { href: PLATFORM_V7_EXECUTIVE_ROUTE, label: 'Сводка' },
      { href: PLATFORM_V7_BANK_ROUTE, label: 'Деньги' },
      { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
      { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Блокировки' },
      { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
      { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    ],
    allowedPrefixes: [PLATFORM_V7_EXECUTIVE_ROUTE, PLATFORM_V7_BANK_ROUTE, PLATFORM_V7_MONEY_ROUTE, PLATFORM_V7_DEALS_ROUTE, PLATFORM_V7_CONTROL_TOWER_ROUTE, PLATFORM_V7_DISPUTES_ROUTE, PLATFORM_V7_REPORTS_ROUTE],
  },
};

export const PLATFORM_V7_NAV_BY_ROLE = Object.fromEntries(
  (Object.keys(PLATFORM_V7_ROLE_NAVIGATION) as PlatformRole[]).map((role) => [role, PLATFORM_V7_ROLE_NAVIGATION[role].bottom]),
) as Record<PlatformRole, PlatformV7ShellNavItem[]>;

function normalizeHref(href: string) { return href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/platform-v7'; }
function hrefMatchesPrefix(href: string, prefix: string) { const h = normalizeHref(href); const p = normalizeHref(prefix); return h === p || h.startsWith(`${p}/`); }
function sameNavTarget(left: PlatformV7RoleNavItem, right: PlatformV7RoleNavItem) { return normalizeHref(left.href) === normalizeHref(right.href); }

export function platformV7RoleRoute(role: PlatformRole): PlatformV7ShellRouteSurface { return PLATFORM_V7_ROLE_ROUTES[role] as PlatformV7ShellRouteSurface; }
export function platformV7NavByRole(role: PlatformRole): PlatformV7ShellNavItem[] { return PLATFORM_V7_ROLE_NAVIGATION[role].bottom; }
export function platformV7DrawerNavByRole(role: PlatformRole): PlatformV7RoleNavItem[] { const entry = PLATFORM_V7_ROLE_NAVIGATION[role]; const configuredDrawer = entry.drawer.length ? entry.drawer : entry.command.filter((item) => !entry.bottom.some((bottomItem) => sameNavTarget(bottomItem, item))); return configuredDrawer; }
export function platformV7CommandNavByRole(role: PlatformRole): PlatformV7RoleNavItem[] { return PLATFORM_V7_ROLE_NAVIGATION[role].command; }
export function platformV7RoleCanOpenHref(role: PlatformRole, href: string) { const path = normalizeHref(href); if (ROLE_BLOCKED_PREFIXES.some((prefix) => hrefMatchesPrefix(path, prefix))) return false; if (SHARED_PREFIXES.some((prefix) => hrefMatchesPrefix(path, prefix))) return true; if (SHARED_ROUTE_PATTERNS.some((pattern) => pattern.test(path))) return true; return PLATFORM_V7_ROLE_NAVIGATION[role].allowedPrefixes.some((prefix) => hrefMatchesPrefix(path, prefix)); }
export function platformV7ShellRouteSurface(): readonly PlatformV7ShellRouteSurface[] { return PLATFORM_V7_SHELL_ROUTE_SURFACE; }
