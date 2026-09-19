import { describe, expect, it } from 'vitest';
import { platformV7PrimaryShellNotification } from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification severity scope', () => {
  it('keeps the selected primary notification severity inside the supported set', () => {
    const primary = platformV7PrimaryShellNotification();
    const allowedSeverities = new Set(['info', 'warning', 'critical', 'success']);

    expect(primary).toBeDefined();
    if (!primary) return;

    expect(allowedSeverities.has(primary.severity)).toBe(true);
  });
});
