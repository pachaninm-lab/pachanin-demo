import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7')) ? process.cwd() : path.join(process.cwd(), 'apps/web');

const fieldPages = [
  'app/platform-v7/elevator/page.tsx',
  'app/platform-v7/lab/page.tsx',
  'app/platform-v7/surveyor/page.tsx',
];

const forbiddenLinks = [
  "from 'next/link'",
  "href='/platform-v7/bank'",
  "href='/platform-v7/bank/clean'",
  "href='/platform-v7/bank/release-safety'",
  "href='/platform-v7/investor'",
  "href='/platform-v7/control-tower'",
  "href='/platform-v7/disputes",
  "href='/platform-v7/documents'",
];

describe('platform-v7 field role isolation', () => {
  it('keeps field role pages free from cross-role navigation and money routes', () => {
    for (const file of fieldPages) {
      const fullPath = path.join(root, file);
      expect(existsSync(fullPath)).toBe(true);
      const content = readFileSync(fullPath, 'utf8');

      for (const forbidden of forbiddenLinks) {
        expect(content, `${file} contains forbidden field-role route: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
