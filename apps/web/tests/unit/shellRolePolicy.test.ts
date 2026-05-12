import { describe, expect, it } from 'vitest';
import { canShowDrawer, canShowGlobalSearch, canShowGlobalStatuses, canShowRoleSwitcher, getShellPolicy } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

describe('shell role policy', () => {
  it.each(['driver', 'surveyor', 'elevator', 'lab'] as PlatformRole[])('treats %s as field shell on any route', (role) => {
    expect(getShellPolicy(role, '/platform-v7/deals/DL-9106')).toBe('field');
    expect(canShowDrawer(role, '/platform-v7/deals/DL-9106')).toBe(false);
    expect(canShowRoleSwitcher(role, '/platform-v7/deals/DL-9106')).toBe(false);
    expect(canShowGlobalSearch(role, '/platform-v7/deals/DL-9106')).toBe(false);
  });

  it.each([
    ['buyer', '/platform-v7/buyer'],
    ['seller', '/platform-v7/seller'],
    ['logistics', '/platform-v7/logistics'],
    ['bank', '/platform-v7/bank'],
    ['arbitrator', '/platform-v7/arbitrator'],
    ['compliance', '/platform-v7/compliance'],
  ] as Array<[PlatformRole, string]>)('uses compact shell for %s', (role, path) => {
    expect(getShellPolicy(role, path)).toBe('role-scoped');
    expect(canShowDrawer(role, path)).toBe(false);
    expect(canShowRoleSwitcher(role, path)).toBe(false);
    expect(canShowGlobalSearch(role, path)).toBe(false);
    expect(canShowGlobalStatuses(role, path)).toBe(false);
  });

  it.each(['operator', 'executive'] as PlatformRole[])('keeps full shell controls for %s control surfaces', (role) => {
    const path = role === 'operator' ? '/platform-v7/control-tower' : '/platform-v7/executive';
    expect(getShellPolicy(role, path)).toBe('operator');
    expect(canShowDrawer(role, path)).toBe(true);
    expect(canShowRoleSwitcher(role, path)).toBe(true);
    expect(canShowGlobalSearch(role, path)).toBe(true);
    expect(canShowGlobalStatuses(role, path)).toBe(true);
  });

  it('uses path scope as a fallback when active role has not rehydrated yet', () => {
    expect(getShellPolicy('operator', '/platform-v7/seller')).toBe('role-scoped');
    expect(canShowDrawer('operator', '/platform-v7/seller')).toBe(false);
    expect(getShellPolicy('operator', '/platform-v7/driver/field')).toBe('field');
    expect(canShowDrawer('operator', '/platform-v7/driver/field')).toBe(false);
  });
});
