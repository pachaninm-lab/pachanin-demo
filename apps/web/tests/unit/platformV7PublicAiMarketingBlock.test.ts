import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public AI marketing context', () => {
  const page = read('app/platform-v7/page.tsx');

  it('places the target AI value inside the first-screen hero', () => {
    expect(page).toContain("const firstScreenAiCopy = {");
    expect(page).toContain("id='ai-copilot'");
    expect(page).toContain("data-testid='platform-v7-ai-future-value'");
    expect(page).toContain("<a href='#ai-copilot'>{aiNavLabel}</a>");
    expect(page).not.toContain("import { PublicAiMarketingBlock }");
    expect(page).not.toContain('<PublicAiMarketingBlock');

    const heroTitleIndex = page.indexOf("id='pc-ppe-hero-title'");
    const aiIndex = page.indexOf("id='ai-copilot'");
    const actionsIndex = page.indexOf("className='pc-ppe-hero-actions'");
    const dealIndex = page.indexOf("id='deal-example'");

    expect(heroTitleIndex).toBeGreaterThan(-1);
    expect(aiIndex).toBeGreaterThan(heroTitleIndex);
    expect(actionsIndex).toBeGreaterThan(aiIndex);
    expect(dealIndex).toBeGreaterThan(actionsIndex);
  });

  it('markets the future outcome without claiming that it is live', () => {
    expect(page).toContain("label: 'После запуска полноценного ИИ'");
    expect(page).toContain('Платформа будет раньше находить риск сделки');
    expect(page).toContain('объяснять причину и готовить следующий шаг');
    expect(page).toContain('Критические действия останутся под подтверждением человека');
    expect(page).not.toContain('ИИ уже анализирует');
    expect(page).not.toContain('самостоятельно выполняет');
  });

  it('keeps the public boundary and all supported locales', () => {
    expect(page).toContain('обезличенный демонстрационный сценарий');
    expect(page).toContain("label: 'Once the full AI layer is launched'");
    expect(page).toContain('Consequential actions will remain subject to human confirmation');
    expect(page).toContain("label: '完整 AI 上线后'");
    expect(page).toContain('重要操作仍需人工确认');
  });
});
