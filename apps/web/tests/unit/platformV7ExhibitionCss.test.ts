import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  const candidates = [join(process.cwd(), relativePath), join(process.cwd(), 'apps/web', relativePath)];
  const path = candidates.find((candidate) => existsSync(candidate));

  if (!path) {
    throw new Error(`Cannot find ${relativePath}. Checked: ${candidates.join(', ')}`);
  }

  return readFileSync(path, 'utf8');
}

describe('platform-v7 exhibition visual CSS', () => {
  const css = readRepoFile('styles/platform-v7-exhibition.css');
  const accessibilityCss = readRepoFile('app/v9-accessibility.css');

  it('is imported by the platform accessibility entrypoint', () => {
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-exhibition.css';");
  });

  it('keeps touch targets, focus and action feedback protected', () => {
    expect(css).toContain('min-height: 44px');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('translateY(-1px)');
    expect(css).toContain('scale(0.99)');
  });

  it('contains shared empty, error and loading state selectors', () => {
    expect(css).toContain("[data-state='empty']");
    expect(css).toContain("[data-state='error']");
    expect(css).toContain("[data-state='loading']");
    expect(css).toContain('pc-p7-skeleton');
  });

  it('protects mobile layout from horizontal overflow and desktop grids', () => {
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('max-width: 100vw');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) !important;');
  });

  it('uses platform theme variables instead of hard-coded white surfaces', () => {
    expect(css).toContain('var(--p7-color-text-primary)');
    expect(css).toContain('var(--p7-color-border)');
    expect(css).toContain('var(--p7-color-background-elevated)');
    expect(css).not.toContain('background: #fff');
    expect(css).not.toContain('background-color: #fff');
  });
});
