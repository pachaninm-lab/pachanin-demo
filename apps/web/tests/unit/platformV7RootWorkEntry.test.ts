import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public product experience v5 with TAI layer', () => {
  const layout = read('app/platform-v7/layout.tsx');
  const page = read('app/platform-v7/page.tsx');
  const explorerPage = read('app/platform-v7/how-it-works/page.tsx');
  const explorer = read('components/platform-v7/PublicDealExplorer.tsx');
  const entryGate = read('components/platform-v7/PublicDealEntryGate.tsx');
  const explorerAdapter = read('components/platform-v7/PublicDealExplorerV4.tsx');
  const preview = read('components/platform-v7/PublicDealPreview.tsx');
  const evidence = read('components/platform-v7/PublicEvidenceIntelligencePanel.tsx');
  const government = read('components/platform-v7/PublicGovernmentDataContour.tsx');
  const support = read('components/platform-v7/ChatSupportWidget.tsx');
  const analytics = read('components/platform-v7/PublicExperienceAnalytics.tsx');
  const stateMachine = read('lib/platform-v7/public-product-experience-state.ts');
  const icons = read('components/platform-v7/PublicExperienceIcon.tsx');
  const copy = read('i18n/public-product-experience-v3.ts');
  const copyV4 = read('i18n/public-product-experience-v4.ts');
  const entryCopy = read('i18n/public-product-entry-variants.ts');
  const cssV5 = read('styles/platform-v7-public-product-experience-v5.css');
  const intelligenceCss = read('styles/platform-v7-public-intelligence-layer.css');

  it('keeps one Deal as the root product model and preserves every existing section', () => {
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain("className='pc-ppe-hero pc-ppe-hero-copy-only pc-public-intelligence-hero'");
    expect(page).toContain('<PublicDealPreview copy={copy} locale={locale} />');
    expect(page).toContain("id='deal-example'");
    expect(page).toContain("id='participants'");
    expect(page).toContain("id='evidence-contour'");
    expect(page).toContain("id='reliability'");
    expect(page).toContain("className='pc-ppe-final-cta'");
    expect(page).toContain('<PublicGovernmentDataContour locale={locale} />');
    expect(page).not.toContain('entry-control-grid');
    expect(page).not.toContain('entry-role-grid');
    expect(page).not.toContain('PlatformV7IntelligenceStrip');
  });

  it('starts at stage one and retains the complete ten-stage path', () => {
    expect(explorerPage).toContain("stage: 'terms'");
    expect(explorerPage).toContain("perspective: 'buyer'");
    expect(page).toContain('const contourStages = TOUR_STAGES');
    expect(page).toContain("data-active={stage === 'terms' ? 'true' : 'false'}");
    expect(page).toContain('stage=terms&lens=execution&perspective=buyer');
    expect(page).toContain("stageCounter: 'Этап 1 из 10'");
    expect(page).toContain('<PublicStageIntelligenceCoverage locale={locale} stages={stageCoverage} />');
    expect(preview).toContain("selectedStage: 'Выбранный ключевой этап'");
    expect(preview).toContain('stage=terms&lens=execution&perspective=buyer');
    expect(preview).toContain('stage=acceptance&lens=${lens}&perspective=buyer');
    expect(preview).toContain("start: 'Разобрать пример сделки'");
    expect(preview).toContain("current: 'Открыть этап приёмки'");
    expect(preview).toContain("className='pc-ppe-preview-actions pc-public-deal-actions'");
  });

  it('preserves browser-history restoration for the full deal walkthrough', () => {
    expect(explorerAdapter).toContain('normalizeTourStateFromSearchParams');
    expect(explorerAdapter).toContain('new URLSearchParams(window.location.search)');
    expect(explorerAdapter).toContain('normalizedState');
    expect(explorerAdapter).toContain("window.addEventListener('popstate', restorePublicHistoryState)");
    expect(explorerAdapter).toContain('key={historyRevision}');
  });

  it('uses service navigation without client-authoritative role routing', () => {
    expect(page).toContain('nav={nav}');
    expect(page).toContain('showMobileMenu');
    expect(page).toContain("actions={<a href='/platform-v7/login' className='entry-login'");
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).not.toContain("href: '/platform-v7/seller'");
    expect(page).not.toContain("href: '/platform-v7/buyer'");
    expect(explorer).toContain('selectPerspective(event.target.value as TourPerspective)');
    expect(`${explorer}\n${entryGate}`).not.toContain('accessToken');
  });

  it('keeps a single primary hero action and a clear public demonstration boundary', () => {
    const firstHero = page.slice(page.indexOf("className='pc-ppe-hero"), page.indexOf("id='deal-example'"));
    expect(firstHero.match(/className='pc-ppe-primary-button'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='deal_preview_opened'");
    expect(copyV4).toContain("primary: 'Разобрать демонстрационную сделку'");
    expect(copyV4).toContain("demoLabel: 'Демонстрационная сделка'");
    expect(copyV4).toContain('не содержит реальных сделок');
    expect(preview).toContain('preview.demoNote');
    expect(preview).toContain('preview.settlementValue');
    expect(preview).toContain('<PublicDealIntelligencePanel locale={locale} lens={lens} />');
  });

  it('keeps role-first, problem-first and deal-first validation entries', () => {
    expect(explorerPage).toContain('<PublicDealEntryGate');
    expect(explorerPage).toContain('normalizeTourEntryVariant(searchParams?.entry)');
    expect(stateMachine).toContain("export const TOUR_ENTRY_VARIANTS = ['role', 'problem', 'deal'] as const");
    expect(entryGate).toContain('data-entry-variant={entry}');
    expect(entryGate).toContain("'role-first'");
    expect(entryGate).toContain("'problem-first'");
    expect(entryGate).toContain('entryCopy.role.options.slice(0, 5)');
    expect(entryGate).toContain('ui.explorer.entryBadge');
    expect(entryGate).toContain('не влияет на права доступа');
  });

  it('keeps six internal lenses and four public business lenses', () => {
    expect(explorerPage).toContain("data-testid='platform-v7-deal-from-inside'");
    expect(explorer).toContain('TOUR_LENSES.map');
    expect(explorer).toContain('TOUR_PERSPECTIVES.map');
    expect(explorer).toContain('TOUR_SCENARIOS.map');
    expect(explorer).toContain('TOUR_STAGES.map');
    expect(explorerAdapter).toContain("['execution', 'documents', 'money', 'risk']");
    expect(preview).toContain("['execution', 'documents', 'money', 'risk']");
    expect(copy.match(/summary: /g)?.length).toBeGreaterThanOrEqual(18);
  });

  it('uses semantic SVG structures and evidence causality', () => {
    expect(icons).toContain("viewBox='0 0 24 24'");
    expect(icons).toContain("stroke='currentColor'");
    expect(page).toContain('<PublicEvidenceIntelligencePanel');
    expect(evidence).toContain("className='pc-ppe-evidence-chain'");
    expect(evidence).toContain('steps.map');
    expect(evidence).toContain('TAI не придумывает состояние сделки');
    expect(copyV4).toContain("{ label: 'Событие'");
    expect(copyV4).toContain("{ label: 'Основание'");
    expect(copyV4).toContain("{ label: 'Ограничение'");
  });

  it('reserves the protected loading viewport instead of shifting after hydration', () => {
    expect(layout).toContain('.pc-shell-root-v4 .p7-route-loading{min-height:calc(100dvh - 136px)}');
  });

  it('keeps mobile, focus, reduced-motion and forced-colors gates active', () => {
    expect(cssV5).toContain('min-height: 44px');
    expect(cssV5).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssV5).toContain('@media (forced-colors: active)');
    expect(intelligenceCss).toContain('@media (max-width: 1024px)');
    expect(intelligenceCss).toContain('@media (max-width: 820px)');
    expect(intelligenceCss).toContain('@media (max-width: 520px)');
    expect(intelligenceCss).toContain('@media (max-width: 350px)');
    expect(intelligenceCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(intelligenceCss).toContain('@media (forced-colors: active)');
    expect(intelligenceCss).toContain('overflow-x: clip');
    expect(page).toContain('<PublicExperienceScrollCoordinator />');
    expect(explorerPage).toContain('<PublicExperienceScrollCoordinator />');
    expect(analytics).toContain("root.setAttribute('data-pc-ppe-scrolling', 'true')");
  });

  it('implements support as a real accessible dialog', () => {
    expect(support).toContain("role='dialog'");
    expect(support).toContain("aria-modal='true'");
    expect(support).toContain("event.key === 'Escape'");
    expect(support).toContain("event.key !== 'Tab'");
    expect(support).toContain("body.style.position = 'fixed'");
    expect(support).toContain('triggerRef.current?.focus()');
  });

  it('keeps maturity language truthful and external systems fail-safe', () => {
    const combined = `${page}\n${preview}\n${evidence}\n${government}\n${copy}\n${copyV4}\n${entryCopy}`.toLowerCase();
    const forbidden = ['production' + '-ready', 'fully ' + 'live', 'bank ' + 'connected', 'fgis ' + 'connected', 'edo ' + 'connected', 'websocket'];
    for (const token of forbidden) expect(combined).not.toContain(token);
    expect(government).not.toContain("status: 'CONNECTED'");
    expect(government).toContain('Текущая проверка не выполнялась');
    expect(copyV4.toLowerCase()).toContain('controlled pilot / pre-integration');
    expect(copyV4).toContain('не выполняет денежные операции');
  });
});
