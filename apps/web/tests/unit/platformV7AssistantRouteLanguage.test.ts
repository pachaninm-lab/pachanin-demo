import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const forbidden = [
  'AI-',
  'AI ',
  'Control Tower',
  'fake-live',
  'sandbox',
  'reserve / hold / release',
  'owner / blocker',
  'manual review',
  'callback / mismatch',
];

describe('platform-v7 assistant route language', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/assistant/page.tsx'), 'utf8');

  it('keeps the assistant reachable at both /assistant and /ai entry points', () => {
    const aiPage = readFileSync(join(process.cwd(), 'app/platform-v7/ai/page.tsx'), 'utf8');
    expect(aiPage.length).toBeGreaterThan(0);
    expect(page.length).toBeGreaterThan(0);
  });

  it('keeps the new assistant page in working Russian execution language', () => {
    expect(page).toContain('Помощник сделки');
    expect(page).toContain('Центр управления');
    expect(page).toContain('банковская проверка выплаты');
    expect(page).toContain('удержание');
    expect(page).toContain('ответственный');

    for (const token of forbidden) {
      expect(page).not.toContain(token);
    }
  });
});
