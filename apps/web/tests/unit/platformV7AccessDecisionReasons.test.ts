import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleOpenRoute } from '@/lib/platform-v7/role-access';

describe('platform-v7 access decision reasons', () => {
  it('points blocked driver route decisions back to driver work route', () => {
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/bank')).toEqual({
      allowed: false,
      reason: 'Маршрут закрыт для роли. Откройте рабочий экран: /platform-v7/driver/field',
    });
  });

  it('points blocked buyer route decisions back to buyer work route', () => {
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/control-tower')).toEqual({
      allowed: false,
      reason: 'Маршрут закрыт для роли. Откройте рабочий экран: /platform-v7/buyer',
    });
  });

  it('returns the standard reason for allowed routes', () => {
    expect(canPlatformV7RoleOpenRoute('seller', '/platform-v7/seller')).toEqual({
      allowed: true,
      reason: 'Маршрут доступен для роли.',
    });
  });
});
