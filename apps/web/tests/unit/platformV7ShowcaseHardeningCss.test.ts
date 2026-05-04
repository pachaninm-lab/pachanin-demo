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

describe('platform-v7 showcase hardening CSS', () => {
  const css = readRepoFile('styles/platform-v7-showcase-hardening.css');
  const accessibilityCss = readRepoFile('app/v9-accessibility.css');

  it('is imported after the exhibition and premium rhythm layers', () => {
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-exhibition.css';");
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-premium-rhythm.css';");
    expect(accessibilityCss).toContain("@import '../styles/platform-v7-showcase-hardening.css';");
    expect(accessibilityCss.indexOf('platform-v7-premium-rhythm.css')).toBeLessThan(
      accessibilityCss.indexOf('platform-v7-showcase-hardening.css'),
    );
  });

  it('protects long identifiers and code-like strings from breaking mobile layouts', () => {
    expect(css).toContain('overflow-wrap: anywhere;');
    expect(css).toContain('white-space: pre-wrap;');
    expect(css).toContain("[style*='JetBrains Mono']");
  });

  it('hardens sticky surfaces, scrollbars and action feedback for demo usage', () => {
    expect(css).toContain("[style*='position: sticky']");
    expect(css).toContain('scrollbar-width: thin;');
    expect(css).toContain('border-color: color-mix(in srgb, var(--p7-color-brand) 34%, var(--p7-color-border)) !important;');
  });

  it('raises weak opacity levels and keeps mobile nowrap from causing overflow', () => {
    expect(css).toContain('opacity: 0.68 !important;');
    expect(css).toContain('opacity: 0.74 !important;');
    expect(css).toContain('opacity: 0.82 !important;');
    expect(css).toContain('white-space: normal !important;');
  });
});
