import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_BUYER_ROUTE,
  PLATFORM_V7_COMPLIANCE_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_DOMAIN_CORE_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_PROCUREMENT_ROUTE,
  PLATFORM_V7R_ANALYTICS_ROUTE,
  PLATFORM_V7R_ARBITRATOR_ROUTE,
  PLATFORM_V7R_DRIVER_ROUTE,
  PLATFORM_V7R_ROLES_ROUTE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export type PlatformV7QuickJumpGroup = 'Навигация' | 'Сделки' | 'Споры' | 'Роли';
export type PlatformV7QuickJumpAction = `role:${PlatformRole}`;
export type PlatformV7QuickJumpHref =
  | PlatformV7ShellRouteSurface
  | `${typeof PLATFORM_V7_DEALS_ROUTE}/${string}`
  | `${typeof PLATFORM_V7_DISPUTES_ROUTE}/${string}`;

export interface PlatformV7QuickJumpItem {
  href: PlatformV7QuickJumpHref;
  label: string;
  group: PlatformV7QuickJumpGroup;
  action?: PlatformV7QuickJumpAction;
}

export const PLATFORM_V7_QUICK_JUMP_ITEMS: PlatformV7QuickJumpItem[] = [
  { href: PLATFORM_V7R_ROLES_ROUTE, label: 'Все роли', group: 'Навигация' },
  { href: PLATFORM_V7_CONTROL_TOWER_ROUTE, label: 'Центр управления', group: 'Навигация' },
  { href: PLATFORM_V7_DOMAIN_CORE_ROUTE, label: 'Движок сделки', group: 'Навигация' },
  { href: PLATFORM_V7_DEALS_ROUTE, label: 'Сделки', group: 'Навигация' },
  { href: PLATFORM_V7_PROCUREMENT_ROUTE, label: 'Закупки', group: 'Навигация' },
  { href: PLATFORM_V7_LOGISTICS_ROUTE, label: 'Логистика', group: 'Навигация' },
  { href: PLATFORM_V7_BANK_ROUTE, label: 'Банк', group: 'Навигация' },
  { href: PLATFORM_V7_DISPUTES_ROUTE, label: 'Споры', group: 'Навигация' },
  { href: PLATFORM_V7_COMPLIANCE_ROUTE, label: 'Комплаенс', group: 'Навигация' },
  { href: PLATFORM_V7R_ANALYTICS_ROUTE, label: 'Сводка', group: 'Навигация' },
  { href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9102`, label: 'Сделка DL-9102 · Пшеница · Спор', group: 'Сделки' },
  { href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9103`, label: 'Сделка DL-9103 · Кукуруза · В пути', group: 'Сделки' },
  { href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9109`, label: 'Сделка DL-9109 · Запрошена выплата', group: 'Сделки' },
  { href: `${PLATFORM_V7_DISPUTES_ROUTE}/DK-2024-89`, label: 'Спор DK-2024-89 · Влажность', group: 'Споры' },
  { href: PLATFORM_V7R_DRIVER_ROUTE, label: 'Переключить роль: Водитель', group: 'Роли', action: 'role:driver' },
  { href: PLATFORM_V7R_ARBITRATOR_ROUTE, label: 'Переключить роль: Арбитр', group: 'Роли', action: 'role:arbitrator' },
  { href: PLATFORM_V7_BUYER_ROUTE, label: 'Переключить роль: Покупатель', group: 'Роли', action: 'role:buyer' },
];

export function platformV7QuickJumpItems(): PlatformV7QuickJumpItem[] {
  return PLATFORM_V7_QUICK_JUMP_ITEMS;
}

export function platformV7QuickJumpGroups(): PlatformV7QuickJumpGroup[] {
  return Array.from(new Set(PLATFORM_V7_QUICK_JUMP_ITEMS.map((item) => item.group)));
}
