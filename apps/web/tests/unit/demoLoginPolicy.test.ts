import { describe, expect, it } from 'vitest';
import { demoLoginAllowed, ALLOW_DEMO_LOGIN_FLAG } from '@/lib/platform-v7/demo-login-policy';

describe('demo-login policy (production passwordless-login hardening)', () => {
  it('requires an explicit flag in a non-production test contour', () => {
    expect(demoLoginAllowed({ NODE_ENV: 'development' } as any)).toBe(false);
    expect(demoLoginAllowed({ NODE_ENV: 'test' } as any)).toBe(false);
    expect(demoLoginAllowed({ NODE_ENV: 'test', [ALLOW_DEMO_LOGIN_FLAG]: 'true' } as any)).toBe(true);
  });

  it('disables the demo fallback in production by default (fail closed)', () => {
    expect(demoLoginAllowed({ NODE_ENV: 'production' } as any)).toBe(false);
  });

  it('cannot be re-enabled in production by a flag', () => {
    expect(demoLoginAllowed({ NODE_ENV: 'production', [ALLOW_DEMO_LOGIN_FLAG]: 'true' } as any)).toBe(false);
    expect(demoLoginAllowed({ NODE_ENV: 'production', [ALLOW_DEMO_LOGIN_FLAG]: 'false' } as any)).toBe(false);
    expect(demoLoginAllowed({ NODE_ENV: 'production', [ALLOW_DEMO_LOGIN_FLAG]: '1' } as any)).toBe(false);
  });
});
