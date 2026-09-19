import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('platform-v7 public WebKit safety layer', () => {
  it('loads the public WebKit safety CSS after other platform-v7 styles', () => {
    const template = read('apps/web/app/platform-v7/template.tsx');
    const adaptiveIndex = template.indexOf("platform-v7-adaptive-devices.css");
    const i18nIndex = template.indexOf("platform-v7-i18n-cjk.css");
    const safetyIndex = template.indexOf("platform-v7-public-webkit-safe.css");

    expect(safetyIndex).toBeGreaterThan(adaptiveIndex);
    expect(safetyIndex).toBeGreaterThan(i18nIndex);
  });

  it('neutralizes containment only inside the public landing surface', () => {
    const css = read('apps/web/styles/platform-v7-public-webkit-safe.css');

    expect(css).toContain('.pc-v7-public-entry');
    expect(css).toContain('contain: none !important');
    expect(css).toContain('content-visibility: visible !important');
    expect(css).toContain('contain-intrinsic-size: auto !important');
    expect(css).not.toContain('.pc-shell-root-v4 .pc-v4-main');
    expect(css).not.toContain('.seller-cockpit');
  });

  it('forces the mobile control cards to render as a normal column', () => {
    const css = read('apps/web/styles/platform-v7-public-webkit-safe.css');

    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('.pc-v7-public-entry .entry-control-grid');
    expect(css).toContain('display: flex !important');
    expect(css).toContain('flex-direction: column !important');
    expect(css).toContain('.pc-v7-public-entry .entry-control-grid > .entry-control-tile');
    expect(css).toContain('height: auto !important');
    expect(css).toContain('max-height: none !important');
  });
});
