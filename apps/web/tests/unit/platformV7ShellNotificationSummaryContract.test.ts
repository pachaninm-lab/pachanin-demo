import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SHELL_NOTIFICATIONS,
  platformV7ShellNotificationSummary,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 shell notification summary contract', () => {
  it('keeps money hold count aligned with active critical money notifications', () => {
    const activeMoneyHolds = PLATFORM_V7_SHELL_NOTIFICATIONS.filter(
      (notification) => notification.kind === 'money' && notification.severity === 'critical' && !notification.read,
    );

    expect(platformV7ShellNotificationSummary().blockedMoney).toBe(activeMoneyHolds.length);
    expect(activeMoneyHolds.length).toBeGreaterThan(0);
  });
});
