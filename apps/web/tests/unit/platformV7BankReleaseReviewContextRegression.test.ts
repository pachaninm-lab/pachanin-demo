import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7'))
  ? process.cwd()
  : path.join(process.cwd(), 'apps/web');

const bankPagePath = path.join(root, 'app/platform-v7/bank/page.tsx');
const releaseSafetyPagePath = path.join(root, 'app/platform-v7/bank/release-safety/page.tsx');

const FORBIDDEN_SOURCE = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /platform releases money by itself/i,
  /platform guarantees payment/i,
  /платформа гарантирует оплату/i,
  /платформа выпускает деньги/i,
  /нет рисков/i,
  /no risks/i,
];

describe('bank_release_review context regression', () => {
  it('bank/page.tsx exists', () => {
    expect(existsSync(bankPagePath)).toBe(true);
  });

  it('bank/page.tsx contains exactly one bank_release_review panel', () => {
    const source = readFileSync(bankPagePath, 'utf8');
    const matches = source.match(/context=['"]bank_release_review['"]/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('release-safety/page.tsx does not contain bank_release_review (no context leak between sibling bank pages)', () => {
    expect(existsSync(releaseSafetyPagePath)).toBe(true);
    const source = readFileSync(releaseSafetyPagePath, 'utf8');
    expect(source).not.toContain('bank_release_review');
  });

  it('bank/page.tsx source has no forbidden production/live/demo claims', () => {
    const source = readFileSync(bankPagePath, 'utf8');
    for (const pattern of FORBIDDEN_SOURCE) {
      expect(source, `bank/page.tsx contains forbidden phrase: ${pattern}`).not.toMatch(pattern);
    }
    expect(source).not.toContain('/platform-v7/demo/');
  });

  it('release-safety/page.tsx source has no forbidden production/live/demo claims', () => {
    const source = readFileSync(releaseSafetyPagePath, 'utf8');
    for (const pattern of FORBIDDEN_SOURCE) {
      expect(source, `release-safety/page.tsx contains forbidden phrase: ${pattern}`).not.toMatch(pattern);
    }
    expect(source).not.toContain('/platform-v7/demo/');
  });
});
