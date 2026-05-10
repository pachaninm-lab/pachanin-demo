import { describe, expect, it } from 'vitest';
import {
  isPlatformV7SurfaceForbiddenForRole,
  PLATFORM_V7_ROLE_FORBIDDEN_SURFACES,
  type PlatformV7Role,
} from '@/lib/platform-v7/role-access';

const roles = Object.keys(PLATFORM_V7_ROLE_FORBIDDEN_SURFACES) as PlatformV7Role[];

describe('platform-v7 role surface access', () => {
  it('keeps forbidden surfaces unique and normalized per role', () => {
    for (const role of roles) {
      const surfaces = PLATFORM_V7_ROLE_FORBIDDEN_SURFACES[role];

      expect(new Set(surfaces).size, role).toBe(surfaces.length);

      for (const surface of surfaces) {
        expect(surface.trim(), role).toBe(surface);
        expect(surface.includes(' '), role).toBe(false);
      }
    }
  });

  it('keeps forbidden surface decisions aligned with role policy tables', () => {
    for (const role of roles) {
      for (const surface of PLATFORM_V7_ROLE_FORBIDDEN_SURFACES[role]) {
        expect(isPlatformV7SurfaceForbiddenForRole(role, surface), `${role}:${surface}`).toBe(true);
      }
    }
  });
});
