import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const registerSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/register/page.tsx'), 'utf8');
const loginPage = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const loginLayout = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/layout.tsx'), 'utf8');
const loginClient = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/LoginFormClient.tsx'), 'utf8');
const loginCopy = readFileSync(resolve(process.cwd(), 'apps/web/i18n/public-login-copy.ts'), 'utf8');
const loginRefinedCss = readFileSync(resolve(process.cwd(), 'apps/web/styles/platform-v7-public-login-refined.css'), 'utf8');

describe('platform-v7 product entry', () => {
  it('keeps register source with required application states', () => {
    expect(registerSrc).toContain('Регистрация участника');
    expect(registerSrc).toContain('ИНН');
    expect(registerSrc).toContain('Допущен');
  });

  it('keeps login as one server-authoritative entry with MFA', () => {
    expect(loginPage).toContain('getPublicLoginCopy(locale)');
    expect(loginPage).toContain('<LoginFormClient copy={form} />');
    expect(loginCopy).toContain("secureEyebrow: 'Защищённый вход'");
    expect(loginClient).toContain("requestJson('/api/auth/login'");
    expect(loginClient).toContain("requestJson('/api/auth/mfa-login'");
    expect(loginClient).not.toContain('usePlatformV7RStore');
    expect(loginClient).not.toContain('?role=');
  });

  it('keeps the mobile login task-first and removes decorative security blocks', () => {
    expect(loginLayout).toContain("platform-v7-public-login-refined.css");
    expect(loginCopy).toContain("email: 'Электронная почта'");
    expect(loginCopy).toContain("forgot: 'Забыли пароль?'");
    expect(loginRefinedCss).toContain('.pc-auth-world-class .pc-auth-assurance');
    expect(loginRefinedCss).toContain('display: none !important');
    expect(loginRefinedCss).toContain('.pc-auth-world-class .pc-auth-field input:focus-visible');
    expect(loginRefinedCss).toContain('max-height: 720px');
  });
});
