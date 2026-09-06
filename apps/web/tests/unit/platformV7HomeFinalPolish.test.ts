import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 final homepage polish contract', () => {
  const page = read('app/platform-v7/page.tsx');
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

  it('preserves compact mobile header and minimum touch targets', () => {
    expect(finalCss).toContain('--entry-public-header-base: 48px !important');
    expect(finalCss).toContain('--pc-public-header-base-height: 48px !important');
    expect(finalCss).toContain('height: 48px !important');
    expect(finalCss).toContain('min-height: 44px !important');
    expect(finalCss).toContain('width: 44px !important');
    expect(finalCss).toContain("env(safe-area-inset-bottom, 0px)");
    expect(page).toContain('--entry-public-header-base: 48px');
  });

  it('keeps product proposition and registration before explanatory detail', () => {
    expect(heroCopy).toContain("title: 'Управляйте агросделкой'");
    expect(heroCopy).toContain('Одна платформа связывает товар и условия');
    const hero = home.indexOf("className={`pc-v6-hero ${styles.hero}`}");
    const register = home.indexOf("eventName='registration_open'");
    const roles = home.indexOf("id='participants'");
    const path = home.indexOf("id='deal-path'");
    const tai = home.indexOf("id='tai'");
    expect(register).toBeGreaterThan(hero);
    expect(roles).toBeGreaterThan(hero);
    expect(path).toBeGreaterThan(roles);
    expect(tai).toBeGreaterThan(path);
  });

  it('presents Gekta as a bounded cross-cutting capability rather than a Deal phase', () => {
    expect(home).toContain("id='tai'");
    expect(storyCopy).toContain("title: 'Контроль и Гекта'");
    expect(storyCopy).toContain('Гекта объясняет доступные факты и риски');
    expect(storyCopy).toContain("processTitle: 'Семь шагов обычной агросделки'");
    expect(storyCopy).not.toContain("title: 'Анализ Гекты'");
  });

  it('keeps the Hero Deal progress rail structurally seven-stage and visually quiet', () => {
    expect(home).toContain("className={`${styles.heroDealProgress} pc-public-deal-stage-rail pc-public-deal-stage-rail--hero`}");
    expect(home).toContain('aria-valuemax={story.demo.stages.length}');
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
    expect(scenario).toContain("label: 'Сотрудник платформы'");
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
