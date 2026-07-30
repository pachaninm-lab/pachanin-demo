import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'components/platform-v7/PublicPlatformAssistant.tsx'), 'utf8');

describe('public AI domain copy', () => {
  it('renders the canonical agribusiness identity directly in RU, EN and ZH', () => {
    expect(source).toContain("title: 'ИИ для агробизнеса'");
    expect(source).toContain("subtitle: 'Разработан Прозрачной ценой для сельского хозяйства.'");
    expect(source).toContain("title: 'AI for agribusiness'");
    expect(source).toContain("subtitle: 'Developed by Transparent Price for agriculture.'");
    expect(source).toContain("title: '农业商业人工智能'");
    expect(source).toContain("subtitle: '由“透明价格”为农业打造。'");
  });

  it('keeps the agribusiness composer scope and removes legacy identity copy', () => {
    expect(source).toContain("placeholder: 'Задай вопрос об агробизнесе или платформе'");
    expect(source).toContain("placeholder: 'Ask about agribusiness or the platform'");
    expect(source).toContain("placeholder: '询问农业商业或平台问题'");
    expect(source).not.toContain("title: 'ИИ Прозрачной Цены'");
    expect(source).not.toContain("subtitle: 'Помощник по агробизнесу и платформе'");
    expect(source).not.toContain("subtitle: 'Помощник по платформе'");
  });
});
