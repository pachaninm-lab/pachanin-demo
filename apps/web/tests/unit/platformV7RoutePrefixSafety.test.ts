import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleOpenRoute } from '@/lib/platform-v7/role-access';

describe('platform-v7 route prefix safety', () => {
  it('blocks exact restricted routes and their subroutes', () => {
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/bank').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/bank/release-safety').allowed).toBe(false);
  });

  it('does not block routes that only share a string prefix', () => {
    expect(canPlatformV7RoleOpenRoute('driver', '/platform-v7/banking-notes').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/control-tower-notes').allowed).toBe(true);
  });

  it('keeps role switch subroutes blocked for non-operator roles', () => {
    expect(canPlatformV7RoleOpenRoute('seller', '/platform-v7/roles/audit').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('operator', '/platform-v7/roles/audit').allowed).toBe(true);
  });
});
