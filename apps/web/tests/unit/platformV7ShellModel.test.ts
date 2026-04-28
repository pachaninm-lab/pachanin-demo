import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';
import { platformV7RoleLabel, platformV7RoleLabelEntries } from '@/lib/platform-v7/shellLabels';
import {
  platformV7CriticalShellNotifications,
  platformV7ShellNotifications,
  platformV7UnreadShellNotifications,
} from '@/lib/platform-v7/shellNotifications';

const BANNED_ROLE_LABEL_CLAIMS = [
  'production ready',
  'fully live',
  'live integration completed',
  'guaranteed payment',
  'all integrations completed',
  'no risk',
];

describe('platform-v7 shell model', () => {
  it('exposes unread and critical notification summaries from the typed registry', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    expect(model.role).toBe('operator');
    expect(model.unreadNotifications).toEqual(platformV7UnreadShellNotifications());
    expect(model.criticalNotifications).toEqual(platformV7CriticalShellNotifications());
    expect(model.unreadNotifications.every((notification) => notification.read === false)).toBe(true);
    expect(model.criticalNotifications.every((notification) => notification.severity === 'critical')).toBe(true);
  });

  it('keeps shell notifications unique and scoped to platform v7 routes', () => {
    const ids = new Set<string>();

    for (const notification of platformV7ShellNotifications()) {
      expect(ids.has(notification.id)).toBe(false);
      ids.add(notification.id);
      expect(notification.title.trim()).not.toBe('');
      expect(notification.description.trim()).not.toBe('');
      expect(notification.href.startsWith('/platform-v7')).toBe(true);
      expect(notification.href.includes('/platform-v4')).toBe(false);
      expect(notification.href.includes('/platform-v9')).toBe(false);
    }
  });

  it('maps inferred role labels through the shell labels registry', () => {
    const cases: Array<{ path: string; currentRole: PlatformRole; expectedRole: PlatformRole }> = [
      { path: '/platform-v7/control-tower', currentRole: 'buyer', expectedRole: 'operator' },
      { path: '/platform-v7/logistics', currentRole: 'buyer', expectedRole: 'logistics' },
      { path: '/platform-v7/bank', currentRole: 'buyer', expectedRole: 'bank' },
    ];

    for (const { path, currentRole, expectedRole } of cases) {
      const model = platformV7ShellModel(path, currentRole);

      expect(model.role).toBe(expectedRole);
      expect(model.roleLabel).toBe(platformV7RoleLabel(expectedRole));
    }
  });

  it('keeps every shell label registry value non-empty and free of maturity claims', () => {
    for (const [, label] of platformV7RoleLabelEntries()) {
      expect(label.trim()).not.toBe('');

      const normalized = label.toLowerCase();
      for (const claim of BANNED_ROLE_LABEL_CLAIMS) {
        expect(normalized).not.toContain(claim);
      }
    }
  });
});
