import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_RBAC_FLAG,
  canRoleAccessCabinet,
  cabinetAccessDecision,
  platformV7RbacEnforced,
} from '@/lib/platform-v7/cabinet-access-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const enforcedEnv = { [PLATFORM_V7_RBAC_FLAG]: 'enforced' } as unknown as NodeJS.ProcessEnv;
const pilotEnv = {} as unknown as NodeJS.ProcessEnv;

describe('cabinet access policy (cabinet-level RBAC)', () => {
  it('is not enforced by default (pilot открытый доступ), enforced by flag or production', () => {
    expect(platformV7RbacEnforced(pilotEnv)).toBe(false);
    expect(platformV7RbacEnforced(enforcedEnv)).toBe(true);
    expect(platformV7RbacEnforced({ NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT: 'production' } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it('in pilot (not enforced) every role may open every cabinet', () => {
    expect(cabinetAccessDecision('driver', '/platform-v7/bank', pilotEnv).allowed).toBe(true);
    expect(cabinetAccessDecision('buyer', '/platform-v7/compliance', pilotEnv).allowed).toBe(true);
  });

  it('restricts a participant role to its own cabinet when enforced', () => {
    expect(canRoleAccessCabinet('driver', '/platform-v7/driver/field')).toBe(true);
    expect(canRoleAccessCabinet('driver', '/platform-v7/bank')).toBe(false);
    expect(canRoleAccessCabinet('buyer', '/platform-v7/buyer')).toBe(true);
    expect(canRoleAccessCabinet('buyer', '/platform-v7/seller')).toBe(false);
    expect(canRoleAccessCabinet('bank', '/platform-v7/bank/release-safety')).toBe(true);
    expect(canRoleAccessCabinet('bank', '/platform-v7/elevator')).toBe(false);
  });

  it('lets oversight roles (operator, executive) reach every cabinet', () => {
    const everywhere: [PlatformRole, string][] = [
      ['operator', '/platform-v7/bank'],
      ['operator', '/platform-v7/compliance'],
      ['executive', '/platform-v7/logistics'],
      ['executive', '/platform-v7/lab'],
    ];
    for (const [role, path] of everywhere) {
      expect(canRoleAccessCabinet(role, path)).toBe(true);
    }
  });

  it('always allows entry and role-picker for any role', () => {
    expect(canRoleAccessCabinet('driver', '/platform-v7')).toBe(true);
    expect(canRoleAccessCabinet('lab', '/platform-v7/roles')).toBe(true);
  });

  it('redirects a foreign cabinet to the picker when enforced', () => {
    const decision = cabinetAccessDecision('driver', '/platform-v7/bank', enforcedEnv);
    expect(decision.allowed).toBe(false);
    expect(decision.redirectTo).toBe('/platform-v7');
  });
});
