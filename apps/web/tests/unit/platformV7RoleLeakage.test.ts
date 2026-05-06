import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES,
  PLATFORM_V7_ROLE_FORBIDDEN_SURFACES,
  canPlatformV7RoleOpenRoute,
  getPlatformV7RoleHomeRoute,
  isPlatformV7SurfaceForbiddenForRole,
  type PlatformV7Role,
} from '@/lib/platform-v7/role-access';

const roles: PlatformV7Role[] = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'operator',
  'arbitrator',
  'compliance',
  'investor',
  'executive',
];

describe('platform-v7 role leakage matrix', () => {
  it('defines a forbidden surface set for every platform role', () => {
    expect(Object.keys(PLATFORM_V7_ROLE_FORBIDDEN_SURFACES).sort()).toEqual([...roles].sort());
  });

  it('defines route policy for every platform role', () => {
    expect(Object.keys(PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES).sort()).toEqual([...roles].sort());

    for (const role of roles) {
      expect(getPlatformV7RoleHomeRoute(role)).toMatch(/^\/platform-v7/);
    }
  });

  it('keeps role switch route operator-only', () => {
    for (const role of roles.filter((role) => role !== 'operator')) {
      expect(isPlatformV7SurfaceForbiddenForRole(role, 'roleSwitcher')).toBe(true);
      expect(canPlatformV7RoleOpenRoute(role, '/platform-v7/roles').allowed).toBe(false);
    }

    expect(canPlatformV7RoleOpenRoute('operator', '/platform-v7/roles')).toEqual({ allowed: true, reason: 'Маршрут доступен для роли.' });
  });

  it('keeps driver isolated from money, trading and operator surfaces', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'bankReserve')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'moneyRelease')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'thirdPartyBids')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'investorMode')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'controlTower')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'roleSwitcher')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'providerDebug')).toBe(true);
  });

  it('keeps driver route policy focused on field work', () => {
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/driver/field')).toEqual({ allowed: true, reason: 'Маршрут доступен для роли.' });
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/bank').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/control-tower').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/investor').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/connectors').allowed).toBe(false);
  });

  it('keeps logistics away from grain trading price, banking reserve and provider registry', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('logistics', 'grainPrice')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('logistics', 'bankReserve')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('logistics', 'thirdPartyBids')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('logistics', 'providerDebug')).toBe(true);
    expect(canPlatformV7RoleOpenRoute('logistics', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('logistics', '/platform-v7/bank').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('logistics', '/platform-v7/connectors').allowed).toBe(false);
  });

  it('keeps buyer and seller away from private/internal surfaces', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('buyer', 'thirdPartyBids')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('buyer', 'operatorControls')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('buyer', 'bankInternalEvents')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('buyer', 'providerDebug')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('seller', 'bankInternalEvents')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('seller', 'providerDebug')).toBe(true);
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('seller', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/control-tower').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/connectors').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('seller', '/platform-v7/connectors').allowed).toBe(false);
  });

  it('keeps provider integration registry internal to operator surfaces', () => {
    for (const role of roles.filter((role) => role !== 'operator')) {
      expect(isPlatformV7SurfaceForbiddenForRole(role, 'providerDebug')).toBe(true);
      expect(canPlatformV7RoleOpenRoute(role, '/platform-v7/connectors').allowed).toBe(false);
    }

    expect(canPlatformV7RoleOpenRoute('operator', '/platform-v7/connectors')).toEqual({ allowed: true, reason: 'Маршрут доступен для роли.' });
  });

  it('keeps operator as the only unrestricted fast-pass role at UI matrix level', () => {
    expect(PLATFORM_V7_ROLE_FORBIDDEN_SURFACES.operator).toEqual([]);
    expect(PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES.operator).toEqual([]);
  });
});
