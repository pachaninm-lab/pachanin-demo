import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const template = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/template.tsx'), 'utf8');
const gridCss = fs.readFileSync(path.join(process.cwd(), 'styles/platform-v7-protected-grid-stable.css'), 'utf8');
const elevator = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/elevator/page.tsx'), 'utf8');

describe('platform-v7 protected grid and role scope', () => {
  it('loads the generic protected auto-grid stabilizer', () => {
    expect(template).toContain("@/styles/platform-v7-protected-grid-stable.css");
  });

  it('stabilizes all auto-fit and auto-fill protected grids, not only one minmax size', () => {
    expect(gridCss).toContain('[style*="repeat(auto-fit"]');
    expect(gridCss).toContain('[style*="repeat(auto-fill"]');
    expect(gridCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
    expect(gridCss).toContain('overflow-x: hidden !important;');
  });

  it('keeps elevator quick actions inside elevator role scope', () => {
    expect(elevator).toContain("href='#weight'");
    expect(elevator).toContain("href='#quality'");
    expect(elevator).not.toContain('Открыть Deal 360');
    expect(elevator).not.toContain("/platform-v7/deals/${receiving.dealId}/clean");
  });
});
