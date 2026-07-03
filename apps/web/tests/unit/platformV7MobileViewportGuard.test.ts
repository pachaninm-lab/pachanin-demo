import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'apps/web/styles/platform-v7-mobile-screenshot-fixes.css'), 'utf8');

describe('platform-v7 mobile viewport guard', () => {
  it('loads the final mobile viewport guard in the platform-v7 layout', () => {
    expect(layout).toContain("@/styles/platform-v7-mobile-screenshot-fixes.css");
  });

  it('keeps protected role cabinets inside the mobile viewport', () => {
    expect(css).toContain('.pc-shell-root-v4 .pc-v4-main > main:not(.pc-v7-public-entry):not(.pc-v7-login-single)');
    expect(css).toContain('max-width: 100% !important;');
    expect(css).toContain('overflow-x: hidden !important;');
  });

  it('forces risky desktop grids into one column on mobile', () => {
    expect(css).toContain("[style*='grid-template-columns']");
    expect(css).toContain("[style*='repeat(']");
    expect(css).toContain('grid-template-columns: 1fr !important;');
  });

  it('protects collapsible sections and live api status from long text overflow', () => {
    expect(css).toContain('.p7-collapsible-title');
    expect(css).toContain('.p7-collapsible-summary');
    expect(css).toContain('.p7-live-api-status');
    expect(css).toContain('overflow-wrap: anywhere !important;');
  });

  it('keeps the mobile app shell visible above role content', () => {
    expect(css).toContain('.pc-shell-root-v4 .pc-v4-header');
    expect(css).toContain('position: fixed !important;');
    expect(css).toContain('z-index: 900 !important;');
    expect(css).toContain('.pc-shell-root-v4 .pc-v7-role-dock');
  });

  it('keeps public entry and role grids from drifting sideways', () => {
    expect(css).toContain('.pc-v7-public-entry .entry-header');
    expect(css).toContain('.pc-v7-public-entry .entry-process-row');
    expect(css).toContain('.pc-v7-public-entry .entry-role-grid');
    expect(css).toContain('.pc-v7-public-entry .entry-control-grid');
  });
});
