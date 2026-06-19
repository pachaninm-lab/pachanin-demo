import { describe, expect, it } from 'vitest';
import { canShowPortalRoleSwitcher, getHeaderSelectableRoles, OPERATOR_HEADER_ROLES } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const COMMERCIAL_PATHS = ['/platform-v7/seller', '/platform-v7/buyer', '/platform-v7/logistics'] as const;
const CONTROL_PATHS = ['/platform-v7/bank', '/platform-v7/arbitrator', '/platform-v7/compliance'] as const;
const FIELD_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'] as const;
const OPERATOR_PATHS = ['/platform-v7/control-tower', '/platform-v7/operator'] as const;
const STALE_ROLES: PlatformRole[] = ['operator', 'executive', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance', 'driver', 'surveyor'];

describe('compact header stale role policy', () => {
  // Strict role isolation: role-scoped (commercial/control) and field cabinets
  // never expose the operator role switcher, no matter what role is stored.
  it('hides the role switcher on commercial, control and field routes regardless of stored role', () => {
    for (const path of [...COMMERCIAL_PATHS, ...CONTROL_PATHS, ...FIELD_PATHS]) {
      for (const staleRole of STALE_ROLES) {
        expect(getHeaderSelectableRoles(staleRole, path)).toEqual([]);
        expect(canShowPortalRoleSwitcher(staleRole, path)).toBe(false);
      }
    }
  });

  it('keeps the unified switcher only inside operator/executive cabinets for operator/executive roles', () => {
    for (const path of OPERATOR_PATHS) {
      for (const role of ['operator', 'executive'] as PlatformRole[]) {
        expect(getHeaderSelectableRoles(role, path)).toEqual([...OPERATOR_HEADER_ROLES]);
        expect(canShowPortalRoleSwitcher(role, path)).toBe(true);
      }
      // A stale non-operator role does not unlock the switcher on operator routes.
      expect(getHeaderSelectableRoles('seller', path)).toEqual([]);
      expect(canShowPortalRoleSwitcher('seller', path)).toBe(false);
    }
  });
});
