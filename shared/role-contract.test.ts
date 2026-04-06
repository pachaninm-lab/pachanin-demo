import { describe, it, expect } from 'vitest';
import { toSurfaceRole, isPrivilegedSurfaceRole, roleMatches, SURFACE_ROLE_KEYS } from './role-contract';

describe('toSurfaceRole', () => {
  it('returns GUEST for empty string', () => {
    expect(toSurfaceRole('')).toBe('GUEST');
  });

  it('returns GUEST for null', () => {
    expect(toSurfaceRole(null)).toBe('GUEST');
  });

  it('returns GUEST for undefined', () => {
    expect(toSurfaceRole(undefined)).toBe('GUEST');
  });

  it('returns exact match for canonical key (uppercase)', () => {
    expect(toSurfaceRole('FARMER')).toBe('FARMER');
    expect(toSurfaceRole('ADMIN')).toBe('ADMIN');
    expect(toSurfaceRole('DRIVER')).toBe('DRIVER');
  });

  it('resolves lowercase alias to canonical key', () => {
    expect(toSurfaceRole('farmer')).toBe('FARMER');
    expect(toSurfaceRole('seller')).toBe('FARMER');
    expect(toSurfaceRole('buyer')).toBe('BUYER');
    expect(toSurfaceRole('logistics')).toBe('LOGISTICIAN');
    expect(toSurfaceRole('logistician')).toBe('LOGISTICIAN');
    expect(toSurfaceRole('driver')).toBe('DRIVER');
    expect(toSurfaceRole('lab')).toBe('LAB');
    expect(toSurfaceRole('laboratory')).toBe('LAB');
    expect(toSurfaceRole('elevator')).toBe('ELEVATOR');
    expect(toSurfaceRole('receiving')).toBe('ELEVATOR');
    expect(toSurfaceRole('accounting')).toBe('ACCOUNTING');
    expect(toSurfaceRole('finance')).toBe('ACCOUNTING');
    expect(toSurfaceRole('executive')).toBe('EXECUTIVE');
    expect(toSurfaceRole('support_manager')).toBe('SUPPORT_MANAGER');
    expect(toSurfaceRole('operator')).toBe('SUPPORT_MANAGER');
    expect(toSurfaceRole('ops')).toBe('SUPPORT_MANAGER');
    expect(toSurfaceRole('admin')).toBe('ADMIN');
  });

  it('returns GUEST for unknown alias', () => {
    expect(toSurfaceRole('unknown_role')).toBe('GUEST');
    expect(toSurfaceRole('superadmin')).toBe('GUEST');
  });

  it('trims whitespace before matching', () => {
    expect(toSurfaceRole('  FARMER  ')).toBe('FARMER');
    expect(toSurfaceRole('  farmer  ')).toBe('FARMER');
  });
});

describe('isPrivilegedSurfaceRole', () => {
  it('returns true for SUPPORT_MANAGER', () => {
    expect(isPrivilegedSurfaceRole('SUPPORT_MANAGER')).toBe(true);
    expect(isPrivilegedSurfaceRole('support_manager')).toBe(true);
    expect(isPrivilegedSurfaceRole('ops')).toBe(true);
  });

  it('returns true for ADMIN', () => {
    expect(isPrivilegedSurfaceRole('ADMIN')).toBe(true);
    expect(isPrivilegedSurfaceRole('admin')).toBe(true);
  });

  it('returns true for EXECUTIVE', () => {
    expect(isPrivilegedSurfaceRole('EXECUTIVE')).toBe(true);
    expect(isPrivilegedSurfaceRole('executive')).toBe(true);
  });

  it('returns false for non-privileged roles', () => {
    expect(isPrivilegedSurfaceRole('FARMER')).toBe(false);
    expect(isPrivilegedSurfaceRole('BUYER')).toBe(false);
    expect(isPrivilegedSurfaceRole('DRIVER')).toBe(false);
    expect(isPrivilegedSurfaceRole('LAB')).toBe(false);
    expect(isPrivilegedSurfaceRole('ELEVATOR')).toBe(false);
    expect(isPrivilegedSurfaceRole('ACCOUNTING')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isPrivilegedSurfaceRole(null)).toBe(false);
    expect(isPrivilegedSurfaceRole(undefined)).toBe(false);
  });
});

describe('roleMatches', () => {
  it('returns true when role is in allowedRoles (canonical)', () => {
    expect(roleMatches('FARMER', ['FARMER', 'BUYER'])).toBe(true);
    expect(roleMatches('ADMIN', ['ADMIN'])).toBe(true);
  });

  it('resolves aliases before matching', () => {
    expect(roleMatches('seller', ['FARMER'])).toBe(true);
    expect(roleMatches('ops', ['SUPPORT_MANAGER', 'ADMIN'])).toBe(true);
  });

  it('resolves allowedRoles aliases too', () => {
    expect(roleMatches('FARMER', ['seller', 'buyer'])).toBe(true);
  });

  it('returns false when role not in allowedRoles', () => {
    expect(roleMatches('DRIVER', ['FARMER', 'BUYER'])).toBe(false);
    expect(roleMatches('GUEST', ['ADMIN'])).toBe(false);
  });

  it('returns true for null role resolving to GUEST when GUEST is allowed', () => {
    // null → toSurfaceRole → 'GUEST'; GUEST is in the list → true
    expect(roleMatches(null, ['GUEST', 'FARMER'])).toBe(true);
  });

  it('returns false for null role when GUEST is not in allowedRoles', () => {
    // null → GUEST; GUEST not in list → false
    expect(roleMatches(null, ['FARMER', 'BUYER'])).toBe(false);
  });

  it('returns false for empty allowedRoles', () => {
    expect(roleMatches('ADMIN', [])).toBe(false);
  });
});

describe('SURFACE_ROLE_KEYS', () => {
  it('contains all expected roles', () => {
    const expected = ['GUEST', 'FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'];
    expect([...SURFACE_ROLE_KEYS]).toEqual(expected);
  });
});
