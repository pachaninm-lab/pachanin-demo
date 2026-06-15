import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Dark-theme guard: перечисленные theme-critical экраны должны брать цвета из
// токенов (var(--pc-*)), а НЕ из «голых» светлых фонов / тёмного текста, иначе
// тёмная тема ломается (белые карточки / невидимый текст). Список растёт по мере
// токенизации экранов; голый hex в color/background/border здесь запрещён.
const TOKENIZED_FILES = [
  '../../app/platform-v7/bank/page.tsx',
  '../../components/platform-v7/MoneyGateCard.tsx',
  '../../components/platform-v7/P7BankPaymentBasisRuntimePanel.tsx',
];

const LIGHT_BG = /#(fff|ffffff|fafafa|f8fafc|f8fafb|f1f5f9|f9fafb|eef6f3|e2e8f0|cbd5e1)\b/i;
const DARK_TEXT = /#(000|0f1419|0f172a|111827|0b1220|1e293b|1f2937)\b/i;
const STYLE_PROP = /(background|backgroundColor|color|border|borderColor|fill):/i;

function bareHexViolations(source: string): string[] {
  const out: string[] = [];
  source.split(/\r?\n/).forEach((line, idx) => {
    const bare = line.replace(/var\(\s*--[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/gi, '');
    if ((LIGHT_BG.test(bare) || DARK_TEXT.test(bare)) && STYLE_PROP.test(bare)) {
      out.push(`L${idx + 1}: ${line.trim().slice(0, 100)}`);
    }
  });
  return out;
}

describe('dark-theme: tokenized screens have no bare light/dark hex', () => {
  for (const rel of TOKENIZED_FILES) {
    it(`${rel} uses theme tokens, not bare light/dark hex`, () => {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
      const violations = bareHexViolations(src);
      expect(violations, `bare light/dark hex found in ${rel}:\n${violations.join('\n')}`).toEqual([]);
    });
  }
});
