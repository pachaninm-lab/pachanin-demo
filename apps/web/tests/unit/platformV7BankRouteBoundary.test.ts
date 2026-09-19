import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleOpenRoute } from '@/lib/platform-v7/role-access';

describe('platform-v7 bank route boundary', () => {
  it('keeps bank on its own route boundary', () => {
    expect(canPlatformV7RoleOpenRoute('bank', '/platform-v7/bank').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('bank', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('bank', '/platform-v7/driver/field').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('bank', '/platform-v7/connectors').allowed).toBe(false);
  });
});
