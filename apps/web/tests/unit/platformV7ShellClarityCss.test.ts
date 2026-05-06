import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 shell clarity css', () => {
  const layout = readFileSync(join(process.cwd(), 'app/platform-v7/layout.tsx'), 'utf8');
  const css = readFileSync(join(process.cwd(), 'styles/platform-v7-shell-clarity.css'), 'utf8');

  it('is loaded after existing platform polish styles', () => {
    expect(layout).toContain("@/styles/platform-v7-shell-clarity.css");
    expect(layout.indexOf("@/styles/platform-v7-dark-role-fixes.css")).toBeLessThan(
      layout.indexOf("@/styles/platform-v7-shell-clarity.css"),
    );
  });

  it('keeps header, drawer and roles compact without changing routes', () => {
    expect(css).toContain('.pc-v4-header');
    expect(css).toContain('.pc-v4-drawer');
    expect(css).toContain('.pc-v4-role-grid');
    expect(css).toContain('.pc-v4-role-btn');
    expect(css).toContain('grid-template-columns: 1fr');
  });

  it('contains mobile and dark-mode shell protections', () => {
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain("data-theme='light'");
    expect(css).toContain('var(--p7-color-surface)');
  });
});
