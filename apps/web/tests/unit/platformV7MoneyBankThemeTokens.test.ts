import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// UX-001: денежные компоненты берут цвета из семантических токенов темы,
// а не из сырых hex/rgba, иначе тёмная тема теряет контраст.
const FILES = [
  '../../components/platform-v7/MoneyGateCard.tsx',
];

const FORBIDDEN_RAW_COLORS = [
  '#B45309',
  '#0A7A5F',
  '#B91C1C',
  'rgba(180,83,9',
  'rgba(10,122,95',
  'rgba(220,38,38',
  'rgba(217,119,6',
  'rgba(100,116,139',
];

describe('UX-001 money/bank components use theme tokens, not raw hex', () => {
  for (const relativePath of FILES) {
    const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

    it(`${relativePath} contains no forbidden raw status colors`, () => {
      for (const raw of FORBIDDEN_RAW_COLORS) {
        expect(source.includes(raw), `${relativePath} still contains raw color ${raw}`).toBe(false);
      }
    });

    it(`${relativePath} references semantic theme tokens`, () => {
      expect(/var\(--pc-(success|warning|danger|accent)/.test(source)).toBe(true);
    });
  }
});
