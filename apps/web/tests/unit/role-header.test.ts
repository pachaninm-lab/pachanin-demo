import { describe, expect, it } from 'vitest';
import { getHeaderSelectableRoles, inferPlatformRoleFromPath } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const ROLE_HEADER_CASES: Array<{ path: string; expectedRole: PlatformRole; expectedOptions: readonly PlatformRole[] }> = [
  { path: '/platform-v7/seller', expectedRole: 'seller', expectedOptions: ['seller', 'buyer', 'logistics'] },
  { path: '/platform-v7/buyer', expectedRole: 'buyer', expectedOptions: ['seller', 'buyer', 'logistics'] },
  { path: '/platform-v7/logistics', expectedRole: 'logistics', expectedOptions: ['seller', 'buyer', 'logistics'] },
  { path: '/platform-v7/bank', expectedRole: 'bank', expectedOptions: ['bank', 'arbitrator', 'compliance'] },
  { path: '/platform-v7/arbitrator', expectedRole: 'arbitrator', expectedOptions: ['bank', 'arbitrator', 'compliance'] },
  { path: '/platform-v7/compliance', expectedRole: 'compliance', expectedOptions: ['bank', 'arbitrator', 'compliance'] },
  { path: '/platform-v7/control-tower', expectedRole: 'operator', expectedOptions: ['operator', 'executive', 'seller', 'buyer', 'logistics', 'driver', 'bank', 'arbitrator', 'compliance'] },
];

describe('role-header', () => {
  it('uses the current route role instead of a stale operator role', () => {
    for (const item of ROLE_HEADER_CASES) {
      expect(inferPlatformRoleFromPath(item.path, 'operator')).toBe(item.expectedRole);
    }
  });

  it('does not expose operator switch option inside role-scoped cabinets', () => {
    for (const item of ROLE_HEADER_CASES.filter((entry) => entry.expectedRole !== 'operator')) {
      expect(getHeaderSelectableRoles('operator', item.path)).toEqual(item.expectedOptions);
      expect(getHeaderSelectableRoles('operator', item.path)).not.toContain('operator');
    }
  });

  it('keeps driver and field-role headers isolated from role switching', () => {
    for (const path of ['/platform-v7/driver/field', '/platform-v7/elevator', '/platform-v7/lab', '/platform-v7/surveyor']) {
      expect(getHeaderSelectableRoles('operator', path)).toEqual([]);
    }
  });
});
