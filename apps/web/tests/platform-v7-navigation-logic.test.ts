import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_ROLE_ROUTES as SHELL_ROLE_ROUTES } from '@/lib/platform-v7/shellRoutes';
import { PLATFORM_V7_ROLE_ROUTES as LEGACY_ROLE_ROUTES } from '@/lib/platform-v7/navigation';

const roles: PlatformRole[] = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

describe('platform-v7 navigation logic', () => {
  it('keeps legacy role routes aligned with shell role routes', () => {
    for (const role of roles) {
      expect(LEGACY_ROLE_ROUTES[role], `${role} role route must match shell route`).toBe(SHELL_ROLE_ROUTES[role]);
    }
  });
});
