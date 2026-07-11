import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const landing = read('apps/web/app/platform-v7/page.tsx');
const loginPage = read('apps/web/app/platform-v7/login/page.tsx');
const loginClient = read('apps/web/app/platform-v7/login/LoginFormClient.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const messages = read('apps/web/i18n/public-entry-messages.ts');
const css = read('apps/web/styles/platform-v7-public-world-class.css');

describe('platform-v7 industrial public entry gate', () => {
  it('keeps the public shell accessible without adding a hydration boundary', () => {
    expect(landing).toContain("className='pc-skip-link'");
    expect(loginPage).toContain("className='pc-skip-link'");
    expect(publicHeader).not.toContain("'use client'");
    expect(publicHeader).toContain("<details className='pc-site-mobile-menu'>");
    expect(publicHeader).toContain("<summary aria-label={menuLabel}");
    expect(publicHeader).toContain("<nav className='pc-site-mobile-nav'");
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('presents a real execution model rather than fake-live demo data', () => {
    expect(landing).not.toContain('DL-9102');
    expect(landing).not.toContain("entry-visual-live'><i");
    expect(landing).toContain("publicLanding('visualTitle')");
    expect(landing).toContain("publicLanding('visualBasisText')");
    expect(landing).toContain("data-maturity='industrial-public-entry'");
  });

  it('keeps role catalog informational and login server-authoritative', () => {
    expect(landing).toContain("role='listitem'");
    expect(landing).not.toContain("<a key={key} href={href} className='entry-role-tile'");
    expect(landing).toContain("href='/platform-v7/login' className='entry-role-access-cta'");
    expect(messages).toContain('Роль не выбирается вручную');
    expect(messages).toContain('A role is never selected manually');
    expect(messages).toContain('用户无需手动选择角色');
  });

  it('uses persistent labels and precise accessible authentication semantics', () => {
    expect(loginClient).toContain("id='pc-auth-email'");
    expect(loginClient).toContain("name='email'");
    expect(loginClient).toContain("autoComplete='username'");
    expect(loginClient).toContain('maxLength={254}');
    expect(loginClient).toContain("id='pc-auth-password'");
    expect(loginClient).toContain("name='password'");
    expect(loginClient).toContain("autoComplete='current-password'");
    expect(loginClient).toContain('maxLength={256}');
    expect(loginClient).toContain('aria-errormessage=');
    expect(loginClient).toContain('aria-pressed={showPassword}');
    expect(loginClient).toContain("event.getModifierState('CapsLock')");
    expect(loginClient).not.toContain('placeholder={copy.emailPlaceholder}');
    expect(loginClient).not.toContain('placeholder={copy.passwordPlaceholder}');
  });

  it('constrains and labels MFA input without weakening the server boundary', () => {
    expect(loginClient).toContain("autoComplete={method === 'totp' ? 'one-time-code' : 'off'}");
    expect(loginClient).toContain("pattern={method === 'totp' ? '[0-9]{6}' : undefined}");
    expect(loginClient).toContain("maxLength={method === 'totp' ? 6 : 64}");
    expect(loginClient).toContain("requestJson('/api/auth/mfa-login'");
    expect(loginClient).toContain("globalThis.location.assign(payload.redirectTo)");
  });

  it('provides complete RU EN ZH public-entry chrome and assurance copy', () => {
    for (const token of [
      "brandHomeLabel: 'Прозрачная Цена — на главную'",
      "brandHomeLabel: 'Transparent Price — home'",
      "brandHomeLabel: '透明价格 — 返回首页'",
      "assuranceAudit: 'События входа журналируются'",
      "assuranceAudit: 'Sign-in events are recorded'",
      "assuranceAudit: '登录事件会被记录'",
    ]) {
      expect(messages).toContain(token);
    }
  });
});
