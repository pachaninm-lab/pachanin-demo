import {
  PLATFORM_V7_BANK_ROUTE,
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
  id: string;
  kind: PlatformV7NotificationKind;
  severity: PlatformV7NotificationSeverity;
  title: string;
  description: string;
  href: PlatformV7ShellNotificationHref;
  dealId?: string;
  createdAtIso: string;
  read: boolean;
}

export interface PlatformV7ShellNotificationSummary {
  total: number;
  unread: number;
  critical: number;
  blockedMoney: number;
  system: number;
}

const PLATFORM_V7_NOTIFICATION_SEVERITY_RANK: Record<PlatformV7NotificationSeverity, number> = {
  critical: 4,
  warning: 3,
  info: 2,
  success: 1,
};

export const PLATFORM_V7_SHELL_NOTIFICATIONS: PlatformV7ShellNotification[] = [
  {
    id: 'ntf-money-dl-9109-release-review',
    kind: 'money',
    severity: 'warning',
    title: 'Выпуск средств ожидает проверки',
    description: 'По сделке DL-9109 требуется ручная сверка gate перед запросом выпуска средств в банковом контуре.',
    href: `${PLATFORM_V7_BANK_ROUTE}/release-safety`,
    dealId: 'DL-9109',
    createdAtIso: '2026-04-29T09:10:00.000Z',
    read: false,
  },
  {
    id: 'ntf-document-dl-9102-missing-pack',
    kind: 'document',
    severity: 'warning',
    title: 'Пакет документов неполный',
    description: 'Для DL-9102 нельзя считать документный gate закрытым: не хватает обязательного документа или подтверждения статуса.',
    href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9102`,
    dealId: 'DL-9102',
    createdAtIso: '2026-04-29T09:25:00.000Z',
    read: false,
  },
  {
    id: 'ntf-logistics-dl-9103-delay',
    kind: 'logistics',
    severity: 'warning',
    title: 'Рейс требует внимания оператора',
    description: 'По DL-9103 зафиксировано отклонение по сроку прибытия; событие остаётся в проверочном логистическом контуре.',
    href: `${PLATFORM_V7_LOGISTICS_ROUTE}/TM-9103`,
    dealId: 'DL-9103',
    createdAtIso: '2026-04-29T09:40:00.000Z',
    read: false,
  },
  {
    id: 'ntf-dispute-dk-2024-89-quality',
    kind: 'dispute',
    severity: 'critical',
    title: 'Открыт спор по качеству',
    description: 'Спор DK-2024-89 блокирует спорную часть расчёта до решения по доказательствам и лабораторному основанию.',
    href: `${PLATFORM_V7_DISPUTES_ROUTE}/DK-2024-89`,
    dealId: 'DL-9102',
    createdAtIso: '2026-04-29T10:05:00.000Z',
    read: false,
  },
  {
    id: 'ntf-risk-dl-9102-anti-bypass',
    kind: 'risk',
    severity: 'warning',
    title: 'Риск обхода платформы',
    description: 'По DL-9102 раскрытие сторон и контактов должно идти только через правила антиобхода и журнал событий.',
    href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9102`,
    dealId: 'DL-9102',
    createdAtIso: '2026-04-29T10:20:00.000Z',
    read: true,
  },
  {
    id: 'ntf-system-sandbox-marker',
    kind: 'system',
    severity: 'info',
    title: 'Контур работает в режиме пилота',
    description: 'Экран показывает проверочный слой platform-v7: внешние интеграции должны оставаться с честной маркировкой песочницы или ручного подтверждения.',
    href: PLATFORM_V7_BANK_ROUTE,
    createdAtIso: '2026-04-29T10:35:00.000Z',
    read: false,
  },
  {
    id: 'ntf-document-dl-9109-gate-ok',
    kind: 'document',
    severity: 'success',
    title: 'Документный gate пройден',
    description: 'По DL-9109 документный пакет в проверочном контуре собран; следующий шаг всё равно требует сверки денежных условий.',
    href: `${PLATFORM_V7_DEALS_ROUTE}/DL-9109`,
    dealId: 'DL-9109',
    createdAtIso: '2026-04-29T10:50:00.000Z',
    read: true,
  },
  {
    id: 'ntf-money-dl-9102-release-blocked',
    kind: 'money',
    severity: 'critical',
    title: 'Выпуск денег заблокирован',
    description: 'По DL-9102 нельзя выпускать деньги: открыт спор, есть удержание или не закрыт обязательный документный gate.',
    href: `${PLATFORM_V7_BANK_ROUTE}/release-safety`,
    dealId: 'DL-9102',
    createdAtIso: '2026-04-29T11:05:00.000Z',
    read: false,
  },
];

export function platformV7ShellNotifications(): PlatformV7ShellNotification[] {
  return PLATFORM_V7_SHELL_NOTIFICATIONS;
}

export function platformV7UnreadShellNotifications(): PlatformV7ShellNotification[] {
  return PLATFORM_V7_SHELL_NOTIFICATIONS.filter((notification) => !notification.read);
}

export function platformV7CriticalShellNotifications(): PlatformV7ShellNotification[] {
  return PLATFORM_V7_SHELL_NOTIFICATIONS.filter((notification) => notification.severity === 'critical');
}

export function platformV7ShellNotificationsByDeal(dealId: string): PlatformV7ShellNotification[] {
  return PLATFORM_V7_SHELL_NOTIFICATIONS.filter((notification) => notification.dealId === dealId);
}

export function platformV7PrimaryShellNotification(): PlatformV7ShellNotification | undefined {
  return [...platformV7UnreadShellNotifications()].sort((left, right) => {
    const severityDelta = PLATFORM_V7_NOTIFICATION_SEVERITY_RANK[right.severity] - PLATFORM_V7_NOTIFICATION_SEVERITY_RANK[left.severity];

    if (severityDelta !== 0) return severityDelta;

    return Date.parse(right.createdAtIso) - Date.parse(left.createdAtIso);
  })[0];
}

export function platformV7ShellNotificationSummary(): PlatformV7ShellNotificationSummary {
  return {
    total: PLATFORM_V7_SHELL_NOTIFICATIONS.length,
    unread: platformV7UnreadShellNotifications().length,
    critical: platformV7CriticalShellNotifications().length,
    blockedMoney: PLATFORM_V7_SHELL_NOTIFICATIONS.filter(
      (notification) => notification.kind === 'money' && notification.severity === 'critical' && !notification.read,
    ).length,
    system: PLATFORM_V7_SHELL_NOTIFICATIONS.filter((notification) => notification.kind === 'system').length,
  };
}
