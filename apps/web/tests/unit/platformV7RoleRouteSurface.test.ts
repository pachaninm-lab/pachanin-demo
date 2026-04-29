import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ROLE_ROUTES, platformV7RoleRoute, platformV7ShellRouteSurface } from '@/lib/platform-v7/shellRoutes';

describe('platform-v7 role route surface', () => {
  it('keeps every role landing route inside the shell route surface', () => {
    const surface = new Set<string>(platformV7ShellRouteSurface());

    for (const role of Object.keys(PLATFORM_V7_ROLE_ROUTES) as Array<keyof typeof PLATFORM_V7_ROLE_ROUTES>) {
      const route = platformV7RoleRoute(role);

      expect(surface.has(route)).toBe(true);
      expect(route.includes('/platform-v4')).toBe(false);
      expect(route.includes('/platform-v9')).toBe(false);
    }
  });
});
