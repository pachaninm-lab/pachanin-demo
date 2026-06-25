import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const stableCss = fs.readFileSync(path.join(process.cwd(), 'apps/web/styles/platform-v7-public-entry-stable.css'), 'utf8');

describe('platform-v7 public entry stable mobile layout', () => {
  it('loads the public entry stable stylesheet through the route template', () => {
    expect(template).toContain("@/styles/platform-v7-public-entry-stable.css");
  });

  it('keeps the control cards in two columns on mobile', () => {
    expect(stableCss).toContain('.pc-v7-public-entry .entry-control-grid');
    expect(stableCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
    expect(stableCss).not.toContain('.entry-control-grid { grid-template-columns: 1fr; }');
  });

  it('keeps the process strip as a premium single-card snap carousel on mobile', () => {
    expect(stableCss).toContain('.pc-v7-public-entry .entry-process-row');
    expect(stableCss).toContain('display: flex !important;');
    expect(stableCss).toContain('grid-template-columns: none !important;');
    expect(stableCss).toContain('overflow-x: auto !important;');
    expect(stableCss).toContain('scroll-snap-type: x mandatory !important;');
    expect(stableCss).toContain('flex: 0 0 clamp(248px, calc(100vw - 72px), 320px) !important;');
    expect(stableCss).toContain('scroll-snap-align: center !important;');
    expect(stableCss).toContain('scroll-snap-stop: always !important;');
  });

  it('keeps process card text readable without clipped badges', () => {
    expect(stableCss).toContain('.pc-v7-public-entry .entry-process-index');
    expect(stableCss).toContain('inline-size: 34px !important;');
    expect(stableCss).toContain('.pc-v7-public-entry .entry-process-tile strong');
    expect(stableCss).toContain('font-size: 21px !important;');
    expect(stableCss).toContain('max-width: calc(100% - 30px) !important;');
  });

  it('beats older mobile hardening selectors that previously cancelled the carousel', () => {
    expect(stableCss).toContain('html body .pc-shell-root-v4 .pc-v7-public-entry .entry-process-row');
    expect(stableCss).toContain('html body .pc-shell-root-v4 .pc-v7-public-entry .entry-process-tile');
    expect(stableCss).toContain('flex: 0 0 min(320px, calc(100vw - 72px)) !important;');
    expect(stableCss).toContain('html body .pc-shell-root-v4 .pc-v7-public-entry .entry-process-icon');
    expect(stableCss).toContain('display: grid !important;');
  });
});
