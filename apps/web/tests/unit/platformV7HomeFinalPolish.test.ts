import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 final homepage polish contract', () => {
  const page = read('app/platform-v7/page.tsx');
  const siteHeader = read('components/platform-v7/PublicSiteHeader.tsx');
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const enhancements = read('components/platform-v7/PlatformV7HomeEnhancements.tsx');
  const finalCss = read('components/platform-v7/PlatformV7HomeFinalPolish.css');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const storyCopy = read('i18n/platform-v7-home-story-product.ts');
  const formCss = read('components/platform-v7/OrganizationConnectForm.module.css');
  const scenario = read('components/platform-v7/PublicDealRoleScenario.tsx');
  const scenarioCss = read('components/platform-v7/PublicDealRoleScenario.module.css');

  it('keeps legacy polish authority ordered without adding another live homepage copy source', () => {
    const baselineImport = enhancements.indexOf("import './PlatformV7HomeMobileDensity.css';");
    const finalImport = enhancements.indexOf("import './PlatformV7HomeFinalPolish.css';");
    expect(baselineImport).toBeGreaterThan(-1);
    expect(finalImport).toBeGreaterThan(baselineImport);
    expect(enhancements).not.toContain('PlatformV7HomeHeroAcceptance.css');
    expect(page).not.toContain('platform-v7-mobile-10of10-final.css');
    expect(page).not.toContain('.pc-v6-kicker::before');
    expect(page).not.toContain('font-size: 0');
  });

  it('preserves the canonical 64px mobile header and minimum touch targets', () => {
    expect(siteHeader).toContain(".pc-site-header[data-public-site-header='canonical'].pc-site-header.pc-site-header");
    expect(siteHeader).toContain('--pc-public-header-base-height: 64px');
    expect(siteHeader).toContain('height: 64px !important');
    expect(siteHeader).toContain('min-width: 44px !important');
    expect(finalCss).toContain('min-height: 44px !important');
    expect(finalCss).toContain('width: 44px !important');
    expect(finalCss).toContain("env(safe-area-inset-bottom, 0px)");
    expect(page).not.toContain('--entry-public-header-base: 48px');
  });

  it('keeps product proposition and registration before explanatory detail', () => {
    for (const fragment of [
      "title: 'От лота и цены'", "accent: 'до поставки, качества и расчёта'",
      '«Прозрачная Цена» связывает продавца, покупателя и исполнителей в одной Сделке',
      "title: 'From lot and price'", "accent: 'to delivery, quality and settlement'",
      'Transparent Price connects seller, buyer and execution parties in one Deal',
      "title: '从批次和价格'", "accent: '到交付、质量与结算'",
      '“透明价格”把卖方、买方和履约参与方连接在同一笔交易中',
    ]) expect(heroCopy).toContain(fragment);
    const hero = home.indexOf("className='pc-final-hero'");
    expect(hero).toBeGreaterThan(-1);
    const register = home.indexOf("eventName='registration_open'");
    const roles = home.indexOf("id='participants'");
    const path = home.indexOf("id='deal-path'");
    const tai = home.indexOf("id='gekta'");
    expect(register).toBeGreaterThan(hero);
    expect(roles).toBeGreaterThan(hero);
    expect(path).toBeGreaterThan(register);
    expect(roles).toBeGreaterThan(path);
    expect(tai).toBeGreaterThan(roles);
  });

  it('presents Gekta as a bounded cross-cutting capability rather than a Deal phase', () => {
    expect(home).toContain("id='gekta'");
    expect(storyCopy).toContain("title: 'Контроль и Гекта'");
    expect(storyCopy).toContain('Гекта объясняет доступные факты и риски');
    expect(storyCopy).toContain("processTitle: 'Семь шагов обычной агросделки'");
    expect(storyCopy).not.toContain("title: 'Анализ Гекты'");
  });

  it('keeps the seven-stage journey keyboard reachable and visually quiet', () => {
    expect(home).toContain("<ol className='pc-final-stages' tabIndex={0} aria-labelledby='journey-title'>");
    expect(home).toContain('copy.journey.stages.map(');
    expect(home).not.toContain('heroCurrentStepIndex');
    expect(page).toContain('grid-template-columns: repeat(7, minmax(0, 1fr)) !important');
    expect(page).toContain('padding-bottom: 14px !important');
    expect(page).toContain(".pc-public-deal-stage-rail--hero small {\n  display: none !important;");
  });

  it('uses the approved mobile H2 scale and compact conversion controls', () => {
    expect(finalCss).toContain('font-size: clamp(32px, 8.35vw, 36px) !important');
    expect(finalCss).toContain('line-height: 1.055 !important');
    expect(finalCss).toContain('font-size: clamp(34px, 8.45vw, 37px) !important');
    expect(finalCss).toContain('gap: 12px !important');
    expect(finalCss).toContain('min-height: 54px !important');
    expect(formCss).toContain('.assurances a { width: fit-content; min-height: 44px;');
    expect(formCss).toContain('.error button { min-height: 44px;');
  });

  it('renders a product-shaped role workspace using clearly illustrative public data', () => {
    expect(scenario).toContain('className={styles.workspace}');
    expect(scenario).toContain('className={styles.stageRail}');
    expect(scenario).toContain('className={styles.metrics}');
    expect(scenario).toContain('className={styles.rolePanel}');
    expect(scenario).toContain("preview: 'Упрощённый экран рабочего кабинета'");
    expect(scenario).toContain("label: 'Сотрудник подключённой организации'");
    expect(scenario.toLowerCase()).not.toContain('confirmed_live');
    expect(scenario).not.toContain('accessToken');
  });

  it('keeps the workspace mobile-first and free from page-level horizontal overflow', () => {
    expect(finalCss).toContain('overflow-x: clip');
    expect(finalCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(scenarioCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(scenarioCss).toContain('@media (max-width: 359px)');
    expect(scenarioCss).toContain('grid-template-columns: 1fr');
    expect(scenarioCss).toContain('overflow-x: auto');
  });
});
