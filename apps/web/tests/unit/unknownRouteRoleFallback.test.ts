import { describe, expect, it } from 'vitest';
import { inferPlatformRoleFromPath } from '@/lib/platform-v7/shell-role-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const UNKNOWN_ROUTES = [
  '/platform-v7/unknown',
  '/platform-v7/settings',
  '/platform-v7/deals/DL-9106',
  '/platform-v7/support/case-1',
] as const;

const FALLBACK_ROLES: PlatformRole[] = ['operator', 'executive', 'seller', 'buyer', 'logistics', 'bank', 'arbitrator', 'compliance', 'driver', 'surveyor'];

describe('platform-v7 unknown route role fallback', () => {
  it.each(UNKNOWN_ROUTES)('keeps fallback role on unscoped route %s', (path) => {
    for (const fallbackRole of FALLBACK_ROLES) {
      expect(inferPlatformRoleFromPath(path, fallbackRole)).toBe(fallbackRole);
    }
  });
});
