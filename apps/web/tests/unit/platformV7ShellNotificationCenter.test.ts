import { describe, expect, it } from 'vitest';
import { platformV7ShellNotificationCenterModel } from '@/lib/platform-v7/shellNotificationCenter';
import {
  platformV7PrimaryShellNotification,
  platformV7ShellNotificationSummary,
  platformV7ShellNotifications,
} from '@/lib/platform-v7/shellNotifications';

const forbiddenClaims = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'no risk',
  'all integrations completed',
];

describe('platform-v7 shell notification center model', () => {
  it('exposes summary and primary notification from the typed notification layer', () => {
    const model = platformV7ShellNotificationCenterModel();

    expect(model.summary).toEqual(platformV7ShellNotificationSummary());
    expect(model.primary).toEqual(platformV7PrimaryShellNotification());
    expect(model.hasUnread).toBe(model.summary.unread > 0);
    expect(model.hasCritical).toBe(model.summary.critical > 0);
  });

  it('sorts notification center items by unread, severity, then recency', () => {
    const model = platformV7ShellNotificationCenterModel();

    expect(model.items.map((notification) => notification.id)).toEqual([
      'ntf-money-dl-9102-release-blocked',
      'ntf-dispute-dk-2024-89-quality',
      'ntf-logistics-dl-9103-delay',
      'ntf-document-dl-9102-missing-pack',
      'ntf-money-dl-9109-release-review',
      'ntf-system-sandbox-marker',
      'ntf-document-dl-9109-gate-ok',
      'ntf-risk-dl-9102-anti-bypass',
    ]);
    expect(model.items).toHaveLength(platformV7ShellNotifications().length);
  });

  it('keeps the notification badge bounded for header rendering', () => {
    const model = platformV7ShellNotificationCenterModel();

    expect(model.badgeLabel).toBe(String(model.summary.unread));
    expect(model.badgeLabel.length).toBeLessThanOrEqual(3);
  });

  it('keeps notification center links inside platform v7', () => {
    const model = platformV7ShellNotificationCenterModel();

    for (const notification of model.items) {
      expect(notification.href.startsWith('/platform-v7')).toBe(true);
      expect(notification.href.includes('/platform-v4')).toBe(false);
      expect(notification.href.includes('/platform-v9')).toBe(false);
    }
  });

  it('keeps notification center copy free of forbidden maturity claims', () => {
    const model = platformV7ShellNotificationCenterModel();

    for (const notification of model.items) {
      const normalized = `${notification.title} ${notification.description}`.toLowerCase();
      for (const claim of forbiddenClaims) {
        expect(normalized.includes(claim)).toBe(false);
      }
    }
  });
});
