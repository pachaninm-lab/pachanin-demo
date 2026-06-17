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

  it('keeps the process strip as a three-card horizontal strip on mobile', () => {
    expect(stableCss).toContain('.pc-v7-public-entry .entry-process-row');
    expect(stableCss).toContain('display: flex !important;');
    expect(stableCss).toContain('grid-template-columns: none !important;');
    expect(stableCss).toContain('flex: 0 0 calc((100vw - 64px) / 3) !important;');
    expect(stableCss).toContain('scroll-snap-type: x mandatory !important;');
  });
});
