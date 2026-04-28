import { describe, expect, it } from 'vitest';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';
import { platformV7CriticalShellNotifications, platformV7UnreadShellNotifications } from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 shell model', () => {
  it('exposes unread and critical notification summaries from the typed registry', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    expect(model.role).toBe('operator');
    expect(model.unreadNotifications).toEqual(platformV7UnreadShellNotifications());
    expect(model.criticalNotifications).toEqual(platformV7CriticalShellNotifications());
    expect(model.unreadNotifications.every((notification) => notification.read === false)).toBe(true);
    expect(model.criticalNotifications.every((notification) => notification.severity === 'critical')).toBe(true);
  });
});
