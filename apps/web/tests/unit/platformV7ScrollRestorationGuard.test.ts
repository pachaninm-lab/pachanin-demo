import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 scroll restoration guard', () => {
  it('mounts the scroll guard globally in the platform template', () => {
    const template = read('apps/web/app/platform-v7/template.tsx');
    expect(template).toContain('PlatformV7ScrollRestorationGuard');
    expect(template).toContain('<PlatformV7ScrollRestorationGuard />');
  });

  it('forces manual restoration and resets top routes', () => {
    const guard = read('apps/web/components/platform-v7/PlatformV7ScrollRestorationGuard.tsx');
    expect(guard).toContain("window.history.scrollRestoration = 'manual'");
    expect(guard).toContain('window.scrollTo');
    expect(guard).toContain('/platform-v7/login');
    expect(guard).toContain('/platform-v7/buyer');
  });
});
