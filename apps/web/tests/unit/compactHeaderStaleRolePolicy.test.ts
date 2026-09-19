import { describe, expect, it } from 'vitest';
import { canShowPortalRoleSwitcher, getHeaderSelectableRoles } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

// Header shell controls are driven by the *path scope*, never by a stale stored
// role. On role-scoped commercial/control routes and on field routes the portal
// role switcher stays hidden regardless of whatever role happens to be cached in
// the store. This matches the canonical policy locked by shellRolePolicy.test.ts.
const COMMERCIAL_PATHS = ['/platform-v7/seller', '/platform-v7/buyer', '/platform-v7/logistics'] as const;
const CONTROL_PATHS = ['/platform-v7/bank', '/platform-v7/arbitrator', '/platform-v7/compliance'] as const;
const FIELD_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'] as const;
const STALE_ROLES: PlatformRole[] = ['operator', 'executive', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance', 'driver', 'surveyor'];

describe('compact header stale role policy', () => {
  it('hides the portal role switcher on commercial and control routes regardless of a stale stored role', () => {
    for (const path of [...COMMERCIAL_PATHS, ...CONTROL_PATHS]) {
      for (const staleRole of STALE_ROLES) {
        expect(canShowPortalRoleSwitcher(staleRole, path)).toBe(false);
      }
    }
  });

  it('hides the switcher entirely on field routes regardless of stored role', () => {
    for (const path of FIELD_PATHS) {
      for (const staleRole of STALE_ROLES) {
        expect(getHeaderSelectableRoles(staleRole, path)).toEqual([]);
        expect(canShowPortalRoleSwitcher(staleRole, path)).toBe(false);
      }
    }
  });
});
