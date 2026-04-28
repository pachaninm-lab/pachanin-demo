import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  type PlatformV7ShellRouteSurface,
} from './routes';

export type PlatformV7NotificationKind = 'money' | 'document' | 'logistics' | 'dispute' | 'risk' | 'system';
export type PlatformV7NotificationSeverity = 'info' | 'warning' | 'critical' | 'success';

export type PlatformV7ShellNotificationHref =
  | PlatformV7ShellRouteSurface
  | `${typeof PLATFORM_V7_DEALS_ROUTE}/${string}`
  | `${typeof PLATFORM_V7_DISPUTES_ROUTE}/${string}`
  | `${typeof PLATFORM_V7_BANK_ROUTE}/${string}`
  | `${typeof PLATFORM_V7_LOGISTICS_ROUTE}/${string}`;

export interface PlatformV7ShellNotification {
  readonly id: string;
  readonly kind: PlatformV7NotificationKind;
  readonly severity: PlatformV7NotificationSeverity;
  readonly title: string;
  readonly description: string;
  readonly href: PlatformV7ShellNotificationHref;
  readonly dealId?: string;
  readonly createdAtIso: string;
  readonly read: boolean;
}

export const PLATFORM_V7_SHELL_NOTIFICATIONS: readonly PlatformV7ShellNotification[] = [
  {
    id: 'NOTICE-DL-9102-DISPUTE-01',
    kind: 'dispute',
    severity: 'critical',
    title: 'Спор открыт по сделке DL-9102',
    description: 'Расхождение по влажности зерна. Требуется решение арбитра до выпуска денег.',
    href: `${PLATFORM_V7_DISPUTES_ROUTE}/DK-2024-89`,
    dealId: 'DL-9102',
    createdAtIso: '2026-04-17T08:42:00.000Z',
    read: false,
  },
  {
    id: 'NOTICE-DL-9102-QUALITY-01',
    kind: 'risk',
    severity: 'warning',
    title: 'Качество отклонено по DL-9102',
    description: 'Лабораторный анализ показал влажность 16.2% при норме 14%. Сделка заблокирована.',
    href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9102`,
    dealId: 'DL-9102',
    createdAtIso: '2026-04-17T07:15:00.000Z',
    read: true,
  },
  {
    id: 'NOTICE-DL-9103-LOGISTICS-01',
    kind: 'logistics',
    severity: 'info',
    title: 'ТМБ-14 в пути по сделке DL-9103',
    description: 'Транспорт вышел с загрузочного пункта. Расчётное прибытие на элеватор — 14:30.',
    href: `${PLATFORM_V7_LOGISTICS_ROUTE}/LOG-TMB-14`,
    dealId: 'DL-9103',
    createdAtIso: '2026-04-28T09:00:00.000Z',
    read: false,
  },
  {
    id: 'NOTICE-DL-9103-MONEY-01',
    kind: 'money',
    severity: 'info',
    title: 'Резерв денег подтверждён по DL-9103',
    description: 'Намерение резерва зафиксировано в банке. Выпуск ожидает завершения логистики.',
    href: `${PLATFORM_V7_BANK_ROUTE}/RESERVE-DL-9103`,
    dealId: 'DL-9103',
    createdAtIso: '2026-04-27T14:30:00.000Z',
    read: true,
  },
  {
    id: 'NOTICE-DL-9109-RELEASE-01',
    kind: 'money',
    severity: 'critical',
    title: 'Выпуск 10.5 млн ₽ заблокирован по DL-9109',
    description: 'Банк ожидает ручного подтверждения. Следующий владелец: банковый контролёр.',
    href: `${PLATFORM_V7_BANK_ROUTE}/CB-443`,
    dealId: 'DL-9109',
    createdAtIso: '2026-04-28T09:48:00.000Z',
    read: false,
  },
  {
    id: 'NOTICE-DL-9109-DOCS-01',
    kind: 'document',
    severity: 'warning',
    title: 'Документы неполны по DL-9109',
    description: 'Отсутствует СДИЗ и акт приёмки. Выпуск невозможен без подтверждения пакета.',
    href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9109`,
    dealId: 'DL-9109',
    createdAtIso: '2026-04-28T08:10:00.000Z',
    read: false,
  },
  {
    id: 'NOTICE-DK-2024-89-ARBITRATION-01',
    kind: 'dispute',
    severity: 'critical',
    title: 'Арбитраж по спору DK-2024-89',
    description: 'Дело передано арбитру. Срок рассмотрения — 5 рабочих дней. Деньги удержаны.',
    href: `${PLATFORM_V7_DISPUTES_ROUTE}/DK-2024-89`,
    createdAtIso: '2026-04-20T11:00:00.000Z',
    read: false,
  },
  {
    id: 'NOTICE-DK-2024-89-EVIDENCE-01',
    kind: 'document',
    severity: 'success',
    title: 'Доказательства загружены по DK-2024-89',
    description: 'Лабораторный протокол и фотофиксация приняты системой. Дело готово к рассмотрению.',
    href: `${PLATFORM_V7_DISPUTES_ROUTE}/DK-2024-89`,
    createdAtIso: '2026-04-19T16:20:00.000Z',
    read: true,
  },
  {
    id: 'NOTICE-SYSTEM-PILOT-01',
    kind: 'system',
    severity: 'info',
    title: 'Режим controlled-pilot активен',
    description: 'Все действия фиксируются в журнале. Интеграции с ФГИС и банком — в sandbox-контуре.',
    href: PLATFORM_V7_CONTROL_TOWER_ROUTE,
    createdAtIso: '2026-04-28T00:00:00.000Z',
    read: true,
  },
] as const;

export function platformV7ShellNotifications(): readonly PlatformV7ShellNotification[] {
  return PLATFORM_V7_SHELL_NOTIFICATIONS;
}

export function platformV7UnreadShellNotifications(): readonly PlatformV7ShellNotification[] {
  return PLATFORM_V7_SHELL_NOTIFICATIONS.filter((n) => !n.read);
}

export function platformV7CriticalShellNotifications(): readonly PlatformV7ShellNotification[] {
  return PLATFORM_V7_SHELL_NOTIFICATIONS.filter((n) => n.severity === 'critical');
}

export function platformV7ShellNotificationsByDeal(dealId: string): readonly PlatformV7ShellNotification[] {
  return PLATFORM_V7_SHELL_NOTIFICATIONS.filter((n) => n.dealId === dealId);
}
