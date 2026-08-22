import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const product = read('components/gekta/GektaProductShell.tsx');
const composer = read('components/gekta/GektaComposer.tsx');
const utilityStyle = read('components/gekta/GektaUtilityMobileStyle.tsx');
const prConfig = read('playwright.gekta-mobile-pr.config.ts');
const productionConfig = read('playwright.production-mobile.config.ts');
const browserAcceptance = read('tests/e2e/gekta-ios-safari-visual-polish-acceptance.spec.ts');

describe('Gekta iOS Safari visual polish contract', () => {
  it('removes native Safari button chrome only inside the Gekta workspace', () => {
    expect(product).toContain("[data-gekta-chat-workspace='true'] button");
    expect(product).toContain('-webkit-appearance: none');
    expect(product).toContain('appearance: none');
    expect(product).toContain('font: inherit');
  });

  it('keeps the 320px composer copy concise in RU, EN and ZH', () => {
    expect(composer).toContain("ru: 'Задай вопрос Гекте'");
    expect(composer).toContain("en: 'Ask Gekta'");
    expect(composer).toContain("zh: '向 Gekta 提问'");
    expect(composer).toContain("ru: 'Не отправляй пароли, токены и другие секреты.'");
    expect(composer).toContain("en: 'Do not send passwords, tokens or other secrets.'");
    expect(composer).not.toContain("ru: 'История этого режима хранится в браузере. Не отправляй секреты, пароли и токены.'");
  });

  it('normalizes Gekta utility form controls without touching checkbox, radio or file semantics', () => {
    expect(utilityStyle).toContain("input:not([type='checkbox']):not([type='radio']):not([type='file'])");
    expect(utilityStyle).toContain('-webkit-appearance: none');
    expect(utilityStyle).toContain('appearance: none');
    expect(utilityStyle).toContain('min-height: 44px');
    expect(utilityStyle).toContain('font-size: 16px !important');
  });

  it('runs the visual polish browser contract in PR and production mobile acceptance', () => {
    const matcher = 'gekta-ios-safari-visual-polish-acceptance';
    expect(prConfig).toContain(matcher);
    expect(productionConfig).toContain(matcher);
    expect(browserAcceptance).toContain("placeholder', 'Задай вопрос Гекте'");
    expect(browserAcceptance).toContain("getByRole('link', { name: 'Поддержка' })");
    expect(browserAcceptance).toContain("page.goto('/gekta/security'");
    expect(browserAcceptance).toContain('expectAppearanceReset');
    expect(browserAcceptance).toContain('expectNoHorizontalOverflow');
  });
});
