import { describe, expect, it } from 'vitest';
import { canShowPortalRoleSwitcher, getHeaderSelectableRoles, OPERATOR_HEADER_ROLES } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const COMMERCIAL_PATHS = ['/platform-v7/seller', '/platform-v7/buyer', '/platform-v7/logistics'] as const;
const CONTROL_PATHS = ['/platform-v7/bank', '/platform-v7/arbitrator', '/platform-v7/compliance'] as const;
const FIELD_PATHS = ['/platform-v7/driver', '/platform-v7/surveyor', '/platform-v7/elevator', '/platform-v7/lab'] as const;
const STALE_ROLES: PlatformRole[] = ['operator', 'executive', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance', 'driver', 'surveyor'];

describe('compact header stale role policy', () => {
  it('keeps the unified switcher list on commercial and control routes even when the stored role is stale', () => {
    for (const path of [...COMMERCIAL_PATHS, ...CONTROL_PATHS]) {
      for (const staleRole of STALE_ROLES) {
        expect(getHeaderSelectableRoles(staleRole, path)).toEqual([...OPERATOR_HEADER_ROLES]);
        expect(canShowPortalRoleSwitcher(staleRole, path)).toBe(true);
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
