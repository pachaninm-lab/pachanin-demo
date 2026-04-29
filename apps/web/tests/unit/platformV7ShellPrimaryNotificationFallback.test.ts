import { describe, expect, it } from 'vitest';
import {
  platformV7PrimaryShellNotification,
  platformV7UnreadShellNotifications,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification fallback', () => {
  it('keeps a selected primary notification whenever unread notifications exist', () => {
    const unread = platformV7UnreadShellNotifications();
    const primary = platformV7PrimaryShellNotification();

    expect(unread.length).toBeGreaterThan(0);
    expect(primary).toBeDefined();
  });
});
