import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SHELL_NOTIFICATIONS,
  platformV7ShellNotificationSummary,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 shell notification summary bounds', () => {
  it('keeps summary totals aligned with the notification registry', () => {
    const summary = platformV7ShellNotificationSummary();

    expect(summary.total).toBe(PLATFORM_V7_SHELL_NOTIFICATIONS.length);
    expect(summary.unread).toBeLessThanOrEqual(summary.total);
    expect(summary.critical).toBeLessThanOrEqual(summary.total);
    expect(summary.system).toBeLessThanOrEqual(summary.total);
  });
});
