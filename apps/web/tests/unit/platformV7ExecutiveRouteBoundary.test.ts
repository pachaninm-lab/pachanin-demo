import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleOpenRoute } from '@/lib/platform-v7/role-access';

describe('platform-v7 executive route boundary', () => {
  it('keeps executive away from field work and provider setup', () => {
    expect(canPlatformV7RoleOpenRoute('executive', '/platform-v7/executive').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('executive', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('executive', '/platform-v7/driver/field').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('executive', '/platform-v7/connectors').allowed).toBe(false);
  });
});
