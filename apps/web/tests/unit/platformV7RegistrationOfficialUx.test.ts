import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const page = read('app/platform-v7/register/page.tsx');
const client = read('app/platform-v7/register/RegisterFormClientPublic.tsx');
const baseClient = read('app/platform-v7/register/RegisterFormClient.tsx');
const registerRoute = read('app/api/auth/register/route.ts');
const resendRoute = read('app/api/auth/registration/resend/route.ts');
const passwordPolicy = read('../api/src/common/validators/strong-password.validator.ts');

describe('Platform V7 registration official UX', () => {
  it('removes internal and informal Russian wording from the public registration surface', () => {
    expect(page).toContain('Регистрация организации и пользователя');
    expect(page).not.toContain('P0 · Первый клиентский доступ');
    expect(page).not.toContain('Заполни реальные данные');
    expect(client).not.toContain("'Рабочее пространство'");
    expect(client).not.toContain('correlation ID');
    expect(client).not.toContain('Рабочий email');
    expect(client).toContain('Идентификатор обращения:');
    expect(client).toContain('Адрес электронной почты *');
  });

  it('uses official Russian wording in initial and repeated verification email', () => {
    for (const route of [registerRoute, resendRoute]) {
      expect(route).toContain('подтвердите адрес электронной почты');
      expect(route).not.toContain('подтвердите email');
      expect(route).not.toContain('Открой одноразовую ссылку');
    }
  });

  it('states the actual server password policy and confirms the password before submission', () => {
    expect(passwordPolicy).toContain('MIN_PASSWORD_LENGTH = 12');
    expect(passwordPolicy).toContain('MAX_PASSWORD_LENGTH = 128');
    expect(passwordPolicy).toContain('classes < 3');
    expect(client).toContain('12–128 символов');
    expect(client).toContain('как минимум три группы');
    expect(client).toContain("name='confirmPassword'");
    expect(client).toContain("password !== field(form, 'confirmPassword')");
  });

  it('keeps the production registration authority and protected endpoints unchanged', () => {
    for (const marker of [
      "fetch('/api/auth/register'",
      "fetch('/api/auth/registration/resend'",
      "fetch('/api/auth/registration/verify'",
      "fetch('/api/auth/registration/additional-information'",
      '/api/auth/registration/status?token=',
      'idempotency-key',
      'applyCsrfHeader',
      "termsVersion: '2026-07-31'",
      "privacyVersion: '2026-07-31'",
    ]) expect(client).toContain(marker);
    expect(client).not.toContain('role:');
    expect(client).not.toContain('requestedRole');
    expect(client).not.toContain('/platform-v7/onboarding');
    expect(baseClient).toContain("fetch('/api/auth/register'");
  });

  it('explains employee join semantics without creating a new organization client-side', () => {
    expect(client).toContain("['employee', 'Сотрудник существующей организации']");
    expect(client).toContain('Новая организация при этом не создаётся.');
    expect(client).not.toContain('createOrganization');
  });
});
