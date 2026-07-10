import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 single entry login', () => {
  it('keeps one credential form without role selection or client authority', () => {
    expect(source).toContain("useTranslations('publicEntry.login')");
    expect(source).toContain("type LoginStep = 'password' | 'mfa' | 'backup-codes'");
    expect(source).toContain("requestJson('/api/auth/login'");
    expect(source).toContain('payload.redirectTo');
    expect(source).not.toContain('Выберите один рабочий кабинет');
    expect(source).not.toContain('usePlatformV7RStore');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('?role=');
  });
});
