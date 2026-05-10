import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleOpenRoute,
  getPlatformV7RoleHomeRoute,
} from '@/lib/platform-v7/role-access';

describe('platform-v7 route access boundary', () => {
  it('keeps driver out of bank, control and counterparty routes', () => {
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/bank')).toEqual({
      allowed: false,
      reason: 'Маршрут закрыт для роли. Откройте рабочий экран: /platform-v7/driver/field',
    });
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/control-tower/deals')).toEqual({
      allowed: false,
      reason: 'Маршрут закрыт для роли. Откройте рабочий экран: /platform-v7/driver/field',
    });
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/buyer/rfq/new').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', getPlatformV7RoleHomeRoute('driver')).allowed).toBe(true);
  });

  it('keeps investor out of field and control routes while allowing investor home', () => {
    expect(canPlatformV7RoleOpenRoute('investor', '/platform-v7/driver/field')).toEqual({
      allowed: false,
      reason: 'Маршрут закрыт для роли. Откройте рабочий экран: /platform-v7/investor',
    });
    expect(canPlatformV7RoleOpenRoute('investor', '/platform-v7/control-tower')).toEqual({
      allowed: false,
      reason: 'Маршрут закрыт для роли. Откройте рабочий экран: /platform-v7/investor',
    });
    expect(canPlatformV7RoleOpenRoute('investor', '/platform-v7/control-tower/deals').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('investor', getPlatformV7RoleHomeRoute('investor')).allowed).toBe(true);
  });

  it('keeps operator unrestricted across operational routes', () => {
    expect(canPlatformV7RoleOpenRoute('operator', '/platform-v7/control-tower').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('operator', '/platform-v7/bank').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('operator', '/platform-v7/driver/field').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('operator', '/platform-v7/connectors').allowed).toBe(true);
  });
});
