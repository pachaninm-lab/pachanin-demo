import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const registerSrc = readFileSync(resolve(process.cwd(), 'app/platform-v7/register/page.tsx'), 'utf8');
const loginSrc = readFileSync(resolve(process.cwd(), 'app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 product entry', () => {
  it('keeps register source with required application states', () => {
    expect(registerSrc).toContain('Регистрация участника');
    expect(registerSrc).toContain('ИНН');
    expect(registerSrc).toContain('Допущен');
  });

  it('keeps login source as single role entry', () => {
    expect(loginSrc).toContain('Единый вход');
    expect(loginSrc).toContain('Выберите один рабочий кабинет');
    expect(loginSrc).toContain('Водитель');
    expect(loginSrc).toContain('Комплаенс');
  });
});
