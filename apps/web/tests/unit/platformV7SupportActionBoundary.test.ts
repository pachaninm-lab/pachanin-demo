import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleInvokeAction } from '@/lib/platform-v7/action-permission-boundary';
import type { PlatformV7Role } from '@/lib/platform-v7/role-access';

const SUPPORT_PARTICIPANT_ROLES = [
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
] as const satisfies readonly PlatformV7Role[];

const OBSERVER_ROLES = ['investor', 'executive'] as const satisfies readonly PlatformV7Role[];

describe('platform-v7 support action boundary', () => {
  it.each(SUPPORT_PARTICIPANT_ROLES)('allows %s to create and update support cases', (role) => {
    expect(canPlatformV7RoleInvokeAction(role, 'support.create_case').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction(role, 'support.append_message').allowed).toBe(true);
  });

  it.each(OBSERVER_ROLES)('keeps %s outside support case actions', (role) => {
    expect(canPlatformV7RoleInvokeAction(role, 'support.create_case')).toEqual({
      allowed: false,
      reason: 'Действие закрыто для роли.',
    });
    expect(canPlatformV7RoleInvokeAction(role, 'support.append_message')).toEqual({
      allowed: false,
      reason: 'Действие закрыто для роли.',
    });
  });
});
