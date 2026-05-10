import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleOpenRoute,
  getPlatformV7RoleHomeRoute,
  type PlatformV7Role,
} from '@/lib/platform-v7/role-access';

const ROLES = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'operator',
  'arbitrator',
  'compliance',
  'investor',
  'executive',
] as const satisfies readonly PlatformV7Role[];

describe('platform-v7 role home route boundary', () => {
  it.each(ROLES)('allows %s to open its home route', (role) => {
    expect(canPlatformV7RoleOpenRoute(role, getPlatformV7RoleHomeRoute(role))).toEqual({
      allowed: true,
      reason: 'Маршрут доступен для роли.',
    });
  });

  it('keeps role home routes under platform-v7', () => {
    for (const role of ROLES) {
      expect(getPlatformV7RoleHomeRoute(role).startsWith('/platform-v7/')).toBe(true);
    }
  });
});
