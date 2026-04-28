import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { PLATFORM_V7_ROLE_LABELS, platformV7RoleLabel, platformV7RoleLabelEntries } from '@/lib/platform-v7/shellLabels';

const PLATFORM_ROLES: PlatformRole[] = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

describe('platform-v7 shell labels', () => {
  it('keeps a label for every platform role', () => {
    expect(Object.keys(PLATFORM_V7_ROLE_LABELS).sort()).toEqual([...PLATFORM_ROLES].sort());
  });

  it('keeps role labels in Russian', () => {
    expect(platformV7RoleLabel('operator')).toBe('Оператор');
    expect(platformV7RoleLabel('buyer')).toBe('Покупатель');
    expect(platformV7RoleLabel('seller')).toBe('Продавец');
    expect(platformV7RoleLabel('logistics')).toBe('Логист');
    expect(platformV7RoleLabel('driver')).toBe('Водитель');
    expect(platformV7RoleLabel('bank')).toBe('Банк');
    expect(platformV7RoleLabel('executive')).toBe('Руководитель');
  });

  it('returns typed entries for role selectors', () => {
    const entries = platformV7RoleLabelEntries();
    expect(entries).toHaveLength(PLATFORM_ROLES.length);
    expect(entries.every(([role, label]) => PLATFORM_ROLES.includes(role) && label.length > 0)).toBe(true);
  });
});
