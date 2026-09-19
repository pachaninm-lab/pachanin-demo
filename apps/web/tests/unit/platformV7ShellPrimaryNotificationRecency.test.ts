import { describe, expect, it } from 'vitest';
import {
  platformV7PrimaryShellNotification,
  platformV7UnreadShellNotifications,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification recency', () => {
  it('keeps the newest critical unread notification first when multiple critical blockers exist', () => {
    const primary = platformV7PrimaryShellNotification();
    const criticalUnread = platformV7UnreadShellNotifications().filter((notification) => notification.severity === 'critical');
    const newestCritical = criticalUnread.sort(
      (left, right) => Date.parse(right.createdAtIso) - Date.parse(left.createdAtIso),
    )[0];

    expect(criticalUnread.length).toBeGreaterThan(1);
    expect(primary).toEqual(newestCritical);
  });
});
