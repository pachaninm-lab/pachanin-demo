import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_AI_ROUTE,
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_BUYER_ROUTE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_DRIVER_FIELD_ROUTE,
  PLATFORM_V7_ELEVATOR_ROUTE,
  PLATFORM_V7_EXECUTIVE_ROUTE,
  PLATFORM_V7_LAB_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_PROCUREMENT_ROUTE,
  PLATFORM_V7_REPORTS_ROUTE,
  PLATFORM_V7_SELLER_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
  PLATFORM_V7_ARBITRATOR_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export interface PlatformV7ShellNavItem {
  href: PlatformV7ShellRouteSurface | `${typeof PLATFORM_V7_DEALS_ROUTE}/${string}`;
  label: string;
}

const PLATFORM_V7_DRIVER_FIELD_CANONICAL_ROUTE = PLATFORM_V7_DRIVER_FIELD_ROUTE as PlatformV7ShellRouteSurface;
const PLATFORM_V7_SURVEYOR_CANONICAL_ROUTE = '/platform-v7/surveyor' as PlatformV7ShellRouteSurface;
const PLATFORM_V7_ELEVATOR_CANONICAL_ROUTE = PLATFORM_V7_ELEVATOR_ROUTE as PlatformV7ShellRouteSurface;
const PLATFORM_V7_LAB_CANONICAL_ROUTE = PLATFORM_V7_LAB_ROUTE as PlatformV7ShellRouteSurface;
const PLATFORM_V7_ARBITRATOR_CANONICAL_ROUTE = PLATFORM_V7_ARBITRATOR_ROUTE as PlatformV7ShellRouteSurface;
const PLATFORM_V7_EXECUTIVE_CANONICAL_ROUTE = PLATFORM_V7_EXECUTIVE_ROUTE as PlatformV7ShellRouteSurface;
const PLATFORM_V7_AI_CANONICAL_ROUTE = PLATFORM_V7_AI_ROUTE as PlatformV7ShellRouteSurface;

export const PLATFORM_V7_ROLE_ROUTES: Record<PlatformRole, PlatformV7ShellRouteSurface> = {
  operator: PLATFORM_V7_CONTROL_TOWER_ROUTE,
  buyer: PLATFORM_V7_BUYER_ROUTE,
  seller: PLATFORM_V7_SELLER_ROUTE,
  logistics: PLATFORM_V7_LOGISTICS_ROUTE,
  driver: PLATFORM_V7_DRIVER_FIELD_CANONICAL_ROUTE,
  surveyor: PLATFORM_V7_SURVEYOR_CANONICAL_ROUTE,
  elevator: PLATFORM_V7_ELEVATOR_CANONICAL_ROUTE,
  lab: PLATFORM_V7_LAB_CANONICAL_ROUTE,
  bank: PLATFORM_V7_BANK_CLEAN_ROUTE,
  arbitrator: PLATFORM_V7_ARBITRATOR_CANONICAL_ROUTE,
  compliance: PLATFORM_V7_COMPLIANCE_ROUTE,
  executive: PLATFORM_V7_EXECUTIVE_CANONICAL_ROUTE,
};

const AI_ITEM: PlatformV7ShellNavItem = { href: PLATFORM_V7_AI_CANONICAL_ROUTE, label: 'AI-помощник' };

export const PLATFORM_V7_NAV_BY_ROLE: Record<PlatformRole, PlatformV7ShellNavItem[]> = {
  operator: [
    { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр управления' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Закупки' },
    { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Логистика' },
    { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Банковское основание' },
    { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События банка' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_TRUST_ROUTE, label: 'Центр доверия' },
    { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Комплаенс' },
    { href: PLATFORM_V7_EXECUTIVE_CANONICAL_ROUTE, label: 'Сводка' },
    AI_ITEM,
  ],
  buyer: [
    { href: PLATFORM_V7_BUYER_ROUTE, label: 'Кабинет покупателя' },
    { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Мои закупки' },
    AI_ITEM,
  ],
  seller: [
    { href: PLATFORM_V7_SELLER_ROUTE, label: 'Кабинет продавца' },
    AI_ITEM,
  ],
  logistics: [
    { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Диспетчерская' },
    AI_ITEM,
  ],
  driver: [
    { href: PLATFORM_V7_DRIVER_FIELD_CANONICAL_ROUTE, label: 'Мой маршрут' },
    AI_ITEM,
  ],
  surveyor: [
    { href: PLATFORM_V7_SURVEYOR_CANONICAL_ROUTE, label: 'Мои назначения' },
    AI_ITEM,
  ],
  elevator: [
    { href: PLATFORM_V7_ELEVATOR_CANONICAL_ROUTE, label: 'Приёмка' },
    AI_ITEM,
  ],
  lab: [
    { href: PLATFORM_V7_LAB_CANONICAL_ROUTE, label: 'Пробы и протоколы' },
    AI_ITEM,
  ],
  bank: [
    { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Банковское основание' },
    { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События банка' },
    AI_ITEM,
  ],
  arbitrator: [
    { href: PLATFORM_V7_ARBITRATOR_CANONICAL_ROUTE, label: 'Комнаты разбора' },
    AI_ITEM,
  ],
  compliance: [
    { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Комплаенс' },
    AI_ITEM,
  ],
  executive: [
    { href: PLATFORM_V7_EXECUTIVE_CANONICAL_ROUTE, label: 'Сводка' },
    { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр управления' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Логистика' },
    { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Банковское основание' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_TRUST_ROUTE, label: 'Центр доверия' },
    { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    AI_ITEM,
  ],
};

export function platformV7RoleRoute(role: PlatformRole): PlatformV7ShellRouteSurface {
  return PLATFORM_V7_ROLE_ROUTES[role];
}

export function platformV7NavByRole(role: PlatformRole): PlatformV7ShellNavItem[] {
  return PLATFORM_V7_NAV_BY_ROLE[role];
}

export function platformV7ShellRouteSurface(): readonly PlatformV7ShellRouteSurface[] {
  return PLATFORM_V7_SHELL_ROUTE_SURFACE;
}
