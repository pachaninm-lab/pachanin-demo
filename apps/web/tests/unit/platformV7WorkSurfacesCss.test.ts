import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 work surfaces css', () => {
  const layout = readFileSync(join(process.cwd(), 'app/platform-v7/layout.tsx'), 'utf8');
  const css = readFileSync(join(process.cwd(), 'styles/platform-v7-work-surfaces.css'), 'utf8');

  it('is loaded after shell clarity styles', () => {
    expect(layout).toContain('platform-v7-work-surfaces.css');
    expect(layout.indexOf('platform-v7-shell-clarity.css')).toBeLessThan(
      layout.indexOf('platform-v7-work-surfaces.css'),
    );
  });

  it('protects work surfaces, tables and click targets', () => {
    expect(css).toContain('.pc-main table');
    expect(css).toContain('border-collapse: separate');
    expect(css).toContain('min-height: 42px');
    expect(css).toContain('scroll-margin-top');
  });

  it('contains mobile and dark-mode protections', () => {
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain('var(--p7-color-surface)');
    expect(css).toContain('var(--p7-color-border)');
  });
});
