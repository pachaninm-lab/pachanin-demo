import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SHELL_NOTIFICATIONS,
  platformV7ShellNotifications,
  platformV7UnreadShellNotifications,
  platformV7CriticalShellNotifications,
  platformV7ShellNotificationsByDeal,
} from '@/lib/platform-v7/shellNotifications';

describe('platform-v7 shell notifications', () => {
  it('has at least 8 notifications', () => {
    expect(platformV7ShellNotifications().length).toBeGreaterThanOrEqual(8);
  });

  it('PLATFORM_V7_SHELL_NOTIFICATIONS and platformV7ShellNotifications() return the same data', () => {
    expect(platformV7ShellNotifications()).toBe(PLATFORM_V7_SHELL_NOTIFICATIONS);
  });

  it('all notification IDs are unique', () => {
    const ids = platformV7ShellNotifications().map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all hrefs are non-empty and start with /', () => {
    platformV7ShellNotifications().forEach((n) => {
      expect(typeof n.href).toBe('string');
      expect(n.href.startsWith('/')).toBe(true);
    });
  });

  it('all createdAtIso are valid ISO 8601 strings', () => {
    platformV7ShellNotifications().forEach((n) => {
      expect(n.createdAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  it('unread notifications all have read: false', () => {
    platformV7UnreadShellNotifications().forEach((n) => {
      expect(n.read).toBe(false);
    });
  });

  it('there is at least one unread notification', () => {
    expect(platformV7UnreadShellNotifications().length).toBeGreaterThan(0);
  });

  it('critical notifications all have severity: critical', () => {
    platformV7CriticalShellNotifications().forEach((n) => {
      expect(n.severity).toBe('critical');
    });
  });

  it('there is at least one critical notification', () => {
    expect(platformV7CriticalShellNotifications().length).toBeGreaterThan(0);
  });

  it('platformV7ShellNotificationsByDeal returns only DL-9102 notifications', () => {
    const result = platformV7ShellNotificationsByDeal('DL-9102');
    expect(result.length).toBeGreaterThan(0);
    result.forEach((n) => {
      expect(n.dealId).toBe('DL-9102');
    });
  });

  it('platformV7ShellNotificationsByDeal returns only DL-9103 notifications', () => {
    const result = platformV7ShellNotificationsByDeal('DL-9103');
    expect(result.length).toBeGreaterThan(0);
    result.forEach((n) => {
      expect(n.dealId).toBe('DL-9103');
    });
  });

  it('platformV7ShellNotificationsByDeal returns only DL-9109 notifications', () => {
    const result = platformV7ShellNotificationsByDeal('DL-9109');
    expect(result.length).toBeGreaterThan(0);
    result.forEach((n) => {
      expect(n.dealId).toBe('DL-9109');
    });
  });

  it('platformV7ShellNotificationsByDeal returns empty for unknown deal', () => {
    expect(platformV7ShellNotificationsByDeal('DL-UNKNOWN-9999')).toHaveLength(0);
  });

  it('notifications tied to DK-2024-89 reference that dispute in href', () => {
    const dk = platformV7ShellNotifications().filter((n) => n.href.includes('DK-2024-89'));
    expect(dk.length).toBeGreaterThan(0);
  });

  it('system notifications have no dealId', () => {
    const system = platformV7ShellNotifications().filter((n) => n.kind === 'system');
    expect(system.length).toBeGreaterThan(0);
    system.forEach((n) => {
      expect(n.dealId).toBeUndefined();
    });
  });

  it('no notification title or description starts with a Latin letter (Russian text only)', () => {
    platformV7ShellNotifications().forEach((n) => {
      expect(n.title).not.toMatch(/^[a-zA-Z]/);
      expect(n.description).not.toMatch(/^[a-zA-Z]/);
    });
  });

  it('no banned claims in title or description', () => {
    const banned = [
      'production ready',
      'fully live',
      'live integration completed',
      'guaranteed payment',
      'no risk',
      'all integrations completed',
    ];
    platformV7ShellNotifications().forEach((n) => {
      const combined = `${n.title} ${n.description}`.toLowerCase();
      banned.forEach((term) => {
        expect(combined).not.toContain(term);
      });
    });
  });

  it('every notification has a non-empty id, title, and description', () => {
    platformV7ShellNotifications().forEach((n) => {
      expect(n.id.trim()).not.toBe('');
      expect(n.title.trim()).not.toBe('');
      expect(n.description.trim()).not.toBe('');
    });
  });
});
