import { describe, expect, it } from 'vitest';
import { inferPlatformRoleFromPath } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const STALE_ROLES: PlatformRole[] = ['operator', 'executive', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance', 'driver', 'surveyor'];

const ALIAS_ROUTES: Array<[string, PlatformRole]> = [
  ['/platform-v7/lots', 'seller'],
  ['/platform-v7/procurement', 'buyer'],
  ['/platform-v7/connectors', 'compliance'],
  ['/platform-v7/disputes', 'arbitrator'],
  ['/platform-v7/operator', 'operator'],
  ['/platform-v7/analytics', 'executive'],
];

describe('platform-v7 route alias role inference', () => {
  it.each(ALIAS_ROUTES)('infers %s as %s regardless of stale stored role', (path, expectedRole) => {
    for (const staleRole of STALE_ROLES) {
      expect(inferPlatformRoleFromPath(path, staleRole)).toBe(expectedRole);
    }
  });
});
