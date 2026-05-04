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

describe('platform-v7 dark visual layers CSS', () => {
  it('is imported by the platform-v7 layout', () => {
    const layout = readRepoFile('app/platform-v7/layout.tsx');
    expect(layout).toContain("@/styles/platform-v7-dark-layers.css");
  });

  it('covers role, audit, system and money summary surfaces', () => {
    const css = readRepoFile('styles/platform-v7-dark-layers.css');

    expect(css).toContain("[data-testid^='role-execution-summary-']");
    expect(css).toContain("[data-testid^='platform-v7-audit-surface-']");
    expect(css).toContain("[data-testid^='platform-v7-system-surface-']");
    expect(css).toContain("[data-testid='platform-v7-money-tree-strip']");
  });

  it('uses theme variables instead of fixed light surfaces', () => {
    const css = readRepoFile('styles/platform-v7-dark-layers.css');

    expect(css).toContain('var(--p7-color-surface)');
    expect(css).toContain('var(--p7-color-surface-muted)');
    expect(css).toContain('var(--p7-color-text-primary)');
    expect(css).toContain('var(--p7-color-border)');
    expect(css).not.toContain('#FFFFFF');
    expect(css).not.toContain('#fff');
  });
});
