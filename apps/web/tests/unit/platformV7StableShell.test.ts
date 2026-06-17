import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'apps/web/styles/platform-v7-stable-shell.css'), 'utf8');

describe('platform-v7 stable shell', () => {
  it('loads the stable shell stylesheet through the platform template', () => {
    expect(template).toContain("@/styles/platform-v7-stable-shell.css");
  });

  it('keeps the app header visible and fixed in protected cabinets', () => {
    expect(css).toContain('.pc-shell-root-v4 .pc-v4-header');
    expect(css).toContain('position: fixed !important;');
    expect(css).toContain('z-index: 160 !important;');
    expect(css).toContain('display: block !important;');
  });

  it('keeps the menu button and drawer visible for field roles too', () => {
    expect(css).toContain(".pc-shell-root-v4 .pc-v4-iconbtn[aria-label='Открыть меню']");
    expect(css).toContain('.pc-shell-root-v4 .pc-v4-drawer');
    expect(css).toContain('display: flex !important;');
  });

  it('keeps the custom bottom role dock visible and reserves bottom padding', () => {
    expect(css).toContain('.pc-shell-root-v4 .pc-v7-role-dock');
    expect(css).toContain('z-index: 170 !important;');
    expect(css).toContain('padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 110px) !important;');
  });
});
