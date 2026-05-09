import { describe, expect, it } from 'vitest';
import { isPlatformV7SurfaceForbiddenForRole } from '@/lib/platform-v7/role-access';

describe('platform-v7 surface rules', () => {
  it('keeps driver away from bank, investor, control, and provider surfaces', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'bankReserve')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'moneyRelease')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'investorMode')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'controlTower')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('driver', 'providerDebug')).toBe(true);
  });

  it('keeps investor away from operational and internal surfaces', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('investor', 'driverActions')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('investor', 'bankInternalEvents')).toBe(true);
    expect(isPlatformV7SurfaceForbiddenForRole('investor', 'operatorControls')).toBe(true);
  });

  it('leaves operator unrestricted at the surface policy layer', () => {
    expect(isPlatformV7SurfaceForbiddenForRole('operator', 'bankReserve')).toBe(false);
    expect(isPlatformV7SurfaceForbiddenForRole('operator', 'operatorControls')).toBe(false);
    expect(isPlatformV7SurfaceForbiddenForRole('operator', 'providerDebug')).toBe(false);
  });
});
