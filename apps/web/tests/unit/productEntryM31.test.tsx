import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const registerSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/register/page.tsx'), 'utf8');
const registerFormSrc = readFileSync(resolve(process.cwd(), 'apps/web/components/platform-v7/RegisterForm.tsx'), 'utf8');
const loginSrc = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 product entry', () => {
  it('keeps register page with hero and RegisterForm reference', () => {
    expect(registerSrc).toContain('Регистрация участника');
    expect(registerSrc).toContain('RegisterForm');
  });

  it('keeps RegisterForm with required application states and fields', () => {
    expect(registerFormSrc).toContain('ИНН');
    expect(registerFormSrc).toContain('Допущен');
    expect(registerFormSrc).toContain('validateInn');
    expect(registerFormSrc).toContain('AppStatusTracker');
  });

  it('keeps login source as single role entry', () => {
    expect(loginSrc).toContain('Единый вход');
    expect(loginSrc).toContain('Выберите один рабочий кабинет');
    expect(loginSrc).toContain('Водитель');
    expect(loginSrc).toContain('Комплаенс');
  });
});
