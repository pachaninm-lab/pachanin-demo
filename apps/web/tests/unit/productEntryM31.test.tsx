import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const registerSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/register/page.tsx'), 'utf8');
const loginSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 product entry', () => {
  it('keeps register source with required application states', () => {
    expect(registerSrc).toContain('Регистрация участника');
    expect(registerSrc).toContain('ИНН');
    expect(registerSrc).toContain('Допущен');
  });

  it('keeps login as one server-authoritative entry with MFA', () => {
    expect(loginSrc).toContain("useTranslations('publicEntry.login')");
    expect(loginSrc).toContain("requestJson('/api/auth/login'");
    expect(loginSrc).toContain("requestJson('/api/auth/mfa-login'");
    expect(loginSrc).not.toContain('usePlatformV7RStore');
    expect(loginSrc).not.toContain('?role=');
  });
});
