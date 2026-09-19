import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('platform-v7 native scroll ownership', () => {
  it('does not mount or retain the historical scroll restoration guard', () => {
    const template = read('apps/web/app/platform-v7/template.tsx');
    const guardPath = path.join(root, 'apps/web/components/platform-v7/PlatformV7ScrollRestorationGuard.tsx');
    expect(template).not.toContain('PlatformV7ScrollRestorationGuard');
    expect(template).not.toContain('window.scrollTo');
    expect(template).not.toContain('scrollRestoration');
    expect(fs.existsSync(guardPath)).toBe(false);
  });
});
