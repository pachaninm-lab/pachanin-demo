import { describe, expect, it } from 'vitest';
import { canShowPortalRoleSwitcher, getHeaderSelectableRoles } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const COMMERCIAL_PATHS = ['/platform-v7/seller', '/platform-v7/buyer', '/platform-v7/logistics'] as const;
const CONTROL_PATHS = ['/platform-v7/bank', '/platform-v7/arbitrator', '/platform-v7/compliance'] as const;
const STALE_ROLES: PlatformRole[] = ['operator', 'executive', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance', 'driver', 'surveyor'];

describe('compact header stale role policy', () => {
  it('uses the commercial route scope even when the stored role is stale', () => {
    for (const path of COMMERCIAL_PATHS) {
      for (const staleRole of STALE_ROLES) {
        expect(getHeaderSelectableRoles(staleRole, path)).toEqual(['seller', 'buyer', 'logistics']);
        expect(canShowPortalRoleSwitcher(staleRole, path)).toBe(true);
      }
    }
  });

  it('uses the control route scope even when the stored role is stale', () => {
    for (const path of CONTROL_PATHS) {
      for (const staleRole of STALE_ROLES) {
        expect(getHeaderSelectableRoles(staleRole, path)).toEqual(['bank', 'arbitrator', 'compliance']);
        expect(canShowPortalRoleSwitcher(staleRole, path)).toBe(true);
      }
    }
  });
});
