import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 universal adaptive layer', () => {
  it('mounts the adaptive style guard on public and protected platform branches', () => {
    const guards = read('apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx');

    expect(guards).toContain('PlatformV7UniversalAdaptiveStyle');
    expect(guards).toContain('<PlatformV7UniversalAdaptiveStyle />');
    expect(guards).toContain('if (publicPath)');
    expect(guards).toContain('if (position === \'before\')');
  });

  it('covers public pages, login, contact, deal scenario and protected cabinets', () => {
    const source = read('apps/web/components/platform-v7/PlatformV7UniversalAdaptiveStyle.tsx');

    expect(source).toContain('.pc-v7-public-entry');
    expect(source).toContain('.pc-v7-login-single');
    expect(source).toContain('.p7-contact-page');
    expect(source).toContain('.p7-demo-clean');
    expect(source).toContain('.pc-shell-root-v4');
    expect(source).toContain('.pc-v4-bottomnav');
    expect(source).toContain('table');
    expect(source).toContain('overflow-x:auto');
    expect(source).toContain('grid-template-columns:minmax(0,1fr)');
  });
});
