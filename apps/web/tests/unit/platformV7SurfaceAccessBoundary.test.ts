import { describe, expect, it } from 'vitest';
import {
  isPlatformV7SurfaceForbiddenForRole,
  type PlatformV7SensitiveSurface,
} from '@/lib/platform-v7/role-access';

const SENSITIVE_SURFACES = [
  'bankReserve',
  'moneyRelease',
  'grainPrice',
  'thirdPartyBids',
  'operatorControls',
  'bankInternalEvents',
  'investorMode',
  'controlTower',
  'roleSwitcher',
  'driverActions',
  'providerDebug',
] as const satisfies readonly PlatformV7SensitiveSurface[];

describe('platform-v7 surface access boundary', () => {
  it('keeps driver away from money, market and oversight surfaces', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'bankReserve')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'moneyRelease')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'grainPrice')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'thirdPartyBids')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'investorMode')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'controlTower')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'roleSwitcher')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'providerDebug')).toBe(true);
  });

  it('keeps investor away from operational and sensitive internal surfaces', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('investor', 'driverActions')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('investor', 'bankInternalEvents')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('investor', 'operatorControls')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('investor', 'roleSwitcher')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('investor', 'providerDebug')).toBe(true);
  });

  it('keeps operator unrestricted across sensitive surfaces', () => {
    for (const surface of SENSITIVE_SURFACES) {
      expect(isPlatformV7SurfaceForbiddenForRole('operator', surface)).toBe(false);
    }
  });
});
