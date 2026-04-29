import { describe, expect, it } from 'vitest';
import { platformV7PrimaryShellNotification } from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification href', () => {
  it('keeps the selected primary notification inside platform v7 routes', () => {
    const primary = platformV7PrimaryShellNotification();

    expect(primary).toBeDefined();
    if (!primary) return;

    expect(primary.href.startsWith('/platform-v7')).toBe(true);
    expect(primary.href.includes('/platform-v4')).toBe(false);
    expect(primary.href.includes('/platform-v9')).toBe(false);
  });
});
