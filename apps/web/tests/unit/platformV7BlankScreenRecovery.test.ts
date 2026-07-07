import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 blank screen recovery', () => {
  it('checks for real platform content before showing recovery', () => {
    const source = read('apps/web/components/platform-v7/PlatformV7BlankScreenGuard.tsx');

    expect(source).toContain('CONTENT_SELECTORS');
    expect(source).toContain('.pc-v7-public-entry');
    expect(source).toContain('.pc-shell-root-v4');
    expect(source).toContain('.p7-route-loading');
    expect(source).toContain('hasVisiblePlatformContent');
    expect(source).toContain('Экран не загрузился');
    expect(source).toContain('/platform-v7/login?recovery=1');
  });

  it('mounts the recovery guard in public and protected platform branches', () => {
    const guards = read('apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx');

    expect(guards).toContain('PlatformV7BlankScreenGuard');
    expect(guards).toContain('<PublicHeroWeightPatch /><PlatformV7BlankScreenGuard />');
    expect(guards).toContain('<PlatformV7BlankScreenGuard />');
    expect(guards).toContain('<MobileLogoutSoftExit />');
  });
});
