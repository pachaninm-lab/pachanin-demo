import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public AI marketing context', () => {
  const page = read('app/platform-v7/page.tsx');
  const block = read('components/platform-v7/PublicAiMarketingBlock.tsx');
  const styles = read('components/platform-v7/PublicAiMarketingBlock.module.css');

  it('places the future AI value between the deal example and role workspaces', () => {
    expect(page).toContain("import { PublicAiMarketingBlock } from '@/components/platform-v7/PublicAiMarketingBlock';");
    expect(page).toContain("<a href='#ai-copilot'>{aiNavLabel}</a>");
    expect(page).toContain('<PublicAiMarketingBlock locale={locale} roleEntryHref={roleEntryHref} />');

    const dealIndex = page.indexOf("id='deal-example'");
    const aiIndex = page.indexOf('<PublicAiMarketingBlock');
    const participantsIndex = page.indexOf("id='participants'");

    expect(dealIndex).toBeGreaterThan(-1);
    expect(aiIndex).toBeGreaterThan(dealIndex);
    expect(participantsIndex).toBeGreaterThan(aiIndex);
  });

  it('markets the target outcome without claiming the capability is already live', () => {
    expect(block).toContain("eyebrow: 'ИИ в целевой версии платформы'");
    expect(block).toContain("После запуска полноценного ИИ");
    expect(block).toContain("Увидит риск до срыва");
    expect(block).toContain("Объяснит на фактах");
    expect(block).toContain("Подготовит следующий шаг");
    expect(block).toContain("Целевой контур будет вводиться поэтапно");
    expect(block).toContain("Пример будущего сигнала");
    expect(block).toContain("только после подтверждения пользователя");
    expect(block).not.toContain('ИИ уже анализирует');
    expect(block).not.toContain('самостоятельно выполняет');
  });

  it('uses a semantic evidence-led structure with one measurable next step', () => {
    expect(block).toContain("id='ai-copilot'");
    expect(block).toContain("aria-labelledby='pc-ppe-ai-title'");
    expect(block).toContain("data-testid='platform-v7-ai-future-value'");
    expect(block).toContain('<ul className={styles.capabilities}>');
    expect(block).toContain('<dl className={styles.scenarioFacts}>');
    expect(block).toContain("role='note'");
    expect(block).toContain("eventName='ai_future_value_role_cta'");
    expect(block).toContain("params={{ source: 'home_ai_future_value' }}");
  });

  it('covers RU, EN and ZH and remains responsive and accessible', () => {
    expect(block).toContain("en: {");
    expect(block).toContain("zh: {");
    expect(block).toContain('See risk earlier. Understand the cause. Move to action faster.');
    expect(block).toContain('更早发现风险，理解原因，更快进入下一步。');
    expect(styles).toContain('grid-template-columns: minmax(0, 1.08fr) minmax(340px, .92fr)');
    expect(styles).toContain('@media (max-width: 900px)');
    expect(styles).toContain('@media (max-width: 720px)');
    expect(styles).toContain('@media (max-width: 380px)');
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('min-height: 52px');
  });
});
