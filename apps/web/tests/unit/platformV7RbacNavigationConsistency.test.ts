import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_NAV_BY_ROLE } from '@/lib/platform-v7/shellRoutes';
import { canRoleAccessCabinet } from '@/lib/platform-v7/cabinet-access-policy';

describe('platform-v7 RBAC/navigation consistency', () => {
  it('does not expose role navigation links that enforced RBAC would block', () => {
    const blocked = Object.entries(PLATFORM_V7_NAV_BY_ROLE).flatMap(([role, items]) =>
      items
        .filter((item) => !canRoleAccessCabinet(role as PlatformRole, item.href))
        .map((item) => `${role}: ${item.href}`),
    );

    expect(blocked).toEqual([]);
  });
});
