import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('platform-v7 mobile trust readability and Gekta return', () => {
  const homeCss = read('styles/platform-v7-canonical-home-v1.css');
  const publicCss = read('styles/platform-v7-canonical-public-v1.css');
  const dock = read('components/platform-v7/PublicContactDock.tsx');
  const productionMobile = read('tests/e2e/platform-v7-production-mobile-acceptance.spec.ts');
  const designSystem = read('tests/e2e/platform-v7-design-system-v8-acceptance.spec.ts');
  const intelligence = read('tests/e2e/platform-v7-public-intelligence-layer.spec.ts');

  it('keeps legacy/full public dock hiding while restoring only the canonical Gekta launcher above mobile navigation', () => {
    const legacyHide = "body:has(.pc-canonical-public) .pc-public-contact-dock{display:none!important}";
    expect(homeCss).toContain(legacyHide);
    expect(publicCss).toContain(legacyHide);
    expect(dock).not.toContain("body:has(.pc-cp-bottom-nav) .pc-public-contact-dock[data-assistant-context='public']");
    expect(dock).toContain(".pc-public-contact-dock[data-assistant-context='public'][data-public-mode='gekta']");
    expect(dock).toContain('display: grid !important;');
    expect(dock).toContain("bottom: max(78px, calc(env(safe-area-inset-bottom, 0px) + 76px)) !important;");
  });

  it('forces one readable trust card per mobile row instead of four compressed columns', () => {
    const readableGrid = '.pc-cp-page-home #trust .pc-cp-trust-grid{grid-template-columns:1fr!important}';
    expect(homeCss).toContain(readableGrid);
    expect(publicCss).toContain(readableGrid);
    expect(homeCss).not.toContain('.pc-cp-page-home #trust .pc-cp-trust-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}');
    expect(publicCss).not.toContain('.pc-cp-page-home #trust .pc-cp-trust-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}');
  });

  it('binds production mobile acceptance to actual trust readability and a working Gekta dialog', () => {
    expect(productionMobile).toContain('async function expectMobileTrustAndGekta(page: Page)');
    expect(productionMobile).toContain('expect(trustMetrics.columns).toBe(1)');
    expect(productionMobile).toContain(".pc-public-contact-dock[data-assistant-context='public'][data-public-mode='gekta']");
    expect(productionMobile).toContain("await expect(panel).toBeVisible({ timeout: 15_000 })");
    expect(productionMobile).toContain("name: 'Закрыть Гекту'");
    expect(designSystem).toContain('if (width >= 981)');
    expect(designSystem).not.toContain('if (width <= 760 || width >= 981)');
    expect(intelligence).toContain(".pc-public-contact-dock[data-assistant-context='public'][data-public-mode='gekta']");
    expect(intelligence).toContain('if (item.width <= 900)');
  });
});