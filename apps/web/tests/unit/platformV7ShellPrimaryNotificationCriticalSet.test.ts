import { describe, expect, it } from 'vitest';
import {
  platformV7PrimaryShellNotification,
  platformV7CriticalShellNotifications,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification critical set', () => {
  it('keeps a critical primary notification inside the critical notification set', () => {
    const primary = platformV7PrimaryShellNotification();
    const criticalIds = new Set(platformV7CriticalShellNotifications().map((notification) => notification.id));

    expect(primary).toBeDefined();
    if (!primary || primary.severity !== 'critical') return;

    expect(criticalIds.has(primary.id)).toBe(true);
  });
});
