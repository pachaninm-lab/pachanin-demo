import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('seller mobile viewport guard', () => {
  it('does not use 100vw for seller mobile main width', () => {
    const source = read('apps/web/components/platform-v7/SellerMobileFix.tsx');

    expect(source).not.toContain('max-width:100vw');
    expect(source).toContain('max-width:100%');
    expect(source).toContain('safe-area-inset-bottom');
  });
});
