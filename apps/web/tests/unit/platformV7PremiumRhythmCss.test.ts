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

describe('platform-v7 premium rhythm CSS', () => {
  const css = readRepoFile('styles/platform-v7-premium-rhythm.css');
  const accessibilityCss = readRepoFile('app/v9-accessibility.css');

  it('is imported by the platform accessibility entrypoint after the exhibition layer', () => {
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-exhibition.css';");
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-premium-rhythm.css';");
    expect(accessibilityCss.indexOf('platform-v7-exhibition.css')).toBeLessThan(
      accessibilityCss.indexOf('platform-v7-premium-rhythm.css'),
    );
  });

  it('normalizes premium spacing, radius and nested-card noise', () => {
    expect(css).toContain('border-radius: var(--pc-radius-lg, 20px) !important;');
    expect(css).toContain('gap: 24px !important;');
    expect(css).toContain('gap: 20px !important;');
    expect(css).toContain('box-shadow: none !important;');
  });

  it('improves table rhythm and money readability', () => {
    expect(css).toContain('text-transform: uppercase;');
    expect(css).toContain('font-variant-numeric: tabular-nums;');
    expect(css).toContain('tr:hover td');
    expect(css).toContain('var(--p7-color-border)');
  });

  it('keeps mobile density controlled', () => {
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('border-radius: 18px !important;');
    expect(css).toContain('gap: 14px !important;');
    expect(css).toContain('clamp(28px, 8.5vw, 38px)');
  });
});
