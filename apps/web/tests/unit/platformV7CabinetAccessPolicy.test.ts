import { describe, expect, it } from 'vitest';
import {
  canRoleAccessCabinet,
  cabinetAccessDecision,
  platformV7RbacEnforced,
} from '@/lib/platform-v7/cabinet-access-policy';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

describe('cabinet access policy (cabinet-level RBAC)', () => {
  it('is strict by default in the controlled-pilot shell', () => {
    expect(platformV7RbacEnforced()).toBe(true);
  });

  it('restricts participant roles to their own registry-approved cabinet routes', () => {
    expect(canRoleAccessCabinet('buyer', '/platform-v7/buyer')).toBe(true);
    expect(canRoleAccessCabinet('buyer', '/platform-v7/procurement')).toBe(true);
    expect(canRoleAccessCabinet('buyer', '/platform-v7/bank')).toBe(false);
    expect(canRoleAccessCabinet('seller', '/platform-v7/seller')).toBe(true);
    expect(canRoleAccessCabinet('seller', '/platform-v7/buyer')).toBe(false);
    expect(canRoleAccessCabinet('driver', '/platform-v7/driver/field')).toBe(true);
    expect(canRoleAccessCabinet('driver', '/platform-v7/bank/clean')).toBe(false);
    expect(canRoleAccessCabinet('bank', '/platform-v7/bank/clean')).toBe(true);
    expect(canRoleAccessCabinet('bank', '/platform-v7/bank/factoring')).toBe(true);
    expect(canRoleAccessCabinet('bank', '/platform-v7/driver/field')).toBe(false);
  });

  it('redirects foreign cabinet attempts back to the active role home route', () => {
    expect(cabinetAccessDecision('buyer', '/platform-v7/bank').redirectTo).toBe('/platform-v7/buyer');
    expect(cabinetAccessDecision('seller', '/platform-v7/buyer').redirectTo).toBe('/platform-v7/seller');
    expect(cabinetAccessDecision('bank', '/platform-v7/driver/field').redirectTo).toBe('/platform-v7/bank/clean');
    expect(cabinetAccessDecision('driver', '/platform-v7/bank').redirectTo).toBe('/platform-v7/driver/field');
  });

  it('keeps role-neutral shell routes inside platform-v7 without treating them as cabinet switches', () => {
    expect(canRoleAccessCabinet('buyer', '/platform-v7/ai')).toBe(true);
    expect(canRoleAccessCabinet('seller', '/platform-v7/ai')).toBe(true);
    expect(canRoleAccessCabinet('driver', '/platform-v7/ai')).toBe(true);
    expect(canRoleAccessCabinet('bank', '/platform-v7/ai')).toBe(true);
  });

  it('lets oversight roles inspect controlled-pilot work surfaces', () => {
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

  it('allows public entry routes but does not allow role migration screen inside protected shell', () => {
    expect(canRoleAccessCabinet('driver', '/platform-v7')).toBe(true);
    expect(canRoleAccessCabinet('lab', '/platform-v7/roles')).toBe(false);
    expect(canRoleAccessCabinet('buyer', '/platform-v7/login')).toBe(true);
    expect(canRoleAccessCabinet('seller', '/platform-v7/register')).toBe(true);
  });
});
