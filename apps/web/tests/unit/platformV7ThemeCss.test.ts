import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REQUIRED_P7_COLOR_VARIABLES = [
  '--p7-color-background',
  '--p7-color-background-elevated',
  '--p7-color-surface',
  '--p7-color-surface-muted',
  '--p7-color-surface-strong',
  '--p7-color-border',
  '--p7-color-border-strong',
  '--p7-color-text',
  '--p7-color-text-primary',
  '--p7-color-text-secondary',
  '--p7-color-text-muted',
  '--p7-color-brand',
  '--p7-color-brand-hover',
  '--p7-color-brand-soft',
  '--p7-color-accent',
  '--p7-color-accent-soft',
  '--p7-color-success',
  '--p7-color-success-soft',
  '--p7-color-warning',
  '--p7-color-warning-soft',
  '--p7-color-danger',
  '--p7-color-danger-soft',
  '--p7-color-info',
  '--p7-color-info-soft',
  '--p7-color-money',
  '--p7-color-money-soft',
  '--p7-color-evidence',
  '--p7-color-evidence-soft',
  '--p7-color-integration',
  '--p7-color-integration-soft',
  '--p7-color-bank',
  '--p7-color-bank-soft',
  '--p7-color-logistics',
  '--p7-color-logistics-soft',
  '--p7-color-document',
  '--p7-color-document-soft',
  '--p7-color-dispute',
  '--p7-color-dispute-soft',
] as const;

function readThemeCss(): string {
  const candidates = [join(process.cwd(), 'styles/theme.css'), join(process.cwd(), 'apps/web/styles/theme.css')];
  const path = candidates.find((candidate) => existsSync(candidate));

  if (!path) {
    throw new Error(`Cannot find theme.css. Checked: ${candidates.join(', ')}`);
  }

  return readFileSync(path, 'utf8');
}

function extractThemeBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThanOrEqual(0);

  const nextThemeStart = css.indexOf('\n/* ───', start + selector.length);
  return nextThemeStart === -1 ? css.slice(start) : css.slice(start, nextThemeStart);
}

describe('platform-v7 CSS theme variables', () => {
  const css = readThemeCss();

  it('defines complete p7 color variables for dark and light themes', () => {
    const darkBlock = extractThemeBlock(css, ":root[data-theme='dark']");
    const lightBlock = extractThemeBlock(css, ":root[data-theme='light']");

    for (const variable of REQUIRED_P7_COLOR_VARIABLES) {
      expect(darkBlock).toContain(`${variable}:`);
      expect(lightBlock).toContain(`${variable}:`);
    }
  });

  it('uses the p7 variables as the bridge for legacy pc shell variables', () => {
    expect(css).toContain('--pc-bg: var(--p7-color-background);');
    expect(css).toContain('--pc-bg-card: var(--p7-color-surface);');
    expect(css).toContain('--pc-bg-elevated: var(--p7-color-background-elevated);');
    expect(css).toContain('--pc-text-primary: var(--p7-color-text-primary);');
    expect(css).toContain('--pc-text-secondary: var(--p7-color-text-secondary);');
    expect(css).toContain('--pc-text-muted: var(--p7-color-text-muted);');
  });

  it('does not leave the primary platform button locked to pure white text', () => {
    expect(css).not.toContain('color: #fff;');
    expect(css).toContain('color: var(--pc-accent-contrast);');
  });

  it('declares color-scheme for browser-native controls in dark and light modes', () => {
    const darkBlock = extractThemeBlock(css, ":root[data-theme='dark']");
    const lightBlock = extractThemeBlock(css, ":root[data-theme='light']");

    expect(darkBlock).toContain('color-scheme: dark;');
    expect(lightBlock).toContain('color-scheme: light;');
  });
});
