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
  it('removes native Safari button chrome without overriding utility typography', () => {
    expect(product).toContain("[data-gekta-chat-workspace='true'] button");
    expect(product).toContain('-webkit-appearance: none');
    expect(product).toContain('appearance: none');
    expect(product).toContain('font-family: inherit');
    expect(product).not.toContain('font: inherit');
    expect(product).toContain("header > button:first-child");
    expect(product).toContain("[data-gekta-drop-target='true'] > button");
    expect(product).toContain('border: 0');
    expect(product).toContain('background-color: transparent');
    expect(product).toContain('box-shadow: none');
  });

  it('disables WebKit text inflation in both the chat workspace and native utility routes', () => {
    expect(product).toContain('-webkit-text-size-adjust: none');
    expect(product).toContain('text-size-adjust: none');
    expect(utilityStyle).toContain("[data-gekta-utility-page]");
    expect(utilityStyle).toContain('-webkit-text-size-adjust: none');
    expect(utilityStyle).toContain('text-size-adjust: none');
    expect(product).not.toContain('-webkit-text-size-adjust: 100%');
    expect(utilityStyle).not.toContain('-webkit-text-size-adjust: 100%');
  });

  it('keeps the 320px composer copy concise in RU, EN and ZH', () => {
    expect(composer).toContain("ru: 'Задай вопрос Гекте'");
    expect(composer).toContain("en: 'Ask Gekta'");
    expect(composer).toContain("zh: '向 Gekta 提问'");
    expect(composer).toContain("ru: 'Не отправляй пароли, токены и другие секреты.'");
    expect(composer).toContain("en: 'Do not send passwords, tokens or other secrets.'");
    expect(composer).not.toContain("ru: 'История этого режима хранится в браузере. Не отправляй секреты, пароли и токены.'");
  });

  it('normalizes text controls while preserving the native support selector affordance', () => {
    expect(utilityStyle).toContain("input:not([type='checkbox']):not([type='radio']):not([type='file'])");
    expect(utilityStyle).toContain('-webkit-appearance: none');
    expect(utilityStyle).toContain('appearance: none');
    expect(utilityStyle).toContain('min-height: 44px');
    expect(utilityStyle).toContain('font-size: 16px !important');
    expect(utilityStyle).toContain('font-family: inherit');
    expect(utilityStyle).not.toContain('font: inherit');
    expect(browserAcceptance).toContain("item.tag === 'SELECT'");
    expect(browserAcceptance).toContain('support topic selector must remain visibly selectable');
    expect(browserAcceptance).toContain("item.appearance !== 'none'");
  });

  it('runs visual evidence for chrome reset, text sizing, typography and utility navigation in PR and production acceptance', () => {
    const matcher = 'gekta-ios-safari-visual-polish-acceptance';
    expect(prConfig).toContain(matcher);
    expect(productionConfig).toContain(matcher);
    expect(browserAcceptance).toContain("placeholder', 'Задай вопрос Гекте'");
    expect(browserAcceptance).toContain("getByRole('link', { name: 'Поддержка' })");
    expect(browserAcceptance).toContain("page.goto('/gekta/security'");
    expect(browserAcceptance).toContain('expectAppearanceReset');
    expect(browserAcceptance).toContain('expectNeutralControlReset');
    expect(browserAcceptance).toContain('expectTextAutosizingDisabled');
    expect(browserAcceptance).toContain('expectSemiboldButtonTypography');
    expect(browserAcceptance).toContain('maxH1Height');
    expect(browserAcceptance).toContain('expectNoHorizontalOverflow');
  });
});
