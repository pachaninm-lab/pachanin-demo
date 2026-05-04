import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 dark role fixes', () => {
  const css = readFileSync(join(process.cwd(), 'styles/platform-v7-dark-role-fixes.css'), 'utf8');
  const rootLayout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');
  const platformLayout = readFileSync(join(process.cwd(), 'app/platform-v7/layout.tsx'), 'utf8');
  const normalizer = readFileSync(join(process.cwd(), 'components/v7r/ShellCopyNormalizer.tsx'), 'utf8');

  it('loads the stylesheet in both root and platform layouts', () => {
    expect(rootLayout).toContain('platform-v7-dark-role-fixes.css');
    expect(platformLayout).toContain('platform-v7-dark-role-fixes.css');
  });

  it('keeps overrides out of light and high-contrast themes', () => {
    expect(css).toContain(":root:not([data-theme='light']):not([data-theme='high-contrast'])");
  });

  it('targets browser-normalized white runtime surfaces', () => {
    expect(css).toContain('rgb(255, 255, 255)');
    expect(css).toContain('var(--p7-color-surface)');
    expect(css).toContain('var(--p7-color-surface-muted)');
    expect(css).toContain('var(--p7-color-text-primary)');
    expect(css).toContain('var(--p7-color-text-secondary)');
  });

  it('keeps forms and radio controls readable', () => {
    expect(css).toContain('.pc-main input');
    expect(css).toContain("input[type='radio']");
    expect(css).toContain('accent-color: var(--p7-color-brand)');
  });

  it('uses runtime hardening for class-based light cards that are not inline-style matched', () => {
    expect(normalizer).toContain('stabilizeDarkSurfaces');
    expect(normalizer).toContain('window.getComputedStyle');
    expect(normalizer).toContain('p7DarkFixed');
    expect(normalizer).toContain('themeObserver');
    expect(normalizer).toContain('requestAnimationFrame');
    expect(css).toContain("[data-p7-dark-fixed='surface']");
    expect(css).toContain("[data-p7-dark-fixed='action']");
  });

  it('uses runtime hardening for light gradient hero panels', () => {
    expect(normalizer).toContain('isLargeHeroCandidate');
    expect(normalizer).toContain('isLightGradient');
    expect(normalizer).toContain('hasPaleHeroHeading');
    expect(normalizer).toContain("p7DarkFixed = mode");
    expect(normalizer).toContain("mode === 'hero'");
  });

  it('normalizes risky runtime copy', () => {
    expect(normalizer).toContain('Зафиксировать решение: полный выпуск');
    expect(normalizer).toContain('Предпилотная готовность');
  });
});
