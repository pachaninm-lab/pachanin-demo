import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const wrapper = read('apps/web/components/platform-v7/PlatformV7StrategicHomeInternational.tsx');
const css = read('apps/web/styles/platform-v7-international-home-fix.css');
const tsconfig = read('apps/web/tsconfig.json');
const trustContent = read('apps/web/app/trust/page.tsx');
const trustRoute = read('apps/web/app/platform-v7/trust/page.tsx');
const browserAcceptance = read('apps/web/tests/e2e/platform-v7-public-intelligence-layer.spec.ts');
const strategicAcceptance = read('apps/web/tests/e2e/platform-v7-strategic-home-v3.spec.ts');

describe('platform-v7 international homepage completion', () => {
  it('routes the canonical homepage through the additive completion layer', () => {
    expect(tsconfig).toContain('"@/components/platform-v7/PlatformV7StrategicHome"');
    expect(tsconfig).toContain('PlatformV7StrategicHomeInternational.tsx');
    expect(wrapper).toContain("from './PlatformV7StrategicHome'");
    expect(wrapper).toContain('BasePlatformV7StrategicHome');
  });

  it('renders exactly seven numbered Deal steps and removes the duplicate path section', () => {
    expect(wrapper).toContain("props.id === 'deal-path'");
    expect(wrapper).toContain("normalizedKey(element.key) === '08'");
    expect(wrapper).toContain("stepsMore: 'Показать шаги 5–7'");
    expect(browserAcceptance).toContain("page.locator('#functions article')).toHaveCount(7)");
    expect(browserAcceptance).toContain("page.locator('#deal-path')).toHaveCount(0)");
    expect(strategicAcceptance).toContain("page.locator('#functions article')).toHaveCount(7)");
    expect(strategicAcceptance).toContain("page.locator('#deal-path')).toHaveCount(0)");
  });

  it('adds enterprise trust and a concrete connection process before the form', () => {
    expect(wrapper).toContain("id='trust'");
    expect(wrapper).toContain("id='connection-process'");
    expect(wrapper).toContain('element.type === OrganizationConnectForm');
    expect(wrapper).toContain('ConnectionProcess');
    expect(wrapper).toContain('TrustSection');
    expect(wrapper).toContain('От заявки до первой управляемой Сделки');
  });

  it('publishes a canonical RU EN ZH Trust Center without unsupported certification claims', () => {
    expect(trustContent).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(trustRoute).toContain("export { default } from '../../trust/page'");
    expect(trustRoute).toContain("canonical: '/platform-v7/trust'");
    expect(trustContent).toContain('Что платформа не заявляет без доказательств');
    expect(trustContent).toContain('ISO, SOC 2 или иная сертификация — без опубликованного подтверждения');
    expect(trustContent).toContain('TAI не получает самостоятельного права менять Сделку');
    expect(browserAcceptance).toContain("page.goto('/platform-v7/trust?lang=ru'");
  });

  it('keeps support and phone in the mobile menu while reducing the mobile dock to AI only', () => {
    expect(wrapper).toContain("pc-home-mobile-contact-link");
    expect(wrapper).toContain("href={SUPPORT_PHONE_HREF}");
    expect(css).toContain(".pc-site-mobile-nav .pc-home-mobile-contact-link");
    expect(css).toContain(".pc-public-contact-dock-action:not(.pc-public-contact-dock-assistant)");
    expect(css).toContain('display: none !important');
    expect(css).toContain('width: 56px !important');
    expect(css).toContain('left: auto !important');
    expect(css).toContain('padding-bottom: calc(82px + env(safe-area-inset-bottom, 0px))');
  });

  it('retains accessibility, reduced-motion and forced-colors contracts', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(trustContent).toContain("aria-labelledby='pc-trust-title'");
    expect(trustContent).toContain("aria-hidden='true'");
  });
});
