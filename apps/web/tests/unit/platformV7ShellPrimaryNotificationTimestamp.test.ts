import { describe, expect, it } from 'vitest';
import { platformV7PrimaryShellNotification } from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification timestamp', () => {
  it('keeps the selected primary notification timestamp machine-readable', () => {
    const primary = platformV7PrimaryShellNotification();

    expect(primary).toBeDefined();
    if (!primary) return;

    expect(Number.isNaN(Date.parse(primary.createdAtIso))).toBe(false);
    expect(primary.createdAtIso.endsWith('Z')).toBe(true);
  });
});
