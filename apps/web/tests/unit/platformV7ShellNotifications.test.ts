import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_SHELL_NOTIFICATIONS,
  platformV7CriticalShellNotifications,
  platformV7ShellNotifications,
  platformV7ShellNotificationsByDeal,
  platformV7UnreadShellNotifications,
} from '@/lib/platform-v7/shellNotifications';
import {
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
} from '@/lib/platform-v7/routes';

const forbiddenClaims = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'no risk',
  'all integrations completed',
];

function isAllowedNotificationHref(href: string) {
  const shellRoutes = new Set<string>(PLATFORM_V7_SHELL_ROUTE_SURFACE);

  return (
    shellRoutes.has(href) ||
    href.startsWith(`${PLATFORM_V7_DEALS_ROUTE}/`) ||
    href.startsWith(`${PLATFORM_V7_DISPUTES_ROUTE}/`) ||
    href.startsWith(`${PLATFORM_V7_BANK_ROUTE}/`) ||
    href.startsWith(`${PLATFORM_V7_LOGISTICS_ROUTE}/`)
  );
}

describe('platform-v7 shell notifications', () => {
  it('keeps shell notifications centralized', () => {
    expect(platformV7ShellNotifications()).toBe(PLATFORM_V7_SHELL_NOTIFICATIONS);
    expect(platformV7ShellNotifications().length).toBeGreaterThanOrEqual(8);
  });

  it('keeps notification ids unique', () => {
    const ids = PLATFORM_V7_SHELL_NOTIFICATIONS.map((notification) => notification.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps notification hrefs inside approved route classes', () => {
    for (const notification of PLATFORM_V7_SHELL_NOTIFICATIONS) {
      expect(isAllowedNotificationHref(notification.href), `${notification.href} must stay approved`).toBe(true);
    }
  });

  it('returns only unread notifications', () => {
    expect(platformV7UnreadShellNotifications().length).toBeGreaterThan(0);
    expect(platformV7UnreadShellNotifications().every((notification) => notification.read === false)).toBe(true);
  });

  it('returns only critical notifications', () => {
    expect(platformV7CriticalShellNotifications().length).toBeGreaterThan(0);
    expect(platformV7CriticalShellNotifications().every((notification) => notification.severity === 'critical')).toBe(true);
  });

  it('filters notifications by deal id', () => {
    const dl9102 = platformV7ShellNotificationsByDeal('DL-9102');
    expect(dl9102.length).toBeGreaterThan(0);
    expect(dl9102.every((notification) => notification.dealId === 'DL-9102')).toBe(true);
  });

  it('does not introduce forbidden live or production claims', () => {
    for (const notification of PLATFORM_V7_SHELL_NOTIFICATIONS) {
      const haystack = `${notification.title} ${notification.description}`.toLowerCase();
      for (const claim of forbiddenClaims) {
        expect(haystack.includes(claim)).toBe(false);
      }
    }
  });

  it('keeps notification copy in Russian-oriented shell language', () => {
    const latinWordPattern = /\b(production|ready|fully|live|integration|completed|guaranteed|payment|risk)\b/i;

    for (const notification of PLATFORM_V7_SHELL_NOTIFICATIONS) {
      expect(notification.title).not.toMatch(latinWordPattern);
      expect(notification.description).not.toMatch(latinWordPattern);
    }
  });

  it('keeps notification metadata machine-readable', () => {
    const allowedKinds = new Set(['money', 'document', 'logistics', 'dispute', 'risk', 'system']);
    const allowedSeverities = new Set(['info', 'warning', 'critical', 'success']);

    for (const notification of PLATFORM_V7_SHELL_NOTIFICATIONS) {
      expect(allowedKinds.has(notification.kind), `${notification.id} kind`).toBe(true);
      expect(allowedSeverities.has(notification.severity), `${notification.id} severity`).toBe(true);
      expect(notification.href.trim()).toBe(notification.href);
      expect(Number.isNaN(Date.parse(notification.createdAtIso)), `${notification.id} createdAtIso`).toBe(false);
      expect(notification.createdAtIso.endsWith('Z')).toBe(true);
    }
  });

  it('keeps deal-scoped notifications traceable', () => {
    for (const notification of PLATFORM_V7_SHELL_NOTIFICATIONS) {
      if (notification.kind === 'system') {
        expect(notification.dealId).toBeUndefined();
        continue;
      }

      expect(notification.dealId, `${notification.id} dealId`).toMatch(/^DL-\d+$/);
    }
  });

  it('keeps urgent shell notifications active', () => {
    for (const notification of PLATFORM_V7_SHELL_NOTIFICATIONS) {
      if (notification.severity === 'critical') {
        expect(notification.read, `${notification.id} critical notification must remain active`).toBe(false);
      }

      if (notification.kind === 'system') {
        expect(notification.severity, `${notification.id} system notification severity`).toBe('info');
      }
    }
  });

  it('keeps notification copy complete', () => {
    for (const notification of PLATFORM_V7_SHELL_NOTIFICATIONS) {
      expect(notification.title.trim()).toBe(notification.title);
      expect(notification.description.trim()).toBe(notification.description);
      expect(notification.title.length, `${notification.id} title`).toBeGreaterThan(4);
      expect(notification.description.length, `${notification.id} description`).toBeGreaterThan(12);
    }
  });

  it('keeps blocked money notifications explicit and routed to release safety', () => {
    const blockedMoneyNotifications = PLATFORM_V7_SHELL_NOTIFICATIONS.filter(
      (notification) => notification.kind === 'money' && notification.severity === 'critical',
    );

    expect(blockedMoneyNotifications.length).toBeGreaterThan(0);

    for (const notification of blockedMoneyNotifications) {
      const copy = `${notification.title} ${notification.description}`.toLowerCase();

      expect(notification.read, `${notification.id} blocked money notification must stay active`).toBe(false);
      expect(notification.href, `${notification.id} blocked money route`).toBe(`${PLATFORM_V7_BANK_ROUTE}/release-safety`);
      expect(copy, `${notification.id} blocked money copy`).toMatch(/заблокирован|нельзя|удержание|спор|документ/);
    }
  });

  it('keeps notification chronology deterministic', () => {
    const timestamps = PLATFORM_V7_SHELL_NOTIFICATIONS.map((notification) => Date.parse(notification.createdAtIso));

    expect(new Set(timestamps).size).toBe(timestamps.length);

    for (let index = 1; index < timestamps.length; index += 1) {
      expect(timestamps[index], `notification ${index} must not move backwards`).toBeGreaterThan(timestamps[index - 1]);
    }
  });
});
