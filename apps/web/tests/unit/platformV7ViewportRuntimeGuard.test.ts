import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 viewport runtime guard', () => {
  it('syncs visual viewport dimensions and keyboard state', () => {
    const source = read('apps/web/components/platform-v7/PlatformV7ViewportRuntimeGuard.tsx');

    expect(source).toContain('window.visualViewport');
    expect(source).toContain('--p7-real-vw');
    expect(source).toContain('--p7-real-vh');
    expect(source).toContain('p7-keyboard-open');
    expect(source).toContain('orientationchange');
    expect(source).toContain('pageshow');
  });

  it('mounts runtime guard for public and protected platform branches', () => {
    const guards = read('apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx');

    expect(guards).toContain('PlatformV7ViewportRuntimeGuard');
    expect(guards).toContain('<PlatformV7ViewportRuntimeGuard />');
    expect(guards).toContain('if (publicPath)');
    expect(guards).toContain('if (position === \'before\')');
  });
});
