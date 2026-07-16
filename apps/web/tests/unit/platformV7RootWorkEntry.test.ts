import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public product experience v5', () => {
  const layout = read('app/platform-v7/layout.tsx');
  const page = read('app/platform-v7/page.tsx');
  const explorerPage = read('app/platform-v7/how-it-works/page.tsx');
  const explorer = read('components/platform-v7/PublicDealExplorer.tsx');
  const entryGate = read('components/platform-v7/PublicDealEntryGate.tsx');
  const explorerAdapter = read('components/platform-v7/PublicDealExplorerV4.tsx');
  const preview = read('components/platform-v7/PublicDealPreview.tsx');
  const support = read('components/platform-v7/ChatSupportWidget.tsx');
  const analytics = read('components/platform-v7/PublicExperienceAnalytics.tsx');
  const stateMachine = read('lib/platform-v7/public-product-experience-state.ts');
  const icons = read('components/platform-v7/PublicExperienceIcon.tsx');
  const copy = read('i18n/public-product-experience-v3.ts');
  const copyV4 = read('i18n/public-product-experience-v4.ts');
  const entryCopy = read('i18n/public-product-entry-variants.ts');
  const css = read('styles/platform-v7-public-product-experience-v3.css');
  const cssV5 = read('styles/platform-v7-public-product-experience-v5.css');

  it('uses one deal as the root public product model', () => {
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain("className='pc-ppe-hero pc-ppe-hero-copy-only'");
    expect(page).toContain('<PublicDealPreview copy={copy} locale={locale} />');
    expect(page).toContain("id='deal-example'");
    expect(page).toContain("id='participants'");
    expect(page).toContain("id='reliability'");
    expect(page).toContain("className='pc-ppe-evidence-panel'");
    expect(page).toContain("className='pc-ppe-final-cta'");
    expect(page).not.toContain('entry-control-grid');
    expect(page).not.toContain('entry-role-grid');
    expect(page).not.toContain('PlatformV7IntelligenceStrip');
  });

  it('starts a new visitor at stage one while keeping acceptance as an explicit highlighted fragment', () => {
    expect(explorerPage).toContain("stage: 'terms'");
    expect(explorerPage).toContain("perspective: 'buyer'");
    expect(page).toContain('const contourStages = TOUR_STAGES');
    expect(page).toContain("data-active={stage === 'terms' ? 'true' : 'false'}");
    expect(page).toContain("stage=terms&lens=execution&perspective=buyer");
    expect(page).toContain("stageCounter: 'Этап 1 из 10'");
    expect(page).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
    expect(preview).toContain("selectedStage: 'Выбранный ключевой этап'");
    expect(preview).toContain("stage=terms&lens=execution&perspective=buyer");
    expect(preview).toContain("stage=acceptance&lens=${lens}&perspective=buyer");
    expect(preview).toContain("start: 'Посмотреть сделку с начала'");
    expect(preview).toContain("current: 'Открыть этап приёмки'");
    expect(preview).toContain("className='pc-ppe-preview-actions'");
  });

  it('uses service navigation without client-authoritative role routing', () => {
    expect(page).toContain('nav={nav}');
    expect(page).toContain('showMobileMenu');
    expect(page).toContain("actions={<a href='/platform-v7/login' className='entry-login'");
    expect(page).not.toContain('entry-header-register');
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).not.toContain("href: '/platform-v7/seller'");
    expect(page).not.toContain("href: '/platform-v7/buyer'");
    expect(explorer).toContain('selectPerspective(event.target.value as TourPerspective)');
    expect(`${explorer}\n${entryGate}`).not.toContain('accessToken');
  });

  it('exposes one primary hero action and an unmistakable demonstration boundary', () => {
    const firstHero = page.slice(page.indexOf("className='pc-ppe-hero"), page.indexOf("id='deal-example'"));
    expect(firstHero.match(/className='pc-ppe-primary-button'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='deal_preview_opened'");
    expect(copyV4).toContain("primary: 'Разобрать демонстрационную сделку'");
    expect(copyV4).toContain("demoLabel: 'Демонстрационная сделка'");
    expect(copyV4).toContain('не содержит реальных сделок');
    expect(preview).not.toContain('DEAL-2408');
    expect(preview).toContain('preview.demoNote');
    expect(preview).toContain('preview.settlementValue');
  });

  it('provides role-first, problem-first and deal-first validation entries', () => {
    expect(explorerPage).toContain('<PublicDealEntryGate');
    expect(explorerPage).toContain('normalizeTourEntryVariant(searchParams?.entry)');
    expect(stateMachine).toContain("export const TOUR_ENTRY_VARIANTS = ['role', 'problem', 'deal'] as const");
    expect(entryGate).toContain('data-entry-variant={entry}');
    expect(entryGate).toContain("'role-first'");
    expect(entryGate).toContain("'problem-first'");
    expect(entryGate).toContain('entryCopy.role.options.slice(0, 5)');
    expect(entryGate).toContain('ui.explorer.entryBadge');
    expect(entryGate).toContain('lens: option.lens');
    expect(entryGate).toContain("name: 'role_selected'");
    expect(entryCopy).toContain("title: 'Кто вы в сделке?'");
    expect(entryCopy).toContain("title: 'Что вы хотите контролировать?'");
    expect(entryGate).toContain('не влияет на права доступа');
  });

  it('keeps six internal lenses but exposes four business areas publicly', () => {
    expect(explorerPage).toContain("data-testid='platform-v7-deal-from-inside'");
    expect(explorer).toContain('TOUR_LENSES.map');
    expect(explorer).toContain('TOUR_PERSPECTIVES.map');
    expect(explorer).toContain('TOUR_SCENARIOS.map');
    expect(explorer).toContain('TOUR_STAGES.map');
    expect(explorerAdapter).toContain("['execution', 'documents', 'money', 'risk']");
    expect(explorerAdapter).toContain('.pc-ppe-lens-list > button:nth-child(2)');
    expect(explorerAdapter).toContain('.pc-ppe-lens-list > button:nth-child(6)');
    expect(explorerAdapter).toContain('ui.explorer.scenarios.standard');
    expect(explorerAdapter).toContain('perspective: ui.explorer.roleLabel');
    expect(copy.match(/summary: /g)?.length).toBeGreaterThanOrEqual(18);
  });

  it('uses one SVG system and no decorative legacy glyph cards', () => {
    expect(icons).toContain("viewBox='0 0 24 24'");
    expect(icons).toContain("stroke='currentColor'");
    for (const token of ["glyph: '§'", "glyph: '∴'", "glyph: '∑'", "glyph: '⚖'"]) {
      expect(page).not.toContain(token);
      expect(explorer).not.toContain(token);
      expect(entryGate).not.toContain(token);
    }
  });

  it('keeps semantic structures, contrast and evidence causality', () => {
    expect(explorer).toContain("<span className='pc-ppe-causal-index' aria-hidden='true'>{index + 1}</span>");
    expect(page).toContain("className='pc-ppe-evidence-chain'");
    expect(page).toContain('ui.home.proof.steps.map');
    expect(copyV4).toContain("{ label: 'Событие'");
    expect(copyV4).toContain("{ label: 'Основание'");
    expect(copyV4).toContain("{ label: 'Ограничение'");
    expect(css).toContain('color: var(--pc-ppe-muted);');
  });

  it('reserves the protected loading viewport instead of shifting after hydration', () => {
    expect(layout).toContain('.pc-shell-root-v4 .p7-route-loading{min-height:calc(100dvh - 136px)}');
  });

  it('keeps mobile accessibility and resilient-display gates active', () => {
    expect(cssV5).toContain('min-height: 44px');
    expect(cssV5).toContain('@media (max-width: 380px)');
    expect(cssV5).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssV5).toContain('@media (forced-colors: active)');
    expect(cssV5).toContain('scroll-padding-bottom: 88px');
    expect(cssV5).toContain('right: max(14px');
    expect(cssV5).not.toContain('right: -5px');
    expect(page).toContain('<PublicExperienceScrollCoordinator />');
    expect(explorerPage).toContain('<PublicExperienceScrollCoordinator />');
    expect(analytics).toContain("root.setAttribute('data-pc-ppe-scrolling', 'true')");
    expect(explorer).toContain("aria-current={active ? 'step' : undefined}");
    expect(explorer).toContain("window.addEventListener('popstate'");
    expect(entryGate).toContain("window.addEventListener('popstate'");
  });

  it('implements the support surface as a real accessible dialog', () => {
    expect(support).toContain("role='dialog'");
    expect(support).toContain("aria-modal='true'");
    expect(support).toContain("event.key === 'Escape'");
    expect(support).toContain("event.key !== 'Tab'");
    expect(support).toContain("body.style.position = 'fixed'");
    expect(support).toContain('triggerRef.current?.focus()');
    expect(support).not.toContain('syncSupportViewport');
    expect(support).not.toContain('Участник платформы');
  });

  it('keeps maturity language truthful and external systems isolated', () => {
    const combined = `${page}\n${explorerPage}\n${explorer}\n${entryGate}\n${copy}\n${copyV4}\n${entryCopy}`.toLowerCase();
    const forbidden = [
      'production' + '-ready',
      'fully ' + 'live',
      'bank ' + 'connected',
      'fgis ' + 'connected',
      'edo ' + 'connected',
      'math.random',
      'websocket',
    ];
    for (const token of forbidden) expect(combined).not.toContain(token);
    expect(copyV4.toLowerCase()).toContain('controlled pilot / pre-integration');
    expect(copyV4).toContain('не выполняет денежные операции');
  });
});
