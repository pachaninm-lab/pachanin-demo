import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public AI marketing context', () => {
  const page = read('app/platform-v7/page.tsx');
  const block = read('components/platform-v7/PublicAiMarketingBlock.tsx');

  it('places the active AI value inside the first-screen hero and links to the interactive explanation', () => {
    expect(page).toContain("const firstScreenAiCopy = {");
    expect(page).toContain("id='ai-copilot'");
    expect(page).toContain("data-testid='platform-v7-ai-current-value'");
    expect(page).toContain("<a href='#ai-copilot'>{aiNavLabel}</a>");
    expect(page).toContain("const aiExperienceHref = `/platform-v7/demo/ai?lang=${encodeURIComponent(locale)}`;");
    expect(page).toContain("href={aiExperienceHref}");
    expect(page).toContain("className='pc-ppe-ai-status-link'");
    expect(page).toContain("eventName='ai_in_action_opened'");
    expect(page).toContain("params={{ source: 'home_ai_status' }}");
    expect(page).not.toContain("import { PublicAiMarketingBlock }");
    expect(page).not.toContain('<PublicAiMarketingBlock');

    const heroTitleIndex = page.indexOf("id='pc-ppe-hero-title'");
    const aiIndex = page.indexOf("id='ai-copilot'");
    const aiLinkIndex = page.indexOf("href={aiExperienceHref}");
    const actionsIndex = page.indexOf("className='pc-ppe-hero-actions'");
    const dealIndex = page.indexOf("id='deal-example'");

    expect(heroTitleIndex).toBeGreaterThan(-1);
    expect(aiIndex).toBeGreaterThan(heroTitleIndex);
    expect(aiLinkIndex).toBeGreaterThan(aiIndex);
    expect(actionsIndex).toBeGreaterThan(aiLinkIndex);
    expect(dealIndex).toBeGreaterThan(actionsIndex);
  });

  it('describes the implemented role-scoped capability in present tense', () => {
    expect(page).toContain("label: 'ИИ работает в платформе'");
    expect(page).toContain('ИИ анализирует доступные данные сделки');
    expect(page).toContain('выявляет риски, объясняет причины и готовит следующий шаг');
    expect(page).toContain('Критические действия остаются за участником и требуют подтверждения');
    expect(page).not.toContain('После запуска полноценного ИИ');
    expect(page).not.toContain('Платформа будет раньше находить риск сделки');
    expect(page).not.toContain('самостоятельно выполняет');
  });

  it('keeps the public boundary and all supported locales', () => {
    expect(page).toContain('обезличенный демонстрационный сценарий');
    expect(page).toContain("label: 'AI is active in the platform'");
    expect(page).toContain('AI analyses accessible deal data');
    expect(page).toContain('Consequential actions remain with the authorised participant and require confirmation');
    expect(page).toContain("label: 'AI 已在平台中运行'");
    expect(page).toContain('重要操作仍由获授权的参与方执行并确认');
  });

  it('keeps the reusable marketing block aligned with the current capability', () => {
    expect(block).toContain("eyebrow: 'ИИ работает в платформе'");
    expect(block).toContain("title: 'Выявляет риск'");
    expect(block).toContain("title: 'Объясняет на фактах'");
    expect(block).toContain("title: 'Формирует следующий шаг'");
    expect(block).toContain('ИИ работает только в доступном ролевом контуре');
    expect(block).toContain("badge: 'Пример сигнала ИИ'");
    expect(block).toContain('Отправку и любые критические действия подтверждает пользователь');
    expect(block).toContain("data-testid='platform-v7-ai-current-value'");
    expect(block).toContain("eventName='ai_current_value_role_cta'");
    expect(block).not.toContain('ИИ в целевой версии платформы');
    expect(block).not.toContain('Пример будущего сигнала');
    expect(block).not.toContain('будет вводиться поэтапно');
  });
});
