import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 strategic transaction-centric public entry', () => {
  const layout = read('app/platform-v7/layout.tsx');
  const page = read('app/platform-v7/page.tsx');
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const homeCopy = read('i18n/platform-v7-home-v3.ts');
  const homeCss = read('styles/platform-v7-strategic-home-v3.css');
  const explorerPage = read('app/platform-v7/how-it-works/page.tsx');
  const explorer = read('components/platform-v7/PublicDealExplorer.tsx');
  const entryGate = read('components/platform-v7/PublicDealEntryGate.tsx');
  const explorerAdapter = read('components/platform-v7/PublicDealExplorerV4.tsx');
  const support = read('components/platform-v7/ChatSupportWidget.tsx');

  it('keeps one Deal as the root product model and exposes the required strategic sections', () => {
    expect(page).toContain('<PlatformV7StrategicHome />');
    expect(home).toContain("className='pc-v6-control-tower'");
    expect(home).toContain("id='deal-path'");
    expect(home).toContain("className='pc-v6-scenario-grid'");
    expect(home).toContain("id='tai'");
    expect(home).toContain("id='participants'");
    expect(home).toContain("id='integrations'");
    expect(home).toContain("id='maturity'");
    expect(home).toContain('pc-v6-faq');
    expect(homeCopy).toContain('Не площадка объявлений. Контур исполнения сделки.');
  });

  it('starts the public walkthrough from Deal terms and buyer perspective', () => {
    expect(explorerPage).toContain("stage: 'terms'");
    expect(explorerPage).toContain("perspective: 'buyer'");
    expect(home).toContain('stage=terms&lens=execution&perspective=buyer');
    expect(homeCopy).toContain("phases: ['Условия', 'Допуск', 'Торги', 'Сделка'");
  });

  it('preserves browser-history restoration for the full deal walkthrough', () => {
    expect(explorerAdapter).toContain('normalizeTourStateFromSearchParams');
    expect(explorerAdapter).toContain('new URLSearchParams(window.location.search)');
    expect(explorerAdapter).toContain("window.addEventListener('popstate', restorePublicHistoryState)");
  });

  it('uses service navigation without client-authoritative role routing', () => {
    expect(home).toContain('nav={nav}');
    expect(home).toContain('showMobileMenu');
    expect(home).toContain("href='/platform-v7/login'");
    expect(home).not.toContain('/platform-v7/login?role=');
    expect(home).not.toContain("href='/platform-v7/seller'");
    expect(home).not.toContain("href='/platform-v7/buyer'");
    expect(explorer).toContain('selectPerspective(event.target.value as TourPerspective)');
    expect(`${explorer}\n${entryGate}`).not.toContain('accessToken');
  });

  it('keeps one high-emphasis hero action and a clear public simulation boundary', () => {
    const firstHero = home.slice(home.indexOf("className='pc-v6-hero'"), home.indexOf("className='pc-v6-category'"));
    expect(firstHero.match(/className='pc-v6-primary'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='hero_primary_cta'");
    expect(homeCopy).toContain('Интерактивный сценарий работы платформы');
    expect(homeCopy).toContain('Средства зарезервированы. Release запрещён');
    expect(home).not.toContain('Math.random');
    expect(home).not.toContain('setInterval');
  });

  it('keeps role-first, problem-first and deal-first validation entries', () => {
    const stateMachine = read('lib/platform-v7/public-product-experience-state.ts');
    expect(explorerPage).toContain('<PublicDealEntryGate');
    expect(explorerPage).toContain('normalizeTourEntryVariant(searchParams?.entry)');
    expect(stateMachine).toContain("export const TOUR_ENTRY_VARIANTS = ['role', 'problem', 'deal'] as const");
    expect(entryGate).toContain('data-entry-variant={entry}');
    expect(entryGate).toContain('не влияет на права доступа');
  });

  it('keeps the existing walkthrough lenses and stage controls', () => {
    expect(explorerPage).toContain("data-testid='platform-v7-deal-from-inside'");
    expect(explorer).toContain('TOUR_LENSES.map');
    expect(explorer).toContain('TOUR_PERSPECTIVES.map');
    expect(explorer).toContain('TOUR_SCENARIOS.map');
    expect(explorer).toContain('TOUR_STAGES.map');
    expect(explorerAdapter).toContain("['execution', 'documents', 'money', 'risk']");
  });

  it('keeps TAI evidence, freshness, confidence and human confirmation visible', () => {
    expect(home).toContain('copy.tai.source');
    expect(home).toContain('copy.tai.freshness');
    expect(home).toContain('copy.tai.confidence');
    expect(home).toContain('copy.tai.action');
    expect(homeCopy).toContain('требуется подтверждение пользователя');
    expect(homeCopy).toContain('TAI не меняет роль или организацию');
  });

  it('reserves the protected loading viewport instead of shifting after hydration', () => {
    expect(layout).toContain('.pc-shell-root-v4 .p7-route-loading{min-height:calc(100dvh - 136px)}');
  });

  it('keeps mobile, touch-target and reduced-motion gates active', () => {
    expect(homeCss).toContain('min-height:44px');
    expect(homeCss).toContain('min-height:48px');
    expect(homeCss).toContain('overflow-x:auto');
    expect(homeCss).toContain('@media(max-width:767px)');
    expect(homeCss).toContain('@media(prefers-reduced-motion:reduce)');
    expect(homeCss).toContain('scroll-snap-type:x mandatory');
  });

  it('implements support as a real accessible dialog mounted at the public layout boundary', () => {
    expect(layout).toContain('<HydrationSafeChatSupport />');
    expect(support).toContain("role='dialog'");
    expect(support).toContain("aria-modal='true'");
    expect(support).toContain("event.key === 'Escape'");
    expect(support).toContain("event.key !== 'Tab'");
    expect(support).toContain('triggerRef.current?.focus()');
  });

  it('ships complete RU EN ZH home copy without Russian inheritance', () => {
    expect(homeCopy).toContain('const en: HomeCopy =');
    expect(homeCopy).toContain('const zh: HomeCopy =');
    expect(homeCopy).not.toContain('...ru');
    expect(homeCopy).toContain("locale === 'en' ? en : locale === 'zh' ? zh : ru");
    expect(home).toContain('copy.a11y.nav');
    expect(home).toContain('copy.footer.privacy');
  });

  it('presents industrial capabilities without development-stage language or false connectivity claims', () => {
    const combined = `${page}\n${home}\n${homeCopy}`.toLowerCase();
    const forbidden = [
      'production' + '-ready',
      'fully ' + 'live',
      'bank ' + 'connected',
      'fgis ' + 'connected',
      'edo ' + 'connected',
      'банк подключён',
      'фгис подключён',
      'эдо подключён',
      'техническая готовность',
      'партнёрская зависимость',
      'не подтверждено',
      'в реализации',
      'websocket',
    ];
    for (const token of forbidden) expect(combined).not.toContain(token);
    expect(homeCopy).toContain('Надёжность исполнения');
    expect(homeCopy).toContain('Контроль встроен в каждый переход Сделки');
    expect(homeCopy).toContain('Прослеживаемость партии');
    expect(homeCopy).toContain('Юридически значимые документы');
    expect(homeCopy).toContain('Промышленные принципы платформы');
  });
});
