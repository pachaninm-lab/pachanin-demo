import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_NAV_BY_ROLE,
  platformV7NavItems,
  platformV7RoleLabel,
  platformV7RoleRoute,
  platformV7RoleStage,
} from '@/lib/platform-v7/navigation';

describe('platform-v7 navigation', () => {
  it('keeps control tower label in Russian for operator and executive navigation', () => {
    expect(platformV7NavItems('operator')[0]?.label).toBe('Центр управления');
    expect(platformV7NavItems('executive')[1]?.label).toBe('Центр управления');
  });

  it('keeps role labels and routes centralized', () => {
    expect(platformV7RoleLabel('seller')).toBe('Продавец');
    expect(platformV7RoleRoute('seller')).toBe('/platform-v7/seller');
    expect(platformV7RoleLabel('bank')).toBe('Банк');
    expect(platformV7RoleRoute('bank')).toBe('/platform-v7/bank');
  });

  it('uses unified environment stage labels', () => {
    expect(platformV7RoleStage('operator')).toEqual({ label: 'Пилотный режим', tone: 'pilot' });
    expect(platformV7RoleStage('driver')).toEqual({ label: 'Полевой режим', tone: 'field' });
    expect(platformV7RoleStage('bank')).toEqual({ label: 'События банка', tone: 'demo' });
  });

  it('provides navigation for every platform role', () => {
    const roles = Object.keys(PLATFORM_V7_NAV_BY_ROLE);
    expect(roles.length).toBe(12);
    roles.forEach((role) => {
      expect(PLATFORM_V7_NAV_BY_ROLE[role as keyof typeof PLATFORM_V7_NAV_BY_ROLE].length).toBeGreaterThan(0);
    });
  });
});
