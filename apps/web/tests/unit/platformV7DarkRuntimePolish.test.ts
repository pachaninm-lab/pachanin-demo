import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 final dark runtime polish', () => {
  const css = readFileSync(join(process.cwd(), 'styles/mobile-polish.css'), 'utf8');

  it('keeps light-only runtime surfaces mapped to dark theme variables', () => {
    expect(css).toContain("[style*='#F8FAFB']");
    expect(css).toContain("[style*='#F5F7F8']");
    expect(css).toContain("[style*='#FFFFFF']");
    expect(css).toContain('background: var(--p7-color-surface) !important;');
    expect(css).toContain('background: var(--p7-color-surface-muted) !important;');
  });

  it('keeps muted and primary text readable in dark runtime screens', () => {
    expect(css).toContain("[style*='#0F1419']");
    expect(css).toContain("[style*='#475569']");
    expect(css).toContain('color: var(--p7-color-text-primary) !important;');
    expect(css).toContain('color: var(--p7-color-text-secondary) !important;');
  });

  it('keeps status backgrounds non-acidic in dark mode', () => {
    expect(css).toContain("[style*='#ECFDF3']");
    expect(css).toContain("[style*='#FFFAEB']");
    expect(css).toContain("[style*='#FEF2F2']");
    expect(css).toContain('var(--p7-color-success-soft)');
    expect(css).toContain('var(--p7-color-warning-soft)');
    expect(css).toContain('var(--p7-color-danger-soft)');
  });

  it('does not apply dark runtime overrides to explicit light or high-contrast themes', () => {
    expect(css).toContain(":root:not([data-theme='light']):not([data-theme='high-contrast'])");
  });
});
