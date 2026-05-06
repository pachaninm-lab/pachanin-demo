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
  const middleware = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/assistant/page.tsx'), 'utf8');

  it('redirects the old assistant route to the clean assistant route', () => {
    expect(middleware).toContain("p === '/platform-v7/ai'");
    expect(middleware).toContain("'/platform-v7/assistant'");
  });

  it('keeps the new assistant page in working Russian execution language', () => {
    expect(page).toContain('Помощник сделки');
    expect(page).toContain('Центр управления');
    expect(page).toContain('выпуск денег');
    expect(page).toContain('удержание');
    expect(page).toContain('ответственный');

    for (const token of forbidden) {
      expect(page).not.toContain(token);
    }
  });
});
