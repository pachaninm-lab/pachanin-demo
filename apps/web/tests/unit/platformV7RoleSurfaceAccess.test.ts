import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleOpenRoute,
  canPlatformV7RoleSeeField,
  getPlatformV7VisibleFields,
  isPlatformV7FieldForbiddenForRole,
  isPlatformV7SurfaceForbiddenForRole,
  PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES,
  PLATFORM_V7_ROLE_FORBIDDEN_FIELDS,
  PLATFORM_V7_ROLE_FORBIDDEN_SURFACES,
  PLATFORM_V7_ROLE_HOME_ROUTE,
  type PlatformV7Role,
  type PlatformV7SensitiveField,
} from '@/lib/platform-v7/role-access';

const roles = Object.keys(PLATFORM_V7_ROLE_FORBIDDEN_SURFACES) as PlatformV7Role[];
const sensitiveFields = Array.from(
  new Set(Object.values(PLATFORM_V7_ROLE_FORBIDDEN_FIELDS).flat()),
) as PlatformV7SensitiveField[];

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

  it('keeps forbidden fields unique and normalized per role', () => {
    for (const role of roles) {
      const fields = PLATFORM_V7_ROLE_FORBIDDEN_FIELDS[role];

      expect(new Set(fields).size, role).toBe(fields.length);

      for (const field of fields) {
        expect(field.trim(), role).toBe(field);
        expect(field.includes(' '), role).toBe(false);
      }
    }
  });

  it('keeps field access decisions aligned with role policy tables', () => {
    for (const role of roles) {
      for (const field of PLATFORM_V7_ROLE_FORBIDDEN_FIELDS[role]) {
        expect(isPlatformV7FieldForbiddenForRole(role, field), `${role}:${field}`).toBe(true);
        expect(canPlatformV7RoleSeeField(role, field).allowed, `${role}:${field}`).toBe(false);
      }
    }
  });

  it('keeps visible field selection from leaking forbidden fields', () => {
    for (const role of roles) {
      const visibleFields = getPlatformV7VisibleFields(role, sensitiveFields);

      for (const field of PLATFORM_V7_ROLE_FORBIDDEN_FIELDS[role]) {
        expect(visibleFields, `${role}:${field}`).not.toContain(field);
      }

      for (const field of visibleFields) {
        expect(isPlatformV7FieldForbiddenForRole(role, field), `${role}:${field}`).toBe(false);
      }
    }
  });

  it('keeps blocked route decisions aligned with role policy tables', () => {
    for (const role of roles) {
      for (const prefix of PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES[role]) {
        const directDecision = canPlatformV7RoleOpenRoute(role, prefix);
        const nestedDecision = canPlatformV7RoleOpenRoute(role, `${prefix}/details`);

        expect(directDecision.allowed, `${role}:${prefix}`).toBe(false);
        expect(nestedDecision.allowed, `${role}:${prefix}/details`).toBe(false);
        expect(directDecision.reason, `${role}:${prefix}`).toContain(PLATFORM_V7_ROLE_HOME_ROUTE[role]);
      }
    }
  });

  it('keeps each role home route open for that role', () => {
    for (const role of roles) {
      const decision = canPlatformV7RoleOpenRoute(role, PLATFORM_V7_ROLE_HOME_ROUTE[role]);

      expect(decision.allowed, `${role}:${PLATFORM_V7_ROLE_HOME_ROUTE[role]}`).toBe(true);
    }
  });
});
