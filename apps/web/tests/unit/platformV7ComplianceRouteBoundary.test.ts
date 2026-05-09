import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleOpenRoute } from '@/lib/platform-v7/role-access';

describe('platform-v7 compliance route boundary', () => {
  it('keeps compliance on compliance routes', () => {
    expect(canPlatformV7RoleOpenRoute('compliance', '/platform-v7/compliance').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('compliance', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('compliance', '/platform-v7/driver/field').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('compliance', '/platform-v7/connectors').allowed).toBe(false);
  });
});
