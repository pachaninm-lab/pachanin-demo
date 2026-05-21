import { describe, expect, it } from 'vitest';
import {
  OPERATOR_HEADER_ROLES,
  COMMERCIAL_HEADER_ROLES,
  CONTROL_HEADER_ROLES,
  canShowDrawer,
  canShowGlobalSearch,
  canShowGlobalStatuses,
  canShowPortalRoleSwitcher,
  canShowRoleSwitcher,
  getHeaderSelectableRoles,
  getShellPolicy,
  inferPlatformRoleFromPath,
} from '@/lib/platform-v7/shell-role-policy';
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

  it.each([
    ['seller', '/platform-v7/seller', COMMERCIAL_HEADER_ROLES],
    ['buyer', '/platform-v7/buyer', COMMERCIAL_HEADER_ROLES],
    ['logistics', '/platform-v7/logistics', COMMERCIAL_HEADER_ROLES],
    ['bank', '/platform-v7/bank', CONTROL_HEADER_ROLES],
    ['arbitrator', '/platform-v7/arbitrator', CONTROL_HEADER_ROLES],
    ['compliance', '/platform-v7/compliance', CONTROL_HEADER_ROLES],
    ['operator', '/platform-v7/control-tower', OPERATOR_HEADER_ROLES],
    ['executive', '/platform-v7/executive', OPERATOR_HEADER_ROLES],
  ] as Array<[PlatformRole, string, readonly PlatformRole[]]>)('allows one portal role switcher on non-field %s route', (role, path, expectedRoles) => {
    expect(canShowPortalRoleSwitcher(role, path)).toBe(true);
    expect(getHeaderSelectableRoles(role, path)).toEqual(expectedRoles);
  });

  it.each([
    ['driver', '/platform-v7/driver/field'],
    ['surveyor', '/platform-v7/surveyor'],
    ['elevator', '/platform-v7/elevator'],
    ['lab', '/platform-v7/lab'],
  ] as Array<[PlatformRole, string]>)('keeps %s field header isolated from portal role switcher', (role, path) => {
    expect(canShowPortalRoleSwitcher(role, path)).toBe(false);
  });

  it.each([
    ['/platform-v7/seller', 'seller'],
    ['/platform-v7/buyer', 'buyer'],
    ['/platform-v7/logistics', 'logistics'],
    ['/platform-v7/bank', 'bank'],
    ['/platform-v7/arbitrator', 'arbitrator'],
    ['/platform-v7/compliance', 'compliance'],
    ['/platform-v7/driver/field', 'driver'],
    ['/platform-v7/executive', 'executive'],
    ['/platform-v7/control-tower', 'operator'],
  ] as Array<[string, PlatformRole]>)('infers %s from route %s', (path, role) => {
    expect(inferPlatformRoleFromPath(path, 'operator')).toBe(role);
  });

  it.each([
    ['/platform-v7/seller', 'seller'],
    ['/platform-v7/buyer', 'buyer'],
    ['/platform-v7/logistics', 'logistics'],
    ['/platform-v7/bank', 'bank'],
    ['/platform-v7/arbitrator', 'arbitrator'],
    ['/platform-v7/compliance', 'compliance'],
    ['/platform-v7/driver/field', 'driver'],
    ['/platform-v7/elevator', 'elevator'],
    ['/platform-v7/lab', 'lab'],
    ['/platform-v7/surveyor', 'surveyor'],
  ] as Array<[string, PlatformRole]>)('route %s overrides stale persisted roles with %s', (path, expectedRole) => {
    for (const staleRole of ['operator', 'executive', 'seller', 'buyer', 'bank', 'driver'] as PlatformRole[]) {
      expect(inferPlatformRoleFromPath(path, staleRole)).toBe(expectedRole);
    }
  });

  it.each([
    ['/platform-v7/driver/field'],
    ['/platform-v7/elevator'],
    ['/platform-v7/lab'],
    ['/platform-v7/surveyor'],
  ] as Array<[string]>)('keeps field route %s isolated from stale role header options', (path) => {
    for (const staleRole of ['operator', 'executive', 'seller', 'buyer', 'bank', 'logistics'] as PlatformRole[]) {
      expect(getHeaderSelectableRoles(staleRole, path)).toEqual([]);
      expect(canShowPortalRoleSwitcher(staleRole, path)).toBe(false);
    }
  });

  it.each([
    ['/platform-v7/seller', COMMERCIAL_HEADER_ROLES],
    ['/platform-v7/buyer', COMMERCIAL_HEADER_ROLES],
    ['/platform-v7/logistics', COMMERCIAL_HEADER_ROLES],
    ['/platform-v7/bank', CONTROL_HEADER_ROLES],
    ['/platform-v7/arbitrator', CONTROL_HEADER_ROLES],
    ['/platform-v7/compliance', CONTROL_HEADER_ROLES],
    ['/platform-v7/control-tower', OPERATOR_HEADER_ROLES],
    ['/platform-v7/executive', OPERATOR_HEADER_ROLES],
  ] as Array<[string, readonly PlatformRole[]]>)('uses the route-scoped header role set on non-field route %s', (path, expectedRoles) => {
    expect(getHeaderSelectableRoles('operator', path)).toEqual(expectedRoles);
  });

  it.each([
    ['driver', '/platform-v7/driver/field'],
    ['surveyor', '/platform-v7/surveyor'],
    ['elevator', '/platform-v7/elevator'],
    ['lab', '/platform-v7/lab'],
  ] as Array<[PlatformRole, string]>)('does not expose switch options for %s field shell', (role, path) => {
    expect(getHeaderSelectableRoles(role, path)).toEqual([]);
  });
});
