import { describe, expect, it } from 'vitest';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';
import { platformV7PrimaryShellNotification } from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 shell model primary notification', () => {
  it('exposes the primary notification from the shell notification selector', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    expect(model.role).toBe('operator');
    expect(model.primaryNotification).toEqual(platformV7PrimaryShellNotification());
    expect(model.primaryNotification?.read).toBe(false);
    expect(model.primaryNotification?.severity).toBe('critical');
  });
});
