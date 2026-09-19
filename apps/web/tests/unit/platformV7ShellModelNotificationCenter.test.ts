import { describe, expect, it } from 'vitest';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';
import { platformV7ShellNotificationCenterModel } from '@/lib/platform-v7/shellNotificationCenter';

describe('platform-v7 shell model notification center', () => {
  it('exposes the notification center model through the platform shell model', () => {
    const shell = platformV7ShellModel('/platform-v7/control-tower', 'operator');
    const center = platformV7ShellNotificationCenterModel();

    expect(shell.notificationCenter).toEqual(center);
    expect(shell.notificationSummary).toEqual(center.summary);
    expect(shell.primaryNotification).toEqual(center.primary);
  });

  it('keeps notification center routes inside platform v7 from the shell model', () => {
    const shell = platformV7ShellModel('/platform-v7/control-tower', 'operator');

    for (const notification of shell.notificationCenter.items) {
      expect(notification.href.startsWith('/platform-v7')).toBe(true);
      expect(notification.href.includes('/platform-v4')).toBe(false);
      expect(notification.href.includes('/platform-v9')).toBe(false);
    }
  });
});
