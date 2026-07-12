import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const registerSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/register/page.tsx'), 'utf8');
const loginPage = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const loginClient = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/LoginFormClient.tsx'), 'utf8');
const loginCopy = readFileSync(resolve(process.cwd(), 'apps/web/i18n/public-login-copy.ts'), 'utf8');

describe('platform-v7 product entry', () => {
  it('keeps register source with required application states', () => {
    expect(registerSrc).toContain('Регистрация участника');
    expect(registerSrc).toContain('ИНН');
    expect(registerSrc).toContain('Допущен');
  });

  it('keeps login as one server-authoritative entry with MFA', () => {
    expect(loginPage).toContain('getPublicLoginCopy(locale)');
    expect(loginPage).toContain('<LoginFormClient copy={form} />');
    expect(loginCopy).toContain("lead: 'Введите рабочую почту и пароль.'");
    expect(loginClient).toContain("requestJson('/api/auth/login'");
    expect(loginClient).toContain("requestJson('/api/auth/mfa-login'");
    expect(loginClient).not.toContain('usePlatformV7RStore');
    expect(loginClient).not.toContain('?role=');
    expect(loginClient).not.toContain('pc-auth-assurance');
    expect(loginClient).not.toContain('autoFocus');
  });
});
