import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 deal assistant drawer language', () => {
  const drawer = readFileSync(join(process.cwd(), 'components/v9/ai/AiDrawer.tsx'), 'utf8');

  it('uses user-facing deal assistant wording', () => {
    expect(drawer).toContain('Помощник сделки');
    expect(drawer).toContain('тестовый контур');
    expect(drawer).toContain('выпуск');
    expect(drawer).toContain('удержание');
    expect(drawer).toContain('ответ банка');
  });

  it('keeps recommendations attached to concrete execution objects', () => {
    expect(drawer).toContain('DL-9102');
    expect(drawer).toContain('DK-2024-89');
    expect(drawer).toContain('Банк ·');
    expect(drawer).toContain('/platform-v7/disputes/DK-2024-89');
    expect(drawer).toContain('/platform-v7/bank');
  });
});
