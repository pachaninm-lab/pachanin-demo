import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleOpenRoute,
  PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES,
  PLATFORM_V7_ROLE_HOME_ROUTE,
  type PlatformV7Role,
} from '@/lib/platform-v7/role-access';

const roles = Object.keys(PLATFORM_V7_ROLE_HOME_ROUTE) as PlatformV7Role[];

describe('platform-v7 role access home routes', () => {
  it('keeps every role able to open its own home route', () => {
    for (const role of roles) {
      expect(canPlatformV7RoleOpenRoute(role, PLATFORM_V7_ROLE_HOME_ROUTE[role]).allowed).toBe(true);
    }
  });

  it('keeps blocked route prefixes normalized and outside role home routes', () => {
    for (const role of roles) {
      for (const prefix of PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES[role]) {
        expect(prefix, role).toMatch(/^\/platform-v7\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
        expect(prefix.endsWith('/'), role).toBe(false);
        expect(PLATFORM_V7_ROLE_HOME_ROUTE[role] === prefix, role).toBe(false);
        expect(PLATFORM_V7_ROLE_HOME_ROUTE[role].startsWith(`${prefix}/`), role).toBe(false);
      }
    }
  });
});
