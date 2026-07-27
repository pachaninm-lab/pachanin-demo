import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 final master public entry', () => {
  const layout = read('app/platform-v7/layout.tsx');
  const page = read('app/platform-v7/page.tsx');
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const homeCopy = read('i18n/platform-v7-home-v3.ts');
  const storyCopy = read('i18n/platform-v7-home-story.ts');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const homeCss = read('styles/platform-v7-strategic-home-v3.css');
  const storyCss = read('components/platform-v7/PlatformV7StrategicHomeStory.module.css');
  const dockCss = read('app/pc-public-entry/platform-v7/home-approved-contact-dock.css');
  const finalCss = read('components/platform-v7/PlatformV7HomeFinalPolish.css');
  const explorerPage = read('app/platform-v7/how-it-works/page.tsx');
  const explorer = read('components/platform-v7/PublicDealExplorer.tsx');
  const entryGate = read('components/platform-v7/PublicDealEntryGate.tsx');
  const explorerAdapter = read('components/platform-v7/PublicDealExplorerV4.tsx');
  const support = read('components/platform-v7/ChatSupportWidget.tsx');

  it('renders the complete final v4 narrative and the durable connection form', () => {
    expect(page).toContain('export default function PlatformV7RootPage()');
    expect(page).toContain('<PlatformV7StrategicHome />');
    expect(home).toContain('export function PlatformV7StrategicHome()');
    expect(home).toContain('const locale = publicHomeLocale(useLocale());');
    for (const anchor of [
      "id='difference'",
      "id='functions'",
      "id='deal-path'",
      "id='live'",
      "id='participants'",
      "id='tai'",
      "id='maturity'",
      "id='integrations'",
      "id='faq'",
    ]) expect(home).toContain(anchor);
    expect(home).toContain('<PublicDealRoleScenario locale={locale} />');
    expect(home).toContain('<OrganizationConnectForm locale={locale} />');
    expect(home).toContain("id={index === 2 ? 'money' : undefined}");
  });

  it('publishes the approved functional and execution coverage', () => {
    for (const index of ['01', '02', '03', '04', '05', '06', '07', '08']) {
      expect(storyCopy).toContain(`index: '${index}'`);
    }
    expect(storyCopy).toContain("title: 'Цена'");
    expect(storyCopy).toContain("title: 'Контроль'");
    expect(storyCopy).toContain("title: 'Расчёт и закрытие'");
    expect(storyCopy).toContain("fullPathText: '19 этапов");
    expect(homeCopy).toContain("phases: ['Условия', 'Допуск', 'Торги', 'Победитель'");
    expect(home).toContain("className='pc-v6-lifecycle'");
  });

  it('preserves the public walkthrough and informational role routing', () => {
    expect(explorerPage).toContain("stage: 'terms'");
    expect(explorerPage).toContain("perspective: 'buyer'");
    expect(home).toContain('stage=terms&lens=execution&perspective=buyer');
    expect(explorerAdapter).toContain('normalizeTourStateFromSearchParams');
    expect(explorerAdapter).toContain("window.addEventListener('popstate', restorePublicHistoryState)");
    expect(explorer).toContain('TOUR_LENSES.map');
    expect(explorer).toContain('TOUR_PERSPECTIVES.map');
    expect(explorer).toContain('TOUR_SCENARIOS.map');
    expect(entryGate).toContain('не влияет на права доступа');
    expect(home).not.toContain('/platform-v7/login?role=');
  });

  it('states architecture and integration maturity without false-live language', () => {
    const combined = `${page}\n${home}\n${homeCopy}\n${storyCopy}`.toLowerCase();
    for (const token of [
      'production-ready',
      'fully live',
      'банк подключён',
      'фгис подключён',
      'эдо подключён',
      'confirmed_live',
      'integration connected',
      'websocket',
    ]) expect(combined).not.toContain(token);
    expect(storyCopy).toContain('private cloud и on-premise');
    expect(storyCopy).toContain('Ролевой доступ');
    expect(storyCopy).toContain('Проверяемая история');
    expect(storyCopy).toContain('Без fake-live');
    expect(storyCopy).toContain('Эксплуатационная зрелость и интеграции подтверждаются только фактическими результатами');
  });

  it('ships explicit RU EN ZH copy and the final approved hero', () => {
    expect(storyCopy).toContain('ru: {');
    expect(storyCopy).toContain('en: {');
    expect(storyCopy).toContain('zh: {');
    expect(storyCopy).not.toContain('...ru');
    expect(heroCopy).toContain("title: 'Manage an agricultural Deal'");
    expect(heroCopy).toContain("title: '管理农业交易'");
    expect(heroCopy).toContain("title: 'Управляйте агросделкой'");
  });

  it('preserves mobile, touch-target, reduced-motion and help gates', () => {
    expect(layout).toContain('.pc-shell-root-v4 .p7-route-loading{min-height:calc(100dvh - 136px)}');
    expect(homeCss).toContain('@media (max-width: 767px)');
    expect(homeCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(storyCss).toMatch(/@media\s*\(max-width:\s*767px\)/);
    expect(storyCss).toMatch(/@media\s*\(max-width:\s*359px\)/);
    expect(storyCss).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    expect(storyCss).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(dockCss).toContain('min-height: 46px');
    expect(finalCss).toContain('min-height: 44px !important');
    expect(support).toContain("role='dialog'");
    expect(support).toContain("aria-modal='true'");
  });

  it('keeps site landmarks and responsive disclosures available to assistive technology', () => {
    expect(home).toContain("className={`pc-v6-page pc-v7-public-entry ${styles.root}`}");
    expect(home).toContain("<main id='main-content' tabIndex={-1}>");
    expect(home).not.toContain("<main id='main-content' className='pc-v6-page");
    expect(home).not.toContain('<aside');
    expect(home.match(/pc-v6-control-tower/g)).toHaveLength(1);
    for (const id of ['difference-more-toggle', 'functions-more-toggle', 'phases-more-toggle']) {
      expect(home).toContain(`id='${id}'`);
    }
    expect(home).not.toContain('<details className={styles.moreRows}>');
    expect(home).not.toContain('<details className={styles.moreCards}>');
    expect(storyCss).toContain('.root :global(.pc-site-header)');
    expect(storyCss).toContain('font-family: var(--pc-entry-font-body) !important');
    expect(storyCss).toContain('.root :global(.pc-site-brand)');
    expect(storyCss).toContain('.moreContentToggle:focus-visible ~ .moreContentLabel');
  });

  it('keeps comparison and integration data in valid accessible table structures', () => {
    expect(home).toContain("className={styles.comparisonTable} role='table' aria-labelledby='difference-title'");
    expect(home.match(/className=\{styles\.comparisonTable\} role='table'/g)).toHaveLength(1);
    expect(home).toContain("id='difference-comparison-rows' className={styles.comparisonRows} role='rowgroup'");
    expect(home).toContain("data-comparison-row='true'");
    expect(home).toContain("<strong role='rowheader'>{row.criterion}</strong>");
    expect(home).toContain("className={styles.integrationTable} role='table' aria-labelledby='integrations-title'");
    expect(home).toContain("className={styles.integrationRows} role='rowgroup'");
    expect(home).toContain("className={styles.integrationRow} role='row'");
    expect(home).not.toMatch(/<article[^>]+role='row'/);
  });
});
