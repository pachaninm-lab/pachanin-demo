import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'components/platform-v7/PublicPlatformAssistant.tsx'), 'utf8');

describe('public Gekta domain copy', () => {
  it('renders the canonical Gekta identity directly in RU, EN and ZH', () => {
    expect(source).toContain("open: 'Спросить Гекту'");
    expect(source).toContain("title: 'Гекта'");
    expect(source).toContain("subtitle: 'ИИ для сельского хозяйства и агробизнеса от «Прозрачной Цены»'");
    expect(source).toContain("open: 'Ask Gekta'");
    expect(source).toContain("title: 'Gekta'");
    expect(source).toContain("subtitle: 'AI for farming and agribusiness by Prozrachnaya Tsena'");
    expect(source).toContain("open: '询问 Gekta'");
    expect(source).toContain("subtitle: '“透明价格”推出的农业与农业经营 AI'");
  });

  it('keeps the agricultural composer scope and removes legacy public identity copy', () => {
    expect(source).toContain("placeholder: 'Спроси Гекту о земле, урожае или агробизнесе'");
    expect(source).toContain("placeholder: 'Ask Gekta about land, crops or agribusiness'");
    expect(source).toContain("placeholder: '向 Gekta 咨询土地、作物或农业经营'");
    expect(source).not.toContain("open: 'Спросить ИИ'");
    expect(source).not.toContain("shortcutHint: 'ИИ-помощник'");
    expect(source).not.toContain("title: 'ИИ для агробизнеса'");
    expect(source).not.toContain("title: 'ИИ Прозрачной Цены'");
    expect(source).not.toContain("subtitle: 'Помощник по агробизнесу и платформе'");
    expect(source).not.toContain("subtitle: 'Помощник по платформе'");
  });

  it('migrates the legacy transcript into the Gekta storage key', () => {
    expect(source).toContain('pc-gekta-assistant-v1:${locale}');
    expect(source).toContain('pc-public-assistant-v2:${locale}');
    expect(source).toContain('window.sessionStorage.setItem(primaryKey, JSON.stringify(migrated));');
    expect(source).toContain('window.sessionStorage.removeItem(legacyKey);');
  });
});
