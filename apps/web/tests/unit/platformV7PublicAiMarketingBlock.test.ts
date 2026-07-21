import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 integrated public intelligence context', () => {
  const page = read('app/platform-v7/page.tsx');
  const hero = read('components/platform-v7/PublicHeroIntelligenceStatus.tsx');
  const preview = read('components/platform-v7/PublicDealPreview.tsx');
  const panel = read('components/platform-v7/PublicDealIntelligencePanel.tsx');
  const roles = read('components/platform-v7/PublicRoleIntelligenceSummary.tsx');
  const evidence = read('components/platform-v7/PublicEvidenceIntelligencePanel.tsx');
  const government = read('components/platform-v7/PublicGovernmentDataContour.tsx');

  it('keeps the platform as the first screen and embeds TAI without a second hero', () => {
    expect(page).toContain("id='pc-ppe-hero-title'");
    expect(page).toContain("id='ai-copilot'");
    expect(page).toContain('<PublicHeroIntelligenceStatus locale={locale} mode=\'metrics\' />');
    expect(page).toContain('<PublicHeroIntelligenceStatus locale={locale} mode=\'status\' />');
    expect(page).toContain("const aiExperienceHref = `/platform-v7/ai-in-action?lang=${encodeURIComponent(locale)}`;");
    expect(page).toContain("eventName='ai_in_action_opened'");
    expect(page).not.toContain("label: 'ИИ работает в платформе'");
    expect(page).not.toContain('PublicAiMarketingBlock');

    const titleIndex = page.indexOf("id='pc-ppe-hero-title'");
    const intelligenceIndex = page.indexOf("id='ai-copilot'");
    const actionsIndex = page.indexOf("className='pc-ppe-hero-actions'");
    const dealIndex = page.indexOf("id='deal-example'");
    expect(titleIndex).toBeGreaterThan(-1);
    expect(intelligenceIndex).toBeGreaterThan(titleIndex);
    expect(actionsIndex).toBeGreaterThan(intelligenceIndex);
    expect(dealIndex).toBeGreaterThan(actionsIndex);
  });

  it('uses result-oriented public copy in RU EN ZH', () => {
    expect(page).toContain("kicker: 'Исполнение внебиржевой сделки в АПК'");
    expect(page).toContain("title: 'Сделка под контролем — от условий до расчёта'");
    expect(page).toContain('TAI анализирует доступный контекст сделки');
    expect(page).toContain('TAI analyses the available deal context');
    expect(page).toContain('TAI 分析可用的交易上下文');
    expect(hero).toContain("demo: 'Публичный пример'");
    expect(hero).toContain('3 основания сценария подтверждены');
  });

  it('connects deal lenses to a role-aware evidence panel', () => {
    expect(preview).toContain('<PublicDealIntelligencePanel locale={locale} lens={lens} />');
    expect(preview).toContain("const previewLenses: readonly PublicDealLens[] = ['execution', 'documents', 'money', 'risk'];");
    expect(preview).toContain("emit('deal_intelligence_lens_changed'");
    expect(panel).toContain("title: 'TAI · Сводка для покупателя'");
    expect(panel).toContain('Государственное основание');
    expect(panel).toContain('Не проверено: подключение организации не подтверждено');
    expect(panel).toContain('Ничего не отправлено и не изменено без подтверждения пользователя');
  });

  it('adds role value, evidence causality and a safe government contour', () => {
    expect(page).toContain('<PublicRoleIntelligenceSummary perspective={perspective} locale={locale} />');
    expect(roles).toContain('Показывает блокеры приёмки, качества и расчёта');
    expect(page).toContain('<PublicEvidenceIntelligencePanel');
    expect(evidence).toContain('TAI не придумывает состояние сделки');
    expect(page).toContain('<PublicGovernmentDataContour locale={locale} />');
    expect(government).toContain("status: 'PUBLIC_REGISTRY'");
    expect(government).toContain("status: 'OFFICIAL_ACCESS_REQUIRED'");
    expect(government).not.toContain("status: 'CONNECTED'");
  });
});
