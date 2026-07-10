import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const registerSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/register/page.tsx'), 'utf8');
const loginPage = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const loginFlow = readFileSync(resolve(process.cwd(), 'apps/web/components/platform-v7/PublicAuthLoginFlow.tsx'), 'utf8');

describe('platform-v7 product entry', () => {
  it('keeps register source with required application states', () => {
    expect(registerSrc).toContain('Регистрация участника');
    expect(registerSrc).toContain('ИНН');
    expect(registerSrc).toContain('Допущен');
  });

  it('keeps login as one server-authoritative entry', () => {
    expect(loginPage).toContain('<PublicAuthLoginFlow />');
    expect(loginFlow).toContain("postJson('/api/auth/login'");
    expect(loginFlow).toContain('payload.redirectTo');
    expect(loginFlow).toContain("type Step = 'password' | 'mfa' | 'backup-codes'");
    expect(loginFlow).not.toContain('Выберите один рабочий кабинет');
    expect(loginFlow).not.toContain('Водитель');
    expect(loginFlow).not.toContain('Комплаенс');
    expect(loginFlow).not.toContain('sessionStorage');
  });
});
