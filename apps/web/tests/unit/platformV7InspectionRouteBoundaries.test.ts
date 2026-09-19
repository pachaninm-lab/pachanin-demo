import { describe, expect, it } from 'vitest';
import { canPlatformV7RoleOpenRoute } from '@/lib/platform-v7/role-access';

describe('platform-v7 inspection route boundaries', () => {
  it('keeps elevator on acceptance work routes', () => {
    expect(canPlatformV7RoleOpenRoute('elevator', '/platform-v7/elevator').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('elevator', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('elevator', '/platform-v7/bank').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('elevator', '/platform-v7/investor').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('elevator', '/platform-v7/connectors').allowed).toBe(false);
  });

  it('keeps lab on quality work routes', () => {
    expect(canPlatformV7RoleOpenRoute('lab', '/platform-v7/lab').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('lab', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('lab', '/platform-v7/bank').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('lab', '/platform-v7/investor').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('lab', '/platform-v7/driver/field').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('lab', '/platform-v7/connectors').allowed).toBe(false);
  });

  it('keeps surveyor on verification work routes', () => {
    expect(canPlatformV7RoleOpenRoute('surveyor', '/platform-v7/surveyor').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('surveyor', '/platform-v7/roles').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('surveyor', '/platform-v7/bank').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('surveyor', '/platform-v7/investor').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('surveyor', '/platform-v7/connectors').allowed).toBe(false);
  });
});
