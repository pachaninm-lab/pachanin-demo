import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const PUBLIC_ROOT = 'apps/web/app/(platform-public)/platform-v7';

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 password recovery', () => {
  const login = read(`${PUBLIC_ROOT}/login/page.tsx`);
  const forgot = read(`${PUBLIC_ROOT}/forgot-password/page.tsx`);
  const reset = read(`${PUBLIC_ROOT}/reset-password/page.tsx`);
  const requestRoute = read('apps/web/app/api/auth/forgot-password/route.ts');
  const confirmRoute = read('apps/web/app/api/auth/reset-password/route.ts');

  it('routes recovery away from support', () => {
    expect(login).toContain("href='/platform-v7/forgot-password'");
    expect(login).not.toContain("href='/platform-v7/contact'>{t('forgot')}");
  });

  it('uses a universal account-enumeration-safe request response', () => {
    expect(forgot).toContain("fetch('/api/auth/forgot-password'");
    expect(requestRoute).toContain('UNIVERSAL_MESSAGE');
    expect(requestRoute).toContain('accepted: true');
    expect(requestRoute).not.toContain('accountExists');
    expect(requestRoute).not.toContain('userExists');
  });

  it('never logs or returns the reset token to the browser request screen', () => {
    expect(requestRoute).not.toContain("console.info('password_reset_token'");
    expect(requestRoute).not.toContain('token: delivery.token');
    expect(forgot).not.toContain('token');
  });

  it('supports one-time reset and local session cleanup', () => {
    expect(reset).toContain("fetch('/api/auth/reset-password'");
    expect(confirmRoute).toContain('sessionsRevoked: true');
    expect(confirmRoute).toContain('ACCESS_COOKIE');
    expect(confirmRoute).toContain('REFRESH_COOKIE');
    expect(confirmRoute).toContain('expires: new Date(0)');
  });

  it('keeps auth pages out of search indexes', () => {
    const loginLayout = read(`${PUBLIC_ROOT}/login/layout.tsx`);
    const forgotLayout = read(`${PUBLIC_ROOT}/forgot-password/layout.tsx`);
    const resetLayout = read(`${PUBLIC_ROOT}/reset-password/layout.tsx`);
    for (const source of [loginLayout, forgotLayout, resetLayout]) {
      expect(source).toContain('index: false');
      expect(source).toContain('follow: false');
    }
  });

  it('does not restore the legacy login header patch', () => {
    const loginLayout = read(`${PUBLIC_ROOT}/login/layout.tsx`);
    expect(loginLayout).not.toContain('LoginHeaderExitButton');
  });
});
