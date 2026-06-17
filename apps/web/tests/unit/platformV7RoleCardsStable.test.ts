import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'apps/web/styles/platform-v7-role-cards-stable.css'), 'utf8');

describe('platform-v7 stable protected role card grids', () => {
  it('loads the role card grid stabilizer for every platform-v7 route', () => {
    expect(template).toContain("@/styles/platform-v7-role-cards-stable.css");
  });

  it('overrides auto-fit role grids with two columns on mobile', () => {
    expect(css).toContain('[style*="repeat(auto-fit, minmax(170px, 1fr))"]');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
    expect(css).toContain('@media (max-width: 640px)');
  });

  it('keeps role cards constrained inside the mobile viewport', () => {
    expect(css).toContain('max-width: 100vw !important;');
    expect(css).toContain('overflow-x: hidden !important;');
    expect(css).toContain('min-width: 0 !important;');
  });
});
