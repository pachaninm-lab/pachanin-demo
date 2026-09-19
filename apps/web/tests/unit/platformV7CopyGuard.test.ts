import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const checkedFiles = [
  'app/platform-v7/not-found.tsx',
  'app/platform-v7/help/page.tsx',
  'app/platform-v7/bank/page.tsx',
  'app/platform-v7/status/page.tsx',
  'components/v7r/AppShellV2.tsx',
  'components/system-mode-banner.tsx',
];

const forbiddenUserCopy = [
  'Control Tower',
  'blocker',
  'release callbacks',
  'release gate',
  'transport gate',
  'manual fallback',
  'operator layer',
  'reseved',
  'responsible ballAt',
];

function readWebFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('platform-v7 user-facing copy guard', () => {
  for (const file of checkedFiles) {
    it(`${file} does not reintroduce banned UI wording`, () => {
      const content = readWebFile(file);
      const found = forbiddenUserCopy.filter((term) => content.includes(term));
      expect(found).toEqual([]);
    });
  }
});
