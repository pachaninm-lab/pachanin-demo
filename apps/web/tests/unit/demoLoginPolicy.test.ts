import { describe, expect, it } from 'vitest';
import { demoLoginAllowed, ALLOW_DEMO_LOGIN_FLAG } from '@/lib/platform-v7/demo-login-policy';

describe('demo-login policy (production passwordless-login hardening)', () => {
  it('allows the demo fallback in development / test', () => {
    expect(demoLoginAllowed({ NODE_ENV: 'development' } as any)).toBe(true);
    expect(demoLoginAllowed({ NODE_ENV: 'test' } as any)).toBe(true);
    expect(demoLoginAllowed({} as any)).toBe(true);
  });

  it('disables the demo fallback in production by default (fail closed)', () => {
    expect(demoLoginAllowed({ NODE_ENV: 'production' } as any)).toBe(false);
  });

  it('only re-enables it in production via an explicit opt-in flag', () => {
    expect(demoLoginAllowed({ NODE_ENV: 'production', [ALLOW_DEMO_LOGIN_FLAG]: 'true' } as any)).toBe(true);
    expect(demoLoginAllowed({ NODE_ENV: 'production', [ALLOW_DEMO_LOGIN_FLAG]: 'false' } as any)).toBe(false);
    expect(demoLoginAllowed({ NODE_ENV: 'production', [ALLOW_DEMO_LOGIN_FLAG]: '1' } as any)).toBe(false);
  });
});
