import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = readFileSync('app/platform-v7/page.tsx', 'utf8');
const explorerPage = readFileSync('app/platform-v7/how-it-works/page.tsx', 'utf8');
const entryGate = readFileSync('components/platform-v7/PublicDealEntryGate.tsx', 'utf8');
const adapter = readFileSync('components/platform-v7/PublicDealExplorerV4.tsx', 'utf8');
const preview = readFileSync('components/platform-v7/PublicDealPreview.tsx', 'utf8');
const css = readFileSync('styles/platform-v7-public-product-experience-v4.css', 'utf8');
const finalCss = readFileSync('styles/platform-v7-public-product-entry-variants.css', 'utf8');
const copy = readFileSync('i18n/public-product-experience-v4.ts', 'utf8');

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

  it('uses participant language and four business areas', () => {
    expect(entryGate).toContain('ui.explorer.entryBadge');
    expect(entryGate).toContain('PublicDealExplorerV4');
    expect(entryGate).toContain("lens: 'execution'");
    expect(entryGate).toContain("name: 'role_selected'");
    expect(adapter).toContain('publicBusinessAreas');
    expect(adapter).toContain("['execution', 'documents', 'money', 'risk']");
    expect(adapter).toContain('.pc-ppe-lens-list > button:nth-child(2)');
    expect(adapter).toContain('.pc-ppe-lens-list > button:nth-child(6)');
    expect(adapter).toContain('perspective: ui.explorer.roleLabel');
    expect(adapter).toContain('scenario: ui.explorer.scenarioLabel');
  });

  it('uses one canonical CTA vocabulary in RU EN and ZH', () => {
    expect(copy).toContain("primary: 'Посмотреть сделку'");
    expect(copy).toContain("primary: 'Показать весь путь сделки'");
    expect(copy).toContain("primary: 'View the deal'");
    expect(copy).toContain("primary: '查看交易'");
    expect(copy).not.toContain('Посмотреть сделку изнутри');
    expect(copy).not.toContain('Открыть сделку изнутри');
    expect(preview).toContain('ui.home.preview.open');
  });

  it('enforces mobile reflow fixed-header offsets and a non-obscuring support control', () => {
    expect(css).toContain('@media (max-width: 360px)');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(finalCss).toContain('--pc-ppe-v4-header: 56px');
    expect(finalCss).toContain('--pc-ppe-v4-header: 54px');
    expect(finalCss).toContain('scroll-padding-top: calc(var(--pc-ppe-v4-header) + 18px)');
    expect(finalCss).toContain('right: -5px !important');
    expect(finalCss).toContain('padding-bottom: max(88px');
    expect(finalCss).toContain('.pc-site-brand-mark img');
    expect(finalCss).toContain('opacity: 0 !important');
  });

  it('supports reduced motion and the canonical conversion funnel', () => {
    expect(adapter).toContain('@media (prefers-reduced-motion: reduce)');
    expect(adapter).toContain("return 'deal_preview_opened'");
    expect(adapter).toContain("return 'role_selected'");
    expect(adapter).toContain("return 'scenario_started'");
    expect(adapter).toContain("return 'scenario_completed'");
    expect(adapter).toContain("return 'organization_connect_started'");
    expect(root).toContain("eventName='deal_preview_opened'");
    expect(root).toContain("eventName='organization_connect_started'");
  });
});
