import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = readFileSync('app/platform-v7/page.tsx', 'utf8');
const explorerPage = readFileSync('app/platform-v7/how-it-works/page.tsx', 'utf8');
const entryGate = readFileSync('components/platform-v7/PublicDealEntryGate.tsx', 'utf8');
const adapter = readFileSync('components/platform-v7/PublicDealExplorerV4.tsx', 'utf8');
const preview = readFileSync('components/platform-v7/PublicDealPreview.tsx', 'utf8');
const css = readFileSync('styles/platform-v7-public-product-experience-v4.css', 'utf8');
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

  it('progressively discloses role choices and preserves the deterministic explorer', () => {
    expect(entryGate).toContain('entryCopy.role.options.slice(0, 5)');
    expect(entryGate).toContain('pc-ppe-entry-more');
    expect(entryGate).toContain('PublicDealExplorerV4');
    expect(adapter).toContain('PublicDealExplorer');
    expect(adapter).toContain('ui.explorer.scenarios.standard');
  });

  it('uses consistent public CTA copy in RU, EN and ZH', () => {
    expect(copy).toContain("primary: 'Посмотреть сделку'");
    expect(copy).toContain("primary: 'View the deal'");
    expect(copy).toContain("primary: '查看交易'");
    expect(preview).toContain('ui.home.preview.open');
  });

  it('enforces 320px reflow, header offsets and non-obscuring support placement', () => {
    expect(css).toContain('@media (max-width: 360px)');
    expect(css).toContain('scroll-margin-top: calc(var(--pc-ppe-v4-header) + 18px)');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(css).toContain('right: -5px !important');
    expect(css).toContain('overflow: visible !important');
  });
});
