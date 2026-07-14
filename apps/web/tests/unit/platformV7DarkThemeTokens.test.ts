import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Dark-theme guard: theme-critical экраны должны брать ФОНЫ/бордеры из токенов
// (var(--pc-*)), а не из голых светлых hex, иначе тёмная тема ломается (белые
// карточки). Тёмный текст тоже должен идти через токены. Белый ТЕКСТ (color:#fff)
// допустим — он используется на тёмных hero-карточках и насыщенных кнопках.
// Список растёт по мере токенизации экранов.
const TOKENIZED_FILES = [
  '../../app/platform-v7/bank/page.tsx',
  '../../app/platform-v7/elevator/page.tsx',
  '../../app/platform-v7/disputes/page.tsx',
  '../../app/platform-v7/driver/page.tsx',
  '../../app/platform-v7/control-tower/page.tsx',
  '../../app/platform-v7/seller/page.tsx',
  '../../app/platform-v7/operator/page.tsx',
  '../../app/platform-v7/logistics/page.tsx',
  '../../app/platform-v7/buyer/page.tsx',
  '../../app/platform-v7/surveyor/page.tsx',
  '../../app/platform-v7/lab/page.tsx',
  '../../components/platform-v7/MoneyGateCard.tsx',
];

const LIGHT = '(fff|ffffff|fafafa|f8fafc|f8fafb|f1f5f9|f9fafb|eef6f3|fef2f2|fff1f2|e2e8f0|cbd5e1)';
const DARK = '(000|0f1419|0f172a|111827|0b1220|1e293b|1f2937)';
const LIGHT_BG_IN_SURFACE = new RegExp(`(background|backgroundColor|border|borderColor|fill):\\s*'?[^,}]*#${LIGHT}\\b`, 'i');
const DARK_IN_TEXT = new RegExp(`color:\\s*'?#${DARK}\\b`, 'i');

function violations(source: string): string[] {
  const out: string[] = [];
  source.split(/\r?\n/).forEach((line, idx) => {
    const bare = line.replace(/var\(\s*--[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/gi, '');
    if (LIGHT_BG_IN_SURFACE.test(bare) || DARK_IN_TEXT.test(bare)) out.push(`L${idx + 1}: ${line.trim().slice(0, 100)}`);
  });
  return out;
}

describe('dark-theme: tokenized screens have no bare light surfaces / dark text', () => {
  for (const rel of TOKENIZED_FILES) {
    it(`${rel} uses theme tokens for surfaces and text`, () => {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
      const found = violations(src);
      expect(found, `dark-theme violations in ${rel}:\n${found.join('\n')}`).toEqual([]);
    });
  }
});
