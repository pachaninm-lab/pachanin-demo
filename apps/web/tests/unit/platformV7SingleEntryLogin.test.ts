import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');
const layout = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/layout.tsx'), 'utf8');
const rewrittenPage = readFileSync(resolve(process.cwd(), 'apps/web/app/pc-public-entry/platform-v7/login/page.tsx'), 'utf8');
const client = readFileSync(resolve(process.cwd(), 'apps/web/app/platform-v7/login/LoginFormClient.tsx'), 'utf8');
const copy = readFileSync(resolve(process.cwd(), 'apps/web/i18n/public-login-copy.ts'), 'utf8');

describe('platform-v7 single-entry login', () => {
  it('contains one server-rendered credential entry without a role selector', () => {
    expect(page).toContain('getPublicLoginCopy(locale)');
    expect(page).toContain('<LoginFormClient copy={form} />');
    expect(copy).toContain("title: 'Войти'");
    expect(copy).toContain("title: 'Sign in'");
    expect(copy).toContain("title: '登录'");
    expect(client).toContain("type LoginStep = 'password' | 'mfa' | 'backup-codes'");
    expect(client).toContain("fetch('/api/auth/mfa-login/cancel'");
    expect(client).not.toContain('workspace-picker');
    expect(client).not.toContain('data-role-selector');
    expect(client).not.toContain("name='role'");
    expect(client).not.toContain('?role=');
  });

  it('keeps direct and rewritten login metadata locale-authoritative', () => {
    for (const source of [layout, rewrittenPage]) {
      expect(source).toContain('export async function generateMetadata(): Promise<Metadata>');
      expect(source).toContain('const locale = await getLocale();');
      expect(source).toContain('getPublicLoginCopy(locale)');
      expect(source).toContain('title: `${form.title} — Прозрачная Цена`');
      expect(source).toContain('description: form.lead');
      expect(source).not.toContain("title: 'Вход — Прозрачная Цена'");
    }
  });
});
