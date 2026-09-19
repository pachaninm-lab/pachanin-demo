import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export const PLATFORM_V7_ROLE_LABELS: Record<PlatformRole, string> = {
  operator: 'Оператор',
  buyer: 'Покупатель',
  seller: 'Продавец',
  logistics: 'Логист',
  driver: 'Водитель',
  surveyor: 'Сюрвейер',
  elevator: 'Элеватор',
  lab: 'Лаборатория',
  bank: 'Банк',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
  executive: 'Руководитель',
};

export function platformV7RoleLabel(role: PlatformRole): string {
  return PLATFORM_V7_ROLE_LABELS[role];
}

export function platformV7RoleLabelEntries(): Array<[PlatformRole, string]> {
  return Object.entries(PLATFORM_V7_ROLE_LABELS) as Array<[PlatformRole, string]>;
}
