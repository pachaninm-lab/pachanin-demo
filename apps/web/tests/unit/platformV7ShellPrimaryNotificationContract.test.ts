import { describe, expect, it } from 'vitest';
import {
  platformV7PrimaryShellNotification,
  platformV7UnreadShellNotifications,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification contract', () => {
  it('keeps the selected primary notification inside the unread set', () => {
    const primary = platformV7PrimaryShellNotification();
    const unreadIds = new Set(platformV7UnreadShellNotifications().map((notification) => notification.id));

    expect(primary).toBeDefined();
    if (!primary) return;

    expect(unreadIds.has(primary.id)).toBe(true);
  });
});
