import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
  homeStory: read('i18n/platform-v7-home-story.ts'),
  homeInternational: read('components/platform-v7/PlatformV7StrategicHomeInternational.tsx'),
  homeEnhancements: read('i18n/platform-v7-home-enhancements.ts'),
  platformPage: read('app/platform-v7/page.tsx'),
  platformHead: read('app/platform-v7/head.tsx'),
  passportPage: read('app/platform-v7/ai-in-action/page.tsx'),
} as const;

const publicBrandSources = Object.values(sources).join('\n');

describe('Gekta public brand contract', () => {
  it('uses the canonical Russian brand, descriptor and CTA', () => {
    expect(sources.assistant).toContain("open: 'Спросить Гекту'");
    expect(sources.assistant).toContain("title: 'Гекта'");
    expect(sources.assistant).toContain("subtitle: 'ИИ для сельского хозяйства и агробизнеса от «Прозрачной Цены»'");
    expect(sources.fullscreenController).not.toContain('PUBLIC_ASSISTANT_BRANDING');
    expect(sources.contactDock).toContain("assistant: 'Гекта'");
    expect(sources.contactDock).toContain("assistantAria: 'Открыть Гекту'");
    expect(sources.dealJourney).toContain("askTai: 'Спросить Гекту об этом этапе'");
    expect(sources.dealJourney).toContain('Гекта объясняет текущий статус и риск');
    expect(sources.hero).toContain('Гекта сопоставляет факты');
    expect(sources.homeOperating).toContain("tertiary: 'Посмотреть Гекту в работе'");
    expect(sources.homeStory).toContain("title: 'Гекта — интеллектуальный слой конкретной Сделки'");
    expect(sources.homeStory).toContain("title: 'Гекта воздержалась от вывода'");
    expect(sources.homeStory).toContain("cta: 'Посмотреть Гекту в работе'");
    expect(sources.homeInternational).toContain("title: 'Гекта в процессе'");
    expect(sources.homeEnhancements).toContain("name: 'Гекта'");
    expect(sources.productPassport).toContain("title: 'Гекта — доказательный уровень исполнения сделки'");
    expect(sources.dealIntelligence).toContain("title: 'Гекта · Сводка для покупателя'");
  });

  it('uses Gekta consistently in English and Chinese public copy', () => {
    expect(sources.assistant).toContain("open: 'Ask Gekta'");
    expect(sources.assistant).toContain("title: 'Gekta'");
    expect(sources.contactDock).toContain("assistant: 'Gekta'");
    expect(sources.contactDock).toContain("assistantAria: 'Open Gekta'");
    expect(sources.dealJourney).toContain("askTai: 'Ask Gekta about this stage'");
    expect(sources.dealJourney).toContain("askTai: '向 Gekta 询问当前阶段'");
    expect(sources.hero).toContain('Gekta matches facts');
    expect(sources.homeStory).toContain("title: 'Gekta is the intelligence layer of a specific Deal'");
    expect(sources.homeStory).toContain("title: 'Gekta 是具体交易的智能层'");
    expect(sources.homeInternational).toContain("title: 'Gekta in the workflow'");
    expect(sources.homeInternational).toContain("title: '流程内的 Gekta'");
    expect(sources.hero).toContain('Gekta 对照事实');
    expect(sources.productPassport).toContain("title: 'Gekta is the evidence layer of deal execution'");
    expect(sources.productPassport).toContain("title: 'Gekta 是交易执行的证据层'");
  });

  it('publishes Gekta as a named SoftwareApplication and public entry point', () => {
    expect(sources.platformHead).toContain("name: 'Гекта'");
    expect(sources.platformHead).toContain("alternateName: ['Gekta', 'ГЕКТА', 'Аграрный интеллект для земли, урожая и решений']");
    expect(sources.platformHead).toContain("name: 'Гекта — аграрный интеллект для земли, урожая и решений'");
    expect(sources.platformPage).toContain('аграрным интеллектом Гекта');
    expect(sources.passportPage).toContain("title: 'Паспорт аграрного интеллекта Гекта — Прозрачная Цена'");
  });

  it('does not expose the retired TAI identity on the governed public surfaces', () => {
    expect(publicBrandSources).not.toMatch(/\bTAI\b/u);

    const retiredVisibleCopy = [
      'Спросить ИИ',
      'Открыть ИИ-помощника по платформе',
      'Open the platform AI assistant',
      '打开平台 AI 助手',
      'Transparent Agro Intelligence',
      'ИИ для агробизнеса',
      'Разработан Прозрачной ценой для сельского хозяйства.',
      'AI for agribusiness',
      'Developed by Transparent Price for agriculture.',
      '农业商业人工智能',
      '由“透明价格”为农业打造。',
    ];

    for (const retired of retiredVisibleCopy) {
      expect(publicBrandSources).not.toContain(retired);
    }
  });

  it('rejects forbidden Gekta spellings without banning generic AI terminology', () => {
    for (const forbidden of ['Гекто', 'Gekto', 'Hekta', 'Gecta', 'TAI Гекта']) {
      expect(publicBrandSources).not.toContain(forbidden);
    }

    // Generic AI terminology and stable internal contracts are not the product
    // name. R1 changes the public brand without pretending R2/R3 already ran.
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
