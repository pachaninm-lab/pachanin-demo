import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SHELL_NOTIFICATIONS,
  platformV7ShellNotificationSummary,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 shell notification summary exact counts', () => {
  it('keeps unread and critical counts aligned with the registry', () => {
    const summary = platformV7ShellNotificationSummary();
    const unread = PLATFORM_V7_SHELL_NOTIFICATIONS.filter((notification) => !notification.read);
    const critical = PLATFORM_V7_SHELL_NOTIFICATIONS.filter((notification) => notification.severity === 'critical');

    expect(summary.unread).toBe(unread.length);
    expect(summary.critical).toBe(critical.length);
  });
});
