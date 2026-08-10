import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'components/platform-v7/PublicPlatformAssistant.tsx'), 'utf8');

describe('public Gekta domain copy', () => {
  it('renders the canonical Gekta identity directly in RU, EN and ZH', () => {
    expect(source).toContain("open: 'Спросить Гекту'");
    expect(source).toContain("title: 'Гекта'");
    expect(source).toContain("subtitle: 'Аграрный интеллект для земли, урожая и решений.'");
    expect(source).toContain("open: 'Ask Gekta'");
    expect(source).toContain("title: 'Gekta'");
    expect(source).toContain("subtitle: 'Agricultural intelligence for land, crops and decisions.'");
    expect(source).toContain("open: '询问 Gekta'");
    expect(source).toContain("subtitle: '服务于土地、作物与决策的农业智能。'");
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
