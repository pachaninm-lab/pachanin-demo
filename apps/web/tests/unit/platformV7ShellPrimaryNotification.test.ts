import { describe, expect, it } from 'vitest';
import {
  platformV7PrimaryShellNotification,
  platformV7UnreadShellNotifications,
} from '@/lib/platform-v7/shellNotifications';
import { PLATFORM_V7_BANK_ROUTE } from '@/lib/platform-v7/routes';

describe('platform-v7 primary shell notification', () => {
  it('selects the most urgent unread notification for operator attention', () => {
    const primary = platformV7PrimaryShellNotification();

    expect(platformV7UnreadShellNotifications().length).toBeGreaterThan(0);
    expect(primary).toBeDefined();
    expect(primary?.severity).toBe('critical');
    expect(primary?.kind).toBe('money');
    expect(primary?.href).toBe(`${PLATFORM_V7_BANK_ROUTE}/release-safety`);
    expect(primary?.read).toBe(false);
  });
});
