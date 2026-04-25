import { describe, expect, it } from 'vitest';
import { inferPlatformV7RoleFromPath, platformV7ShellModel } from '@/lib/platform-v7/shell';

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
});
