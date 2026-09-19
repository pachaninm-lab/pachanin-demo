import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const loginRoute = readFileSync(
  resolve(process.cwd(), 'app/api/auth/login/route.ts'),
  'utf8',
);

describe('P0 first-customer auth boundary', () => {
  it('does not create controlled sessions or derive production roles from email', () => {
    expect(loginRoute).not.toContain('ROLE_ACCOUNTS');
    expect(loginRoute).not.toContain('PC_CABINET_ROLE_PASSWORD');
    expect(loginRoute).not.toContain('PC_CABINET_TEST_ACCESS');
    expect(loginRoute).not.toContain('signControlledToken');
    expect(loginRoute).not.toContain('testAccess: true');
    expect(loginRoute).not.toContain('@procent-agro.test');
  });

  it('fails closed when the real auth API is not configured or unavailable', () => {
    expect(loginRoute).toContain("code: 'AUTH_SERVICE_UNAVAILABLE'");
    expect(loginRoute).toContain('if (!API_URL)');
    expect(loginRoute).toContain("fetch(`${API_URL}/auth/login`");
    expect(loginRoute).toContain('AbortSignal.timeout(5_000)');
  });
});
