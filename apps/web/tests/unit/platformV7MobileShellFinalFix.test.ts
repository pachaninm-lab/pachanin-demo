import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const p7Page = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/P7Page.tsx'), 'utf8');
const finalFixCss = fs.readFileSync(path.join(process.cwd(), 'apps/web/styles/platform-v7-mobile-shell-final-fix.css'), 'utf8');

describe('platform-v7 mobile shell final fix', () => {
  it('loads the final mobile shell stylesheet after earlier mobile reflow layers', () => {
    const reflowIndex = layout.indexOf("@/styles/platform-v7-mobile-reflow-p0.css");
    const finalFixIndex = layout.indexOf("@/styles/platform-v7-mobile-shell-final-fix.css");

    expect(reflowIndex).toBeGreaterThan(-1);
    expect(finalFixIndex).toBeGreaterThan(reflowIndex);
  });

  it('keeps the cabinet header and role dock fixed and visible', () => {
    expect(finalFixCss).toContain('html body .pc-shell-root-v4 .pc-v4-header');
    expect(finalFixCss).toContain('position: fixed !important');
    expect(finalFixCss).toContain('z-index: 720 !important');
    expect(finalFixCss).toContain('html body .pc-shell-root-v4 .pc-v7-role-dock');
    expect(finalFixCss).toContain('z-index: 700 !important');
    expect(finalFixCss).toContain('html body .pc-shell-root-v4 .pc-v4-bottomnav');
    expect(finalFixCss).toContain('display: none !important');
  });

  it('prevents the operator control tower from leaking desktop width on phones', () => {
    expect(finalFixCss).toContain("[data-testid='control-tower-toolbar']");
    expect(finalFixCss).toContain('.pc-prem-kpis');
    expect(finalFixCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
    expect(finalFixCss).toContain('.ct-priority-main');
    expect(finalFixCss).toContain('.ct-queue-item');
    expect(finalFixCss).toContain('grid-template-columns: 1fr !important');
  });

  it('makes P7Page a named, zero-min-width page frame for mobile CSS control', () => {
    expect(p7Page).toContain("className='p7-page'");
    expect(p7Page).toContain("className='p7-page-header'");
    expect(p7Page).toContain("className='p7-page-title'");
    expect(p7Page).toContain('minWidth: 0');
    expect(p7Page).toContain("overflowX: 'clip'");
  });
});
