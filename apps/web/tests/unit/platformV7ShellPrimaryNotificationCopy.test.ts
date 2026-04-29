import { describe, expect, it } from 'vitest';
import { platformV7PrimaryShellNotification } from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 primary shell notification copy', () => {
  it('keeps the selected primary notification copy complete', () => {
    const primary = platformV7PrimaryShellNotification();

    expect(primary).toBeDefined();
    if (!primary) return;

    expect(primary.title.trim()).toBe(primary.title);
    expect(primary.description.trim()).toBe(primary.description);
    expect(primary.title.length).toBeGreaterThan(4);
    expect(primary.description.length).toBeGreaterThan(12);
  });
});
