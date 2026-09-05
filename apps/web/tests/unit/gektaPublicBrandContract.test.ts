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
  homeStory: read('i18n/platform-v7-home-story-product.ts'),
  homeInternational: read('components/platform-v7/PlatformV7StrategicHomeInternational.tsx'),
  homeEnhancements: read('i18n/platform-v7-home-enhancements.ts'),
  platformPage: read('app/platform-v7/page.tsx'),
  platformHead: read('app/platform-v7/head.tsx'),
  passportPage: read('app/platform-v7/ai-in-action/page.tsx'),
} as const;

const publicBrandSources = Object.values(sources).join('\n');

describe('Gekta public brand contract', () => {
  it('uses the canonical Russian brand, descriptor and action language', () => {
    expect(sources.assistant).toContain("open: 'Спросить Гекту'");
    expect(sources.assistant).toContain("title: 'Гекта'");
    expect(sources.assistant).toContain("subtitle: 'ИИ для сельского хозяйства и агробизнеса от «Прозрачной Цены»'");
    expect(sources.fullscreenController).not.toContain('PUBLIC_ASSISTANT_BRANDING');
    expect(sources.contactDock).toContain("assistant: 'Гекта'");
    expect(sources.contactDock).toContain("assistantAria: 'Открыть Гекту'");
    expect(sources.dealJourney).toContain("askTai: 'Спросить Гекту об этом этапе'");
    expect(sources.hero).toContain('Гекта сопоставляет доступные факты');
    expect(sources.homeStory).toContain("label: 'Гекта'");
    expect(sources.homeStory).toContain("title: 'Контроль и Гекта'");
    expect(sources.productPassport).toContain("title: 'Гекта объясняет состояние Сделки и следующий шаг по доступным основаниям'");
    expect(sources.dealIntelligence).toContain("title: 'Гекта · Сводка для покупателя'");
  });

  it('uses Gekta consistently in English and Chinese public copy', () => {
    expect(sources.assistant).toContain("open: 'Ask Gekta'");
    expect(sources.assistant).toContain("title: 'Gekta'");
    expect(sources.contactDock).toContain("assistant: 'Gekta'");
    expect(sources.contactDock).toContain("assistantAria: 'Open Gekta'");
    expect(sources.dealJourney).toContain("askTai: 'Ask Gekta about this stage'");
    expect(sources.dealJourney).toContain("askTai: '向 Gekta 询问当前阶段'");
    expect(sources.hero).toContain('Gekta compares available facts');
    expect(sources.hero).toContain('Gekta 对照可用事实');
    expect(sources.productPassport).toContain('Gekta explains Deal state and the next step from available evidence');
    expect(sources.productPassport).toContain('Gekta 根据可用依据解释交易状态和下一步');
  });

  it('publishes Gekta as a named SoftwareApplication and a human-readable public route', () => {
    expect(sources.platformHead).toContain("name: 'Гекта'");
    expect(sources.platformHead).toContain("alternateName: ['Gekta', 'ГЕКТА', 'Аграрный интеллект для земли, урожая и решений']");
    expect(sources.platformHead).toContain("name: 'Гекта — аграрный интеллект для земли, урожая и решений'");
    expect(sources.platformPage).toContain('аграрным интеллектом Гекта');
    expect(sources.passportPage).toContain("title: 'Гекта в работе — Прозрачная Цена'");
    expect(sources.passportPage).toContain("canonical: '/platform-v7/ai-in-action'");
  });

  it('keeps the international alias wrapper transparent instead of creating a second brand authority', () => {
    expect(sources.homeInternational).toContain('return BasePlatformV7StrategicHome();');
    expect(sources.homeInternational).not.toContain("title: 'Гекта");
    expect(sources.homeInternational).not.toContain("title: 'Gekta");
    expect(sources.homeInternational).not.toContain('cloneElement');
  });

  it('does not expose the retired TAI identity on the governed public surfaces', () => {
    expect(publicBrandSources).not.toMatch(/\bTAI\b/u);
    for (const retired of [
      'Спросить ИИ',
      'Открыть ИИ-помощника по платформе',
      'Open the platform AI assistant',
      '打开平台 AI 助手',
      'Transparent Agro Intelligence',
      'TAI Гекта',
    ]) expect(publicBrandSources).not.toContain(retired);
  });

  it('rejects forbidden Gekta spellings without banning generic AI terminology', () => {
    for (const forbidden of ['Гекто', 'Gekto', 'Hekta', 'Gecta', 'TAI Гекта']) {
      expect(publicBrandSources).not.toContain(forbidden);
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
