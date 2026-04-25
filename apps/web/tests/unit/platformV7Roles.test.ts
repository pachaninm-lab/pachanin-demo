import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ROLES, platformV7IsRole, platformV7RoleOptions } from '@/lib/platform-v7/roles';

describe('platform-v7 roles', () => {
  it('keeps exactly 12 platform roles', () => {
    expect(PLATFORM_V7_ROLES.length).toBe(12);
  });

  it('builds role options from navigation source', () => {
    const options = platformV7RoleOptions();
    expect(options[0]).toEqual({
      role: 'operator',
      label: 'Оператор',
      route: '/platform-v7/control-tower',
      stageLabel: 'Пилотный режим',
      stageTone: 'pilot',
    });
    expect(options.find((item) => item.role === 'bank')).toMatchObject({
      label: 'Банк',
      route: '/platform-v7/bank',
      stageTone: 'demo',
    });
  });

  it('validates platform roles safely', () => {
    expect(platformV7IsRole('operator')).toBe(true);
    expect(platformV7IsRole('bank')).toBe(true);
    expect(platformV7IsRole('unknown')).toBe(false);
  });
});
