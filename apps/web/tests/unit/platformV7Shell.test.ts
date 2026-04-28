import { describe, expect, it } from 'vitest';
import { inferPlatformV7RoleFromPath, platformV7ShellModel } from '@/lib/platform-v7/shell';
import { PLATFORM_V7_ROLE_LABELS, platformV7RoleLabel, platformV7RoleLabelEntries } from '@/lib/platform-v7/shellLabels';

const BANNED_CLAIMS = [
  'production ready',
  'fully live',
  'guaranteed payment',
  'all integrations completed',
  'no risk',
  'live integration completed',
];

describe('platform-v7 shell model', () => {
  it('infers roles from route prefixes', () => {
    expect(inferPlatformV7RoleFromPath('/platform-v7/control-tower', 'seller')).toBe('operator');
    expect(inferPlatformV7RoleFromPath('/platform-v7/procurement', 'seller')).toBe('buyer');
    expect(inferPlatformV7RoleFromPath('/platform-v7/lots', 'buyer')).toBe('seller');
    expect(inferPlatformV7RoleFromPath('/platform-v7/bank', 'operator')).toBe('bank');
  });

  it('builds shell model from centralized E02 foundations', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'seller');
    expect(model.role).toBe('operator');
    expect(model.roleLabel).toBe('Оператор');
    expect(model.stage).toEqual({ label: 'Пилотный режим', tone: 'pilot' });
    expect(model.navItems[0]).toMatchObject({ label: 'Центр управления', href: '/platform-v7/control-tower' });
    expect(model.breadcrumbs[1]).toMatchObject({ label: 'Центр управления' });
    expect(model.showBreadcrumbs).toBe(true);
  });

  it('keeps root and roles breadcrumbs hidden', () => {
    expect(platformV7ShellModel('/platform-v7', 'operator').showBreadcrumbs).toBe(false);
    expect(platformV7ShellModel('/platform-v7/roles', 'operator').showBreadcrumbs).toBe(false);
  });

  it('roleLabel comes from shellLabels registry — not navigation.ts', () => {
    const roles = Object.keys(PLATFORM_V7_ROLE_LABELS) as Array<keyof typeof PLATFORM_V7_ROLE_LABELS>;
    roles.forEach((role) => {
      const registryLabel = PLATFORM_V7_ROLE_LABELS[role];
      const model = platformV7ShellModel('/platform-v7/control-tower', role);
      // model.role may be inferred as operator from the path; test the registry function directly
      expect(platformV7RoleLabel(role)).toBe(registryLabel);
    });
  });

  it('shell model roleLabel matches shellLabels registry for the inferred role', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');
    expect(model.role).toBe('operator');
    expect(model.roleLabel).toBe(PLATFORM_V7_ROLE_LABELS['operator']);
    expect(model.roleLabel).toBe('Оператор');
  });

  it('all roles have a non-empty label in the shellLabels registry', () => {
    platformV7RoleLabelEntries().forEach(([, label]) => {
      expect(label.trim()).not.toBe('');
    });
  });

  it('no banned claims appear in any role label', () => {
    platformV7RoleLabelEntries().forEach(([, label]) => {
      const lower = label.toLowerCase();
      BANNED_CLAIMS.forEach((claim) => {
        expect(lower).not.toContain(claim);
      });
    });
  });

  it('roleLabel for buyer role is taken from shellLabels registry', () => {
    expect(platformV7RoleLabel('buyer')).toBe(PLATFORM_V7_ROLE_LABELS['buyer']);
  });

  it('roleLabel for logistics role uses shellLabels value', () => {
    expect(platformV7RoleLabel('logistics')).toBe(PLATFORM_V7_ROLE_LABELS['logistics']);
  });
});
