import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleOpenRoute } from '@/lib/platform-v7/role-access';

describe('platform-v7 arbitrator route boundary', () => {
  it('keeps arbitrator on dispute decision routes', () => {
    expect(canPlatformV7RoleOpenRoute('arbitrator', '/platform-v7/arbitrator').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('arbitrator', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('arbitrator', '/platform-v7/driver/field').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('arbitrator', '/platform-v7/connectors').allowed).toBe(false);
  });
});
