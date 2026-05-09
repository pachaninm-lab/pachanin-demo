import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleOpenRoute } from '@/lib/platform-v7/role-access';

describe('platform-v7 trading route boundaries', () => {
  it('keeps seller on seller work routes', () => {
    expect(canPlatformV7RoleOpenRoute('seller', '/platform-v7/seller').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('seller', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('seller', '/platform-v7/bank/release-safety').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('seller', '/platform-v7/connectors').allowed).toBe(false);
  });

  it('keeps buyer on buyer work routes', () => {
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/buyer').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/control-tower').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/bank/release-safety').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('buyer', '/platform-v7/connectors').allowed).toBe(false);
  });
});
