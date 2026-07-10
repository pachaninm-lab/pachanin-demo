import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const registerSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/register/page.tsx'), 'utf8');
const loginSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/(platform-public)/platform-v7/login/page.tsx'), 'utf8');
const loginApiSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/api/auth/login/route.ts'), 'utf8');

describe('platform-v7 product entry', () => {
  it('keeps register source with required application states', () => {
    expect(registerSrc).toContain('Регистрация участника');
    expect(registerSrc).toContain('ИНН');
    expect(registerSrc).toContain('Допущен');
  });

  it('keeps a role-neutral login with password recovery and MFA', () => {
    expect(loginSrc).toContain("type LoginStep = 'password' | 'mfa'");
    expect(loginSrc).toContain("href='/platform-v7/forgot-password'");
    expect(loginSrc).not.toContain('usePlatformV7RStore');
    expect(loginSrc).not.toContain('sessionStorage');
    expect(loginSrc).not.toContain('?role=');
  });

  it('requires the real identity service instead of demo credentials', () => {
    expect(loginApiSrc).toContain("fetch(`${API_URL}/auth/login`");
    expect(loginApiSrc).not.toContain('demoLoginAllowed');
    expect(loginApiSrc).not.toContain('allowedDemoCredentials');
    expect(loginApiSrc).not.toContain('demo-login');
  });
});
