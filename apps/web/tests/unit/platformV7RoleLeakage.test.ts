import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ROLE_FORBIDDEN_SURFACES,
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

  it('keeps driver isolated from money, trading and operator surfaces', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'bankReserve')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'moneyRelease')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'thirdPartyBids')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'investorMode')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'controlTower')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'roleSwitcher')).toBe(true);
  });

  it('keeps logistics away from grain trading price and banking reserve', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('logistics', 'grainPrice')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('logistics', 'bankReserve')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('logistics', 'thirdPartyBids')).toBe(true);
  });

  it('keeps buyer and seller away from private/internal surfaces', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('buyer', 'thirdPartyBids')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('buyer', 'operatorControls')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('buyer', 'bankInternalEvents')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('seller', 'bankInternalEvents')).toBe(true);
  });

  it('keeps operator as the only unrestricted fast-pass role at UI matrix level', () => {
    expect(PLATFORM_V7_ROLE_FORBIDDEN_SURFACES.operator).toEqual([]);
  });
});
