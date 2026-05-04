import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 dark visual layers', () => {
  const css = readFileSync(join(process.cwd(), 'styles/mobile-polish.css'), 'utf8');

  it('keeps audit, system and money summary surfaces theme-aware', () => {
    expect(css).toContain("[data-testid^='platform-v7-audit-surface-']");
    expect(css).toContain("[data-testid^='platform-v7-system-surface-']");
    expect(css).toContain("[data-testid='platform-v7-money-tree-strip']");
    expect(css).toContain('var(--p7-color-surface)');
    expect(css).toContain('var(--p7-color-surface-muted)');
    expect(css).toContain('var(--p7-color-text-primary)');
    expect(css).toContain('var(--p7-color-border)');
  });

  it('keeps command center primary CTA theme-aware', () => {
    expect(css).toContain("[data-testid='platform-command-center-hero'] a:first-of-type");
    expect(css).toContain('color: var(--p7-color-background)');
  });
});
