import {
  platformV7PrimaryShellNotification,
  platformV7ShellNotificationSummary,
  platformV7ShellNotifications,
  type PlatformV7NotificationSeverity,
  type PlatformV7ShellNotification,
  type PlatformV7ShellNotificationSummary,
} from './shellNotifications';

const PLATFORM_V7_NOTIFICATION_CENTER_SEVERITY_RANK: Record<PlatformV7NotificationSeverity, number> = {
  critical: 4,
  warning: 3,
  info: 2,
  success: 1,
};

export interface PlatformV7ShellNotificationCenterModel {
  summary: PlatformV7ShellNotificationSummary;
  primary?: PlatformV7ShellNotification;
  items: PlatformV7ShellNotification[];
  hasUnread: boolean;
  hasCritical: boolean;
  badgeLabel: string;
}

function comparePlatformV7NotificationCenterItems(left: PlatformV7ShellNotification, right: PlatformV7ShellNotification): number {
  if (left.read !== right.read) return left.read ? 1 : -1;

  const severityDelta =
    PLATFORM_V7_NOTIFICATION_CENTER_SEVERITY_RANK[right.severity] -
    PLATFORM_V7_NOTIFICATION_CENTER_SEVERITY_RANK[left.severity];

  if (severityDelta !== 0) return severityDelta;

  return Date.parse(right.createdAtIso) - Date.parse(left.createdAtIso);
}

export function platformV7ShellNotificationCenterModel(): PlatformV7ShellNotificationCenterModel {
  const summary = platformV7ShellNotificationSummary();

  return {
    summary,
    primary: platformV7PrimaryShellNotification(),
    items: [...platformV7ShellNotifications()].sort(comparePlatformV7NotificationCenterItems),
    hasUnread: summary.unread > 0,
    hasCritical: summary.critical > 0,
    badgeLabel: summary.unread > 99 ? '99+' : String(summary.unread),
  };
}
