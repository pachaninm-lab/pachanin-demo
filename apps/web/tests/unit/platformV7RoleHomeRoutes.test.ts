import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleOpenRoute,
  PLATFORM_V7_ROLE_HOME_ROUTE,
  type PlatformV7Role,
} from '@/lib/platform-v7/role-access';

const roleHomeRoutes = Object.entries(PLATFORM_V7_ROLE_HOME_ROUTE) as [PlatformV7Role, string][];

describe('platform-v7 role home routes', () => {
  it('keeps every role home route inside the platform-v7 route tree', () => {
    for (const [, route] of roleHomeRoutes) {
      expect(route).toMatch(/^\/platform-v7(\/|$)/);
    }
  });

  it('lets every role open its own home route', () => {
    for (const [role, route] of roleHomeRoutes) {
      expect(canPlatformV7RoleOpenRoute(role, route)).toEqual({
        allowed: true,
        reason: 'Маршрут доступен для роли.',
      });
    }
  });
});
