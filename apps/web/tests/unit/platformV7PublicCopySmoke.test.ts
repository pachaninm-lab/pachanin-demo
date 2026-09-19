import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7')) ? process.cwd() : path.join(process.cwd(), 'apps/web');

const files = [
  'app/platform-v7/deals/[id]/clean/page.tsx',
  'app/platform-v7/bank/release-safety/page.tsx',
  'app/platform-v7/control-tower/page.tsx',
  'components/platform-v7/P7DealWorkspaceTabs.tsx',
];

const blockedPhrases = ['deal workspace', 'sandbox-aware', 'evidence pack'];

describe('platform-v7 public copy smoke', () => {
  it('does not show old English workspace labels in key public screens', () => {
    for (const file of files) {
      const fullPath = path.join(root, file);
      expect(existsSync(fullPath)).toBe(true);
      const content = readFileSync(fullPath, 'utf8').toLowerCase();

      for (const phrase of blockedPhrases) {
        expect(content).not.toContain(phrase);
      }
    }
  });
});
