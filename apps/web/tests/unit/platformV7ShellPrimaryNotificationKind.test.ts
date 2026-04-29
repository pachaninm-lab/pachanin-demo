import { describe, expect, it } from 'vitest';
import { platformV7PrimaryShellNotification } from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification kind', () => {
  it('keeps the selected primary notification typed as a supported shell kind', () => {
    const primary = platformV7PrimaryShellNotification();
    const allowedKinds = new Set(['money', 'document', 'logistics', 'dispute', 'risk', 'system']);

    expect(primary).toBeDefined();
    if (!primary) return;

    expect(allowedKinds.has(primary.kind)).toBe(true);
  });
});
