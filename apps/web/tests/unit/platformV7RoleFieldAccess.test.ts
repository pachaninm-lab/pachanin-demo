import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleSeeField,
  getPlatformV7VisibleFields,
  PLATFORM_V7_ROLE_FORBIDDEN_FIELDS,
  type PlatformV7Role,
  type PlatformV7SensitiveField,
} from '@/lib/platform-v7/role-access';

const roles = Object.keys(PLATFORM_V7_ROLE_FORBIDDEN_FIELDS) as PlatformV7Role[];
const fields = Array.from(
  new Set(Object.values(PLATFORM_V7_ROLE_FORBIDDEN_FIELDS).flat()),
) as PlatformV7SensitiveField[];

describe('platform-v7 role field access', () => {
  it('denies forbidden fields with an explicit reason', () => {
    for (const role of roles) {
      for (const field of PLATFORM_V7_ROLE_FORBIDDEN_FIELDS[role]) {
        expect(canPlatformV7RoleSeeField(role, field), `${role}:${field}`).toEqual({
          allowed: false,
          reason: 'Поле закрыто для роли до наступления допустимого этапа сделки.',
        });
      }
    }
  });

  it('keeps visible fields aligned with forbidden field decisions', () => {
    for (const role of roles) {
      const visibleFields = getPlatformV7VisibleFields(role, fields);

      for (const field of fields) {
        expect(visibleFields.includes(field), `${role}:${field}`).toBe(
          canPlatformV7RoleSeeField(role, field).allowed,
        );
      }
    }
  });
});
