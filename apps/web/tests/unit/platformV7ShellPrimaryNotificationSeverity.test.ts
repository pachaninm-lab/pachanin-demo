import { describe, expect, it } from 'vitest';
import {
  platformV7PrimaryShellNotification,
  platformV7UnreadShellNotifications,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification severity', () => {
  it('keeps critical unread notifications ahead of lower-severity unread items', () => {
    const primary = platformV7PrimaryShellNotification();
    const hasUnreadCritical = platformV7UnreadShellNotifications().some((notification) => notification.severity === 'critical');

    expect(hasUnreadCritical).toBe(true);
    expect(primary).toBeDefined();
    expect(primary?.severity).toBe('critical');
  });
});
