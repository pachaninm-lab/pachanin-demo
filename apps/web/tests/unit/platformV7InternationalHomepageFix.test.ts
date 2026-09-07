import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const wrapper = read('apps/web/components/platform-v7/PlatformV7StrategicHomeInternational.tsx');
const home = read('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
const siteHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const page = read('apps/web/app/platform-v7/page.tsx');
const story = read('apps/web/i18n/platform-v7-home-story-product.ts');
const css = read('apps/web/styles/platform-v7-international-home-fix.css');
const tsconfig = read('apps/web/tsconfig.json');
const trustContent = read('apps/web/app/trust/page.tsx');
const trustRoute = read('apps/web/app/platform-v7/trust/page.tsx');
const platformLayout = read('apps/web/app/platform-v7/layout.tsx');
const publicSeoRegistry = read('apps/web/lib/platform-v7/public-seo-routes.json');
const middleware = read('apps/web/middleware.ts');
const i18nRequest = read('apps/web/i18n/request.ts');

describe('platform-v7 international homepage completion', () => {
  it('keeps the existing alias but makes the wrapper a transparent delegator', () => {
    expect(tsconfig).toContain('"@/components/platform-v7/PlatformV7StrategicHome"');
    expect(tsconfig).toContain('PlatformV7StrategicHomeInternational.tsx');
    expect(wrapper).toContain("from './PlatformV7StrategicHome'");
    expect(wrapper).toContain('return BasePlatformV7StrategicHome();');
    expect(wrapper).not.toContain('cloneElement');
    expect(wrapper).not.toContain('Children.toArray');
    expect(wrapper).not.toContain("props.id === 'deal-path'");
    expect(wrapper).not.toContain("normalizedKey(element.key) === '08'");
  });

  it('keeps the canonical seven-step path and progress rails aligned', () => {
    expect(home).toContain("id='deal-path'");
    expect(story).toContain("processTitle: 'Семь шагов обычной агросделки'");
    expect(story).toContain("journey: '7 шагов'");
    expect(story).toContain("fullPathLabel: 'Обычный путь'");
    expect(story).not.toContain("navFunctions: '8 шагов Сделки'");
    expect(home).toContain('const heroCurrentStepIndex = Math.min(4, story.demo.stages.length - 1);');
    expect(home).toContain('aria-valuemax={story.demo.stages.length}');
    expect(home).toContain('aria-valuenow={heroCurrentStepIndex + 1}');
    expect(home).toContain('stageIndex < heroCurrentStepIndex ? styles.progressDone');
    expect(home).toContain('stageIndex === heroCurrentStepIndex ? styles.progressActive');
    expect(home).toContain('pc-public-deal-stage-rail--hero');
    expect(home).toContain('pc-public-deal-stage-rail--demo');
    expect(css).toContain('.pc-v7-public-entry .pc-public-deal-stage-rail');
    expect(css).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
    expect(css).toContain('.pc-v7-public-entry .pc-public-deal-stage-rail--demo');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it('keeps every visible Hero Deal card text node at the trusted fourteen-pixel floor', () => {
    expect(css).toContain("[data-testid='platform-v7-deal-card'] :where(span, small, b)");
    expect(css).toContain('font-size: 14px !important');
  });

  it('keeps full brand and registration together in one canonical 64px mobile header', () => {
    expect(home).toContain("<a href={registerHref} className='pc-v6-header-cta'>{copy.nav.connect}</a>");
    expect(siteHeader).toContain("data-public-site-header='canonical'");
    expect(siteHeader).toContain(".pc-site-header[data-public-site-header='canonical'].pc-site-header.pc-site-header");
    expect(siteHeader).toContain('flex-wrap: nowrap !important');
    expect(siteHeader).toContain('height: 64px !important');
    expect(siteHeader).toContain("<strong>Прозрачная Цена</strong>");
    expect(siteHeader).toContain('font-size: 14px !important');
    expect(siteHeader).toContain('white-space: normal !important');
    expect(siteHeader).toContain('min-width: 84px !important');
    expect(siteHeader).toContain(".pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] .entry-login > span");
    expect(siteHeader).toContain(".pc-v7-public-entry[data-testid='platform-v7-root-execution-cockpit'] .pc-v6-header-cta");
    expect(siteHeader).toContain('min-width: 44px !important');
    expect(siteHeader).not.toContain(".pc-site-brand-text {\n    display: none !important;");
    expect(css).not.toContain('--pc-public-header-total-height: 96px !important');
    expect(css).not.toContain('height: 96px !important');
    expect(css).not.toContain('flex-wrap: wrap !important');
    expect(page).not.toContain('--entry-public-header-base: 100px !important');
    expect(page).not.toContain('height: 100px !important');
    expect(page).not.toContain('--entry-public-header-base: 48px');
    expect(css).toContain('scroll-margin-top: calc(var(--pc-public-header-total-height, 64px) + 18px) !important');
  });

  it('keeps semantic homepage copy in normal DOM instead of CSS substitution', () => {
    expect(page).not.toContain('.pc-v6-kicker::before');
    expect(page).not.toContain('.pc-v6-kicker::after');
    expect(page).not.toContain('font-size: 0');
    expect(css).not.toContain('content:');
    expect(css).not.toContain('font-size: 0');
  });

  it('binds homepage metadata to the same server-authoritative RU EN ZH locale as visible copy', () => {
    expect(middleware).toContain("const queryLocale = req.nextUrl.searchParams.get('lang');");
    expect(middleware).toContain("requestHeaders.set('x-pc-locale', requestLocale)");
    expect(i18nRequest).toContain("const LOCALE_HEADER = 'x-pc-locale'");
    expect(i18nRequest).toContain('const headerLocale = headerStore.get(LOCALE_HEADER);');
    expect(page).toContain("import { getLocale } from 'next-intl/server';");
    expect(page).toContain('export async function generateMetadata(): Promise<Metadata>');
    expect(page).not.toContain('export const metadata: Metadata');
    expect(page).toContain("title: 'Transparent Price — one system for managing an agricultural Deal'");
    expect(page).toContain("title: '透明价格 — 农业交易统一管理系统'");
    expect(page).toContain("locale: locale === 'en' ? 'en_US' : locale === 'zh' ? 'zh_CN' : 'ru_RU'");
    expect(page).toContain("ru: '/platform-v7?lang=ru'");
    expect(page).toContain("en: '/platform-v7?lang=en'");
    expect(page).toContain("zh: '/platform-v7?lang=zh'");
  });

  it('does not recreate visitor copy or sections through compatibility CSS', () => {
    expect(css).not.toContain('.pc-home-trust');
    expect(css).not.toContain('.pc-home-connection-process');
    expect(css).not.toContain('content:');
    expect(css).not.toContain('font-size: 0');
    expect(css).toContain('.pc-v7-public-entry .pc-v6-footer');
    expect(css).toContain(".pc-public-contact-dock[data-assistant-context='public']");
  });

  it('publishes the canonical public RU EN ZH Trust Center without unsupported certification claims', () => {
    expect(trustContent).toContain("type Locale = 'ru' | 'en' | 'zh'");
    expect(trustRoute).toContain("import BaseTrustCenterPage from '../../trust/page'");
    expect(trustRoute).toContain('rebrandTrustCopy(await BaseTrustCenterPage(), locale)');
    expect(trustRoute).toContain("canonical: '/platform-v7/trust'");
    expect(platformLayout).toContain("'/platform-v7/trust',");
    const publicStart = platformLayout.indexOf('const PUBLIC_EXACT_PATHS');
    const aliasStart = platformLayout.indexOf('const ALIAS_EXACT_PATHS');
    const dynamicStart = platformLayout.indexOf('const ALIAS_DYNAMIC_PATHS');
    expect(platformLayout.slice(publicStart, aliasStart)).toContain("'/platform-v7/trust'");
    expect(platformLayout.slice(aliasStart, dynamicStart)).not.toContain("'/platform-v7/trust'");
    expect(publicSeoRegistry).toContain('"path": "/platform-v7/trust"');
    expect(trustContent).toContain('Что платформа не заявляет без доказательств');
    expect(trustContent).toContain('ISO, SOC 2 или иная сертификация — без опубликованного подтверждения');
    expect(trustContent).toContain('У Гекты нет самостоятельного права менять Сделку');
  });

  it('keeps the wide-desktop contact dock in a narrow non-text-obscuring rail', () => {
    expect(css).toContain('@media (min-width: 1180px)');
    expect(css).toContain('body:has(.pc-v7-public-entry)');
    expect(css).toContain('width: 54px !important');
    expect(css).toContain('grid-template-rows: repeat(3, 48px) !important');
    expect(css).toContain('width: 48px !important');
    expect(css).toContain('min-height: 48px !important');
    expect(css).toContain('.pc-public-contact-dock-action strong');
    expect(css).toContain('clip-path: inset(50%) !important');
  });

  it('retains mobile dock sizing, reduced-motion and forced-colors resilience', () => {
    expect(css).toContain('width: 56px !important');
    expect(css).toContain('min-height: 48px !important');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(trustContent).toContain("aria-labelledby='pc-trust-title'");
    expect(trustContent).toContain("aria-hidden='true'");
  });
});