import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_BUYER_ROUTE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_FIELD_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_PROCUREMENT_ROUTE,
  PLATFORM_V7_REPORTS_ROUTE,
  PLATFORM_V7_SELLER_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  PLATFORM_V7_SIMULATOR_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
  PLATFORM_V7R_ANALYTICS_ROUTE,
  PLATFORM_V7R_ARBITRATOR_ROUTE,
  PLATFORM_V7R_DRIVER_ROUTE,
  PLATFORM_V7R_ELEVATOR_ROUTE,
  PLATFORM_V7R_LAB_ROUTE,
  PLATFORM_V7R_SURVEYOR_ROUTE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export interface PlatformV7ShellNavItem {
  href: PlatformV7ShellRouteSurface | `${typeof PLATFORM_V7_DEALS_ROUTE}/${string}`;
  label: string;
}

export const PLATFORM_V7_ROLE_ROUTES: Record<PlatformRole, PlatformV7ShellRouteSurface> = {
  operator: PLATFORM_V7_CONTROL_TOWER_ROUTE,
  buyer: PLATFORM_V7_BUYER_ROUTE,
  seller: PLATFORM_V7_SELLER_ROUTE,
  logistics: PLATFORM_V7_LOGISTICS_ROUTE,
  driver: PLATFORM_V7R_DRIVER_ROUTE,
  surveyor: PLATFORM_V7R_SURVEYOR_ROUTE,
  elevator: PLATFORM_V7R_ELEVATOR_ROUTE,
  lab: PLATFORM_V7R_LAB_ROUTE,
  bank: PLATFORM_V7_BANK_CLEAN_ROUTE,
  arbitrator: PLATFORM_V7R_ARBITRATOR_ROUTE,
  compliance: PLATFORM_V7_COMPLIANCE_ROUTE,
  executive: PLATFORM_V7R_ANALYTICS_ROUTE,
};

export const PLATFORM_V7_NAV_BY_ROLE: Record<PlatformRole, PlatformV7ShellNavItem[]> = {
  operator: [
    { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр управления' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Закупки' },
    { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Логистика' },
    { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Деньги' },
    { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События банка' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_TRUST_ROUTE, label: 'Центр доверия' },
    { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Комплаенс' },
    { href: PLATFORM_V7R_ANALYTICS_ROUTE, label: 'Сводка' },
  ],
  buyer: [
    { href: PLATFORM_V7_BUYER_ROUTE, label: 'Кабинет покупателя' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Закупки' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_BANK_ROUTE, label: 'Банковый контур' },
  ],
  seller: [
    { href: PLATFORM_V7_SELLER_ROUTE, label: 'Кабинет продавца' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Документный след' },
  ],
  logistics: [
    { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Диспетчерская' },
    { href: PLATFORM_V7_FIELD_ROUTE, label: 'Поле и приёмка' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Инциденты' },
  ],
  driver: [
    { href: PLATFORM_V7R_DRIVER_ROUTE, label: 'Мой маршрут' },
    { href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9103`, label: 'Текущая сделка' },
    { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Диспетчерская' },
  ],
  surveyor: [
    { href: PLATFORM_V7R_SURVEYOR_ROUTE, label: 'Мои назначения' },
    { href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9102`, label: 'Текущая сделка' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
  ],
  elevator: [
    { href: PLATFORM_V7R_ELEVATOR_ROUTE, label: 'Приёмка' },
    { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Диспетчерская' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
  ],
  lab: [
    { href: PLATFORM_V7R_LAB_ROUTE, label: 'Пробы и протоколы' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
  ],
  bank: [
    { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Деньги по сделкам' },
    { href: PLATFORM_V7_BANK_EVENTS_ROUTE, label: 'События банка' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_TRUST_ROUTE, label: 'Центр доверия' },
    { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    { href: PLATFORM_V7R_ANALYTICS_ROUTE, label: 'Сводка' },
  ],
  arbitrator: [
    { href: PLATFORM_V7R_ARBITRATOR_ROUTE, label: 'Комнаты разбора' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Журнал действий' },
    { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
  ],
  compliance: [
    { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Комплаенс' },
    { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_TRUST_ROUTE, label: 'Центр доверия' },
    { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
    { href: PLATFORM_V7R_ANALYTICS_ROUTE, label: 'Сводка' },
  ],
  executive: [
    { href: PLATFORM_V7R_ANALYTICS_ROUTE, label: 'Сводка' },
    { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр управления' },
    { href: PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE, label: 'Путь сделки' },
    { href: PLATFORM_V7_SIMULATOR_ROUTE, label: 'Симулятор' },
    { href: PLATFORM_V7_BANK_CLEAN_ROUTE, label: 'Деньги' },
    { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры' },
    { href: PLATFORM_V7_TRUST_ROUTE, label: 'Центр доверия' },
    { href: PLATFORM_V7_REPORTS_ROUTE, label: 'Отчёты' },
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
