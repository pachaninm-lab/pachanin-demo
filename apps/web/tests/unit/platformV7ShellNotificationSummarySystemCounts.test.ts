import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SHELL_NOTIFICATIONS,
  platformV7ShellNotificationSummary,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 shell notification summary system counts', () => {
  it('keeps system and blocked money counts aligned with the registry', () => {
    const summary = platformV7ShellNotificationSummary();
    const system = PLATFORM_V7_SHELL_NOTIFICATIONS.filter((notification) => notification.kind === 'system');
    const blockedMoney = PLATFORM_V7_SHELL_NOTIFICATIONS.filter(
      (notification) => notification.kind === 'money' && notification.severity === 'critical' && !notification.read,
    );

    expect(summary.system).toBe(system.length);
    expect(summary.blockedMoney).toBe(blockedMoney.length);
  });
});
