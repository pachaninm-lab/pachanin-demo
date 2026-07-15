import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = readFileSync('app/platform-v7/page.tsx', 'utf8');
const explorerPage = readFileSync('app/platform-v7/how-it-works/page.tsx', 'utf8');
const entryGate = readFileSync('components/platform-v7/PublicDealEntryGate.tsx', 'utf8');
const adapter = readFileSync('components/platform-v7/PublicDealExplorerV4.tsx', 'utf8');
const preview = readFileSync('components/platform-v7/PublicDealPreview.tsx', 'utf8');
const analytics = readFileSync('components/platform-v7/PublicExperienceAnalytics.tsx', 'utf8');
const header = readFileSync('components/platform-v7/PublicSiteHeader.tsx', 'utf8');
const css = readFileSync('styles/platform-v7-public-product-experience-v4.css', 'utf8');
const entryCss = readFileSync('styles/platform-v7-public-product-entry-variants.css', 'utf8');
const finalCss = readFileSync('styles/platform-v7-public-product-experience-v4-final.css', 'utf8');
const copy = readFileSync('i18n/public-product-experience-v4.ts', 'utf8');
const entryCopy = readFileSync('i18n/public-product-entry-variants.ts', 'utf8');

describe('Public Product Experience V4', () => {
  it('keeps the home task-first and progressively discloses secondary roles', () => {
    expect(root).toContain('allPrimaryPerspectives.slice(0, 5)');
    expect(root).toContain('pc-ppe-hero-progress-mobile');
    expect(root).toContain('ui.home.perspectives.more');
    expect(root).toContain('ui.home.final.primary');
  });

  it('removes the premature connection CTA from the explorer introduction', () => {
    expect(explorerPage).toContain('pc-ppe-back-link');
    expect(explorerPage).not.toContain("source: 'how_it_works_header'");
    expect(explorerPage).not.toContain("eventName='connect_cta_click'");
  });

  it('uses plain role and scenario language while preserving the deterministic explorer', () => {
    expect(entryGate).toContain('ui.explorer.entryBadge');
    expect(entryGate).toContain('PublicDealExplorerV4');
    expect(adapter).toContain('PublicDealExplorer');
    expect(adapter).toContain('publicBusinessAreas');
    expect(adapter).toContain("lens: 'execution'");
    expect(adapter).toContain('perspective: ui.explorer.roleLabel');
    expect(adapter).toContain('scenario: ui.explorer.scenarioLabel');
    expect(adapter).toContain('ui.explorer.scenarios.standard');
    expect(entryCopy).not.toContain('соответствующая линза');
  });

  it('uses one canonical CTA vocabulary in RU, EN and ZH', () => {
    expect(copy).toContain("primary: 'Посмотреть сделку'");
    expect(copy).toContain("primary: 'Показать весь путь сделки'");
    expect(copy).toContain("primary: 'View the deal'");
    expect(copy).toContain("primary: '查看交易'");
    expect(copy).not.toContain('Посмотреть сделку изнутри');
    expect(copy).not.toContain('Открыть сделку изнутри');
    expect(preview).toContain('ui.home.preview.open');
  });

  it('enforces mobile reflow, fixed-header offsets and non-obscuring support placement', () => {
    expect(css).toContain('@media (max-width: 360px)');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(entryCss).toContain('--pc-ppe-v4-header: 64px');
    expect(entryCss).toContain('scroll-padding-top: calc(var(--pc-ppe-v4-header) + 18px)');
    expect(entryCss).toContain('right: -5px !important');
    expect(entryCss).toContain('padding-bottom: max(88px');
    expect(header).toContain("import { BrandMark }");
    expect(finalCss).toContain('data:image/svg+xml');
    expect(finalCss).toContain('.pc-site-brand-mark img');
    expect(finalCss).toContain('opacity: 0 !important');
  });

  it('limits the explorer to four business areas and respects reduced motion', () => {
    expect(finalCss).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(finalCss).toContain('.pc-ppe-lens-list > button:nth-child(2)');
    expect(finalCss).toContain('.pc-ppe-lens-list > button:nth-child(6)');
    expect(finalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(root).toContain('platform-v7-public-product-experience-v4-final.css');
    expect(explorerPage).toContain('platform-v7-public-product-experience-v4-final.css');
  });

  it('bridges legacy events to the canonical conversion funnel without inventing submission', () => {
    expect(analytics).toContain("return 'deal_preview_opened'");
    expect(analytics).toContain("return 'role_selected'");
    expect(analytics).toContain("return 'scenario_started'");
    expect(analytics).toContain("return 'scenario_completed'");
    expect(analytics).toContain("return 'organization_connect_started'");
    expect(analytics).not.toContain('organization_connect_submitted');
  });
});
