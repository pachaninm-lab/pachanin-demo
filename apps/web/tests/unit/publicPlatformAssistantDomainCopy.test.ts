import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'components/platform-v7/PublicPlatformAssistant.tsx'), 'utf8');

describe('public AI domain copy', () => {
  it('presents agriculture, agribusiness and platform scope in RU, EN and ZH', () => {
    expect(source).toContain("subtitle: 'Помощник по агробизнесу и платформе'");
    expect(source).toContain("placeholder: 'Задай вопрос об агробизнесе или платформе'");
    expect(source).toContain("subtitle: 'Agribusiness and platform assistant'");
    expect(source).toContain("placeholder: 'Ask about agribusiness or the platform'");
    expect(source).toContain("subtitle: '农业商业与平台助手'");
    expect(source).toContain("placeholder: '询问农业商业或平台问题'");
  });

  it('removes the platform-only positioning', () => {
    expect(source).not.toContain("subtitle: 'Помощник по платформе'");
    expect(source).not.toContain("placeholder: 'Задай вопрос о платформе'");
  });
});
