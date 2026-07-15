import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const landing = read('apps/web/app/platform-v7/page.tsx');
const explorerPage = read('apps/web/app/platform-v7/how-it-works/page.tsx');
const explorer = read('apps/web/components/platform-v7/PublicDealExplorer.tsx');
const explorerV4 = read('apps/web/components/platform-v7/PublicDealExplorerV4.tsx');
const entryGate = read('apps/web/components/platform-v7/PublicDealEntryGate.tsx');
const stateMachine = read('apps/web/lib/platform-v7/public-product-experience-state.ts');
const loginPage = read('apps/web/app/platform-v7/login/page.tsx');
const loginClient = read('apps/web/app/platform-v7/login/LoginFormClient.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const messages = read('apps/web/i18n/public-entry-messages.ts');
const copy = read('apps/web/i18n/public-product-experience-v3.ts');
const copyV4 = read('apps/web/i18n/public-product-experience-v4.ts');
const entryCopy = read('apps/web/i18n/public-product-entry-variants.ts');
const css = read('apps/web/styles/platform-v7-public-product-experience-v3.css');
const entryCss = read('apps/web/styles/platform-v7-public-product-entry-variants.css');
const finalCss = read('apps/web/styles/platform-v7-public-product-experience-v4-final.css');

describe('platform-v7 industrial public entry gate', () => {
  it('keeps the public shell accessible with only scoped client islands', () => {
    expect(landing).toContain("className='pc-skip-link'");
    expect(explorerPage).toContain("className='pc-skip-link'");
    expect(loginPage).toContain("className='pc-skip-link'");
    expect(publicHeader).not.toContain("'use client'");
    expect(landing).toContain('<PublicDealPreview');
    expect(explorerPage).toContain('<PublicDealEntryGate');
    expect(entryGate).toContain('<PublicDealExplorerV4');
    expect(css).toContain('min-height: 44px');
    expect(entryCss).toContain('min-height: 108px');
    expect(css).toContain('@media (forced-colors: active)');
    expect(finalCss).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('presents an explicit example instead of fake-live data', () => {
    expect(copy).toContain("exampleBadge: 'Пример прохождения сделки'");
    expect(copy).toContain('не читает реальные сделки');
    expect(copy).toContain('не выполняет денежные операции');
    expect(`${explorer}\n${entryGate}`).not.toContain('fetch(');
    expect(`${explorer}\n${entryGate}`).not.toContain('/api/');
    expect(`${explorer}\n${entryGate}`).not.toContain('WebSocket');
  });

  it('keeps role exploration informational and login server-authoritative', () => {
    expect(landing).toContain("className='pc-ppe-perspective-grid' role='group'");
    expect(landing).not.toContain("role='listitem'");
    expect(landing).not.toContain('/platform-v7/login?role=');
    expect(stateMachine).toContain('export type TourPerspective');
    expect(stateMachine).toContain("TOUR_ENTRY_VARIANTS = ['role', 'problem', 'deal']");
    expect(`${stateMachine}\n${entryGate}`).not.toContain('membership');
    expect(`${stateMachine}\n${entryGate}`).not.toContain('RBAC');
    expect(`${stateMachine}\n${entryGate}`).not.toContain('accessToken');
    expect(entryCopy).toContain('не влияет на права доступа');
    expect(messages).toContain('Роль не выбирается вручную');
    expect(messages).toContain('A role is never selected manually');
    expect(messages).toContain('用户无需手动选择角色');
  });

  it('provides all three usability validation entries without duplicating product architecture', () => {
    expect(explorerPage).toContain('normalizeTourEntryVariant(searchParams?.entry)');
    expect(entryGate).toContain("entry === 'role'");
    expect(entryGate).toContain("source === 'role-first'");
    expect(entryGate).toContain("'problem-first'");
    expect(entryGate).toContain("entry === 'deal'");
    expect(entryGate).toContain('return <PublicDealExplorerV4');
    expect(explorerV4).toContain('return <PublicDealExplorer');
    expect(entryCopy).toContain("title: 'Кто вы в сделке?'");
    expect(entryCopy).toContain("title: 'Что вы хотите контролировать?'");
    expect(entryCopy).toContain("title: 'Who are you in the deal?'");
    expect(entryCopy).toContain("title: 'What do you want to control?'");
    expect(entryCopy).toContain("title: '你在交易中承担什么角色？'");
    expect(entryCopy).toContain("title: '你希望控制什么？'");
  });

  it('keeps primary public actions explicitly high contrast and delays connection in the explorer', () => {
    expect(css).toContain('.pc-ppe-primary-button');
    expect(css).toContain('background: var(--pc-ppe-green)');
    expect(css).toContain('color: #fff');
    expect(landing).toContain("className='pc-ppe-primary-button'");
    expect(explorer).toContain("className='pc-ppe-primary-button'");
    expect(explorerPage).not.toContain("eventName='connect_cta_click'");
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
    expect(loginClient).toContain('globalThis.location.assign(payload.redirectTo)');
  });

  it('provides complete RU EN ZH public experience and authentication copy', () => {
    for (const token of [
      "brandHomeLabel: 'Прозрачная Цена — на главную'",
      "brandHomeLabel: 'Transparent Price — home'",
      "brandHomeLabel: '透明价格 — 返回首页'",
      "title: 'Посмотрите, как исполняется сделка'",
      "title: 'See how the deal is executed'",
      "title: '查看交易如何履约'",
    ]) {
      expect(`${messages}\n${copyV4}`).toContain(token);
    }
  });
});
