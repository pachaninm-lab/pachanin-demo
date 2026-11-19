import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';
import Head from '@/app/platform-v7/head';
import { getGektaApplicationSchema } from '@/lib/gekta/seo';
import { CanonicalPublicHeader } from '@/components/platform-v7/PublicCanonicalPrimitives';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const sources = {
  assistant: read('components/platform-v7/PublicPlatformAssistant.tsx'),
  fullscreenController: read('components/platform-v7/UnifiedModalSheetFullscreenController.tsx'),
  contactDock: read('components/platform-v7/PublicContactDock.tsx'),
  dealIntelligence: read('components/platform-v7/PublicDealIntelligencePanel.tsx'),
  productPassport: read('components/platform-v7/PublicAiInActionSimpleExperience.tsx'),
  dealJourney: read('i18n/public-deal-journey-v5.ts'),
  hero: read('i18n/platform-v7-hero-message.ts'),
  homeOperating: read('i18n/platform-v7-home-v3-operating.ts'),
  homeStory: read('i18n/platform-v7-home-story-product.ts'),
  homeInternational: read('components/platform-v7/PlatformV7StrategicHomeInternational.tsx'),
  homeEnhancements: read('i18n/platform-v7-home-enhancements.ts'),
  platformPage: read('app/platform-v7/page.tsx'),
  platformHead: read('app/platform-v7/head.tsx'),
  passportPage: read('app/platform-v7/ai-in-action/page.tsx'),
} as const;

const visibleBrandSources = [
  sources.assistant,
  sources.fullscreenController,
  sources.contactDock,
  sources.dealIntelligence,
  sources.dealJourney,
  sources.hero,
  sources.homeOperating,
  sources.homeStory,
  sources.homeInternational,
  sources.homeEnhancements,
  sources.platformPage,
  sources.platformHead,
  sources.passportPage,
].join('\n');

const allBrandSources = Object.values(sources).join('\n');

describe('Gekta public brand contract', () => {
  it.each(['home', 'public'])('keeps the canonical 48px mobile menu in the %s small-screen stylesheet', surface => {
    const css = parse(read('styles/platform-v7-canonical-' + surface + '-v1.css'));
    const sizing = new Map<string, string>();
    css.walkAtRules('media', media => {
      if (media.params.replace(/\s/g, '') !== '(max-width:760px)') return;
      media.walkRules(rule => {
        if (!rule.selectors.some(selector => selector.replace(/\s+/g, '').endsWith('.pc-site-mobile-menu>summary'))) return;
        rule.walkDecls(decl => { sizing.set(decl.prop, decl.value); });
      });
    });
    for (const property of ['width', 'min-width', 'height', 'min-height']) expect(sizing.get(property)).toBe('48px');
  });

  it('provides a full registration label inside the compact mobile menu', () => {
    const labels = { ru: ['Подать заявку', 'Подать заявку на подключение'], en: ['Apply for access', 'Apply for platform access'], zh: ['申请接入', '申请接入平台'] };
    for (const locale of ['ru', 'en', 'zh'] as const) {
      const html = renderToStaticMarkup(createElement(CanonicalPublicHeader, { locale, localeControl: createElement('span') }));
      const dom = new DOMParser().parseFromString(html, 'text/html');
      const link = dom.querySelector('header details a[href="/platform-v7/register?lang=' + locale + '"]');
      expect(link?.textContent).toBe(labels[locale][0]);
      expect(link?.getAttribute('aria-label')).toBe(labels[locale][1]);
    }
  });

  it('uses the canonical Russian brand, descriptor and action language', () => {
    expect(sources.assistant).toContain("open: 'Спросить Гекту'");
    expect(sources.assistant).toContain("title: 'Гекта'");
    expect(sources.assistant).toContain("subtitle: 'ИИ для сельского хозяйства и агробизнеса от «Прозрачной Цены»'");
    expect(sources.fullscreenController).not.toContain('PUBLIC_ASSISTANT_BRANDING');
    expect(sources.contactDock).toContain("assistant: 'Гекта'");
    expect(sources.contactDock).toContain("assistantAria: 'Открыть Гекту'");
    expect(sources.dealJourney).toContain("askTai: 'Спросить Гекту об этом этапе'");
    expect(sources.hero).toContain('Гекта помогает разобрать факты и риск, но не принимает решение вместо человека.');
    expect(sources.homeStory).toContain("label: 'Гекта'");
    expect(sources.homeStory).toContain("title: 'Контроль и Гекта'");
    expect(sources.productPassport).toContain("title: 'Гекта объясняет, что происходит в Сделке и что делать дальше'");
    expect(sources.dealIntelligence).toContain("title: 'Гекта · Сводка для покупателя'");
  });

  it('uses Gekta consistently in English and Chinese public copy', () => {
    expect(sources.assistant).toContain("open: 'Ask Gekta'");
    expect(sources.assistant).toContain("title: 'Gekta'");
    expect(sources.contactDock).toContain("assistant: 'Gekta'");
    expect(sources.contactDock).toContain("assistantAria: 'Open Gekta'");
    expect(sources.dealJourney).toContain("askTai: 'Ask Gekta about this stage'");
    expect(sources.dealJourney).toContain("askTai: '向 Gekta 询问当前阶段'");
    expect(sources.hero).toContain('Gekta helps interpret facts and risk but does not decide instead of the user.');
    expect(sources.hero).toContain('Gekta 帮助理解事实和风险，但不会替用户作出决定。');
    expect(sources.productPassport).toContain('Gekta explains what is happening in the Deal and what comes next');
    expect(sources.productPassport).toContain('Gekta 解释交易中正在发生什么，以及下一步做什么');
  });

  it('publishes a named Gekta application at its standalone URL and keeps the Deal explainer discoverable', () => {
    const html = renderToStaticMarkup(createElement(Head));
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const graph = JSON.parse(dom.querySelector('script[type="application/ld+json"]')!.textContent!)['@graph'];
    const product = graph.find((item: { name?: string }) => item.name === 'Гекта');
    const standalone = getGektaApplicationSchema('ru');
    expect(product).toMatchObject({ '@type': 'SoftwareApplication', name: standalone.name, url: standalone.url });
    expect(product.alternateName).toEqual(expect.arrayContaining(['Gekta', 'ГЕКТА']));
    const list = graph.find((item: { '@type': string }) => item['@type'] === 'ItemList');
    const explainer = list.itemListElement.find((item: { name: string }) => item.name === 'Гекта в сделке');
    expect(new URL(explainer.url).href).toBe(new URL('/platform-v7/ai-in-action', standalone.url).href);
    for (const lang of ['en', 'zh'] as const) expect(new URL(getGektaApplicationSchema(lang).url).pathname).toBe('/gekta/' + lang);
  });

  it('keeps the international alias wrapper transparent instead of creating a second brand authority', () => {
    expect(sources.homeInternational).toContain('return BasePlatformV7StrategicHome();');
    expect(sources.homeInternational).not.toContain("title: 'Гекта");
    expect(sources.homeInternational).not.toContain("title: 'Gekta");
    expect(sources.homeInternational).not.toContain('cloneElement');
  });

  it('does not expose the retired TAI identity in visitor-visible governed sources', () => {
    expect(visibleBrandSources).not.toMatch(/\bTAI\b/u);
    for (const retired of [
      'Спросить ИИ',
      'Открыть ИИ-помощника по платформе',
      'Open the platform AI assistant',
      '打开平台 AI 助手',
      'Transparent Agro Intelligence',
      'TAI Гекта',
    ]) expect(visibleBrandSources).not.toContain(retired);
  });

  it('permits retired machine markers only in hidden release-compat metadata', () => {
    const marker = "<span hidden aria-hidden='true' data-release-compat='ai-passport'>TAI — доказательный уровень исполнения сделки · NOT_ATTESTED · TAI готовит — человек подтверждает — адаптер исполняет</span>";
    expect(sources.productPassport).toContain(marker);
    const withoutMarker = sources.productPassport.replace(marker, '');
    expect(withoutMarker).not.toMatch(/\bTAI\b/u);
    expect(withoutMarker).not.toContain('NOT_ATTESTED');
  });

  it('rejects forbidden Gekta spellings without banning generic AI terminology', () => {
    // The instrumental «Гектой» is a valid inflection of the Russian name.
    const misspelling = /(?<![\p{L}\p{M}])Гекто(?![\p{L}\p{M}])/iu;
    expect('Спросить Гекто.').toMatch(misspelling);
    expect(allBrandSources).not.toMatch(misspelling);
    for (const forbidden of ['Gekto', 'Hekta', 'Gecta', 'TAI Гекта']) {
      expect(allBrandSources).not.toContain(forbidden);
    }
    expect(sources.assistant).toContain("import type { GatewayRefusal } from '@pc/ai-assistant-stream-contract';");
    expect(sources.platformHead).toContain('const taiUrl =');
    expect(sources.dealJourney).toContain('taiPrompts:');
  });

  it('moves transcripts to the Gekta key while preserving one-time legacy recovery', () => {
    expect(sources.assistant).toContain('return `pc-gekta-assistant-v1:${locale}`;');
    expect(sources.assistant).toContain('return [`pc-public-assistant-v2:${locale}`] as const;');
    expect(sources.assistant).toContain('const stored = window.sessionStorage.getItem(primaryKey);');
    expect(sources.assistant).toContain('const legacyStored = window.sessionStorage.getItem(legacyKey);');
    expect(sources.assistant).toContain('const migrated = safeStoredMessages(JSON.parse(legacyStored));');
    expect(sources.assistant).toContain('window.sessionStorage.setItem(primaryKey, JSON.stringify(migrated));');
    expect(sources.assistant).toContain('window.sessionStorage.removeItem(legacyKey);');
  });
});
