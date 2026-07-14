import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public product experience v3', () => {
  const page = read('app/platform-v7/page.tsx');
  const explorerPage = read('app/platform-v7/how-it-works/page.tsx');
  const explorer = read('components/platform-v7/PublicDealExplorer.tsx');
  const entryGate = read('components/platform-v7/PublicDealEntryGate.tsx');
  const analytics = read('components/platform-v7/PublicExperienceAnalytics.tsx');
  const stateMachine = read('lib/platform-v7/public-product-experience-state.ts');
  const icons = read('components/platform-v7/PublicExperienceIcon.tsx');
  const copy = read('i18n/public-product-experience-v3.ts');
  const entryCopy = read('i18n/public-product-entry-variants.ts');
  const css = read('styles/platform-v7-public-product-experience-v3.css');
  const refinementCss = read('styles/platform-v7-public-product-experience-v3-refinement.css');
  const entryCss = read('styles/platform-v7-public-product-entry-variants.css');

  it('uses one deal as the root public product model', () => {
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain("className='pc-ppe-hero pc-ppe-hero-copy-only'");
    expect(page).toContain('<PublicDealPreview copy={copy} locale={locale} />');
    expect(page).toContain("className='pc-ppe-perspective-grid' role='group'");
    expect(page).toContain("className='pc-ppe-proof-panel'");
    expect(page).toContain("className='pc-ppe-final-cta'");
    expect(page).not.toContain('entry-control-grid');
    expect(page).not.toContain('entry-role-grid');
    expect(page).not.toContain('PlatformV7IntelligenceStrip');
  });

  it('keeps the header simple and role discovery non-authoritative', () => {
    expect(page).toContain("actions={<a href='/platform-v7/login' className='entry-login'");
    expect(page).not.toContain('entry-header-register');
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).not.toContain("href: '/platform-v7/seller'");
    expect(page).not.toContain("href: '/platform-v7/buyer'");
    expect(page).not.toContain("role='listitem'");
    expect(explorer).toContain("selectPerspective(event.target.value as TourPerspective)");
    expect(`${explorer}\n${entryGate}`).not.toContain('membership');
    expect(`${explorer}\n${entryGate}`).not.toContain('authorization');
    expect(`${explorer}\n${entryGate}`).not.toContain('accessToken');
  });

  it('exposes one primary hero action and an explicit illustrative label', () => {
    const firstHero = page.slice(page.indexOf("className='pc-ppe-hero"), page.indexOf("className='pc-ppe-section'"));
    expect(firstHero.match(/className='pc-ppe-primary-button'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='home_primary_cta_click'");
    expect(copy).toContain("eyebrow: 'Пример прохождения сделки'");
    expect(copy).toContain("exampleBadge: 'Пример прохождения сделки'");
    expect(page).not.toContain('fake-live');
  });

  it('provides role-first, problem-first and deal-first validation entries', () => {
    expect(explorerPage).toContain('<PublicDealEntryGate');
    expect(explorerPage).toContain('normalizeTourEntryVariant(searchParams?.entry)');
    expect(stateMachine).toContain("export const TOUR_ENTRY_VARIANTS = ['role', 'problem', 'deal'] as const");
    expect(entryGate).toContain("data-entry-variant={entry}");
    expect(entryGate).toContain("'role-first'");
    expect(entryGate).toContain("'problem-first'");
    expect(entryCopy).toContain("title: 'Кто вы в сделке?'");
    expect(entryCopy).toContain("title: 'Что вы хотите контролировать?'");
    expect(entryCopy).toContain('не влияет на права доступа');
    expect(entryCss).toContain('min-height: 44px');
  });

  it('provides six lenses, twelve perspectives, three scenarios and ten stages', () => {
    expect(explorerPage).toContain("data-testid='platform-v7-deal-from-inside'");
    expect(explorer).toContain('TOUR_LENSES.map');
    expect(explorer).toContain('TOUR_PERSPECTIVES.map');
    expect(explorer).toContain('TOUR_SCENARIOS.map');
    expect(explorer).toContain('TOUR_STAGES.map');
    expect(copy.match(/summary: /g)?.length).toBeGreaterThanOrEqual(18);
    expect(copy).toContain("standard: { label: 'Штатный'");
    expect(copy).toContain("partial: { label: 'Частичный'");
    expect(copy).toContain("dispute: { label: 'Спорный'");
  });

  it('uses one SVG system and no legacy glyph cards', () => {
    expect(icons).toContain("viewBox='0 0 24 24'");
    expect(icons).toContain("stroke='currentColor'");
    for (const token of ["glyph: '§'", "glyph: '∴'", "glyph: '∑'", "glyph: '⚖'"]) {
      expect(page).not.toContain(token);
      expect(explorer).not.toContain(token);
      expect(entryGate).not.toContain(token);
    }
  });

  it('keeps mobile, accessibility and resilient-display gates active', () => {
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('@media (max-width: 360px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('scroll-padding-bottom: 88px');
    expect(refinementCss).toContain('.pc-ppe-hero-contour');
    expect(refinementCss).toContain('overflow-x: auto');
    expect(refinementCss).toContain("html[data-pc-ppe-scrolling='true'] .pc-ppe-page .p7-support-chat-button");
    expect(entryCss).toContain('@media (max-width: 420px)');
    expect(page).toContain('<PublicExperienceScrollCoordinator />');
    expect(explorerPage).toContain('<PublicExperienceScrollCoordinator />');
    expect(analytics).toContain("root.setAttribute('data-pc-ppe-scrolling', 'true')");
    expect(analytics).toContain("window.addEventListener('scroll', onScroll, { passive: true })");
    expect(explorer).toContain("aria-current={active ? 'step' : undefined}");
    expect(explorer).toContain("window.addEventListener('popstate'");
    expect(entryGate).toContain("window.addEventListener('popstate'");
  });

  it('keeps maturity language truthful and external systems isolated', () => {
    const combined = `${page}\n${explorerPage}\n${explorer}\n${entryGate}\n${copy}\n${entryCopy}`.toLowerCase();
    const forbidden = [
      'production' + '-ready',
      'fully ' + 'live',
      'bank ' + 'connected',
      'fgis ' + 'connected',
      'edo ' + 'connected',
      'math.random',
      'fetch(',
      '/api/',
      'websocket',
    ];
    for (const token of forbidden) expect(combined).not.toContain(token);
    expect(copy).toContain('не читает реальные сделки');
    expect(copy).toContain('не выполняет денежные операции');
  });
});
