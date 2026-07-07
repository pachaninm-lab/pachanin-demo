import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 cabinet forms adaptive rules', () => {
  it('keeps forms, buttons and long identifiers inside the mobile viewport', () => {
    const source = read('apps/web/components/platform-v7/PlatformV7UniversalAdaptiveStyle.tsx');

    expect(source).toContain('form');
    expect(source).toContain('fieldset');
    expect(source).toContain("a[role='button']");
    expect(source).toContain('word-break:break-word');
    expect(source).toContain('min-height:44px');
    expect(source).toContain('padding-bottom:max(128px');
  });
});
