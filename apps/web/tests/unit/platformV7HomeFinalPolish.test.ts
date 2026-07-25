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
  const formCss = read('components/platform-v7/OrganizationConnectForm.module.css');
  const scenario = read('components/platform-v7/PublicDealRoleScenario.tsx');
  const scenarioCss = read('components/platform-v7/PublicDealRoleScenario.module.css');

  it('uses one final mobile style authority after the baseline density layer', () => {
    const baselineImport = enhancements.indexOf("import './PlatformV7HomeMobileDensity.css';");
    const finalImport = enhancements.indexOf("import './PlatformV7HomeFinalPolish.css';");

    expect(baselineImport).toBeGreaterThan(-1);
    expect(finalImport).toBeGreaterThan(baselineImport);
    expect(enhancements).not.toContain('PlatformV7HomeHeroAcceptance.css');
    expect(page).not.toContain('platform-v7-mobile-10of10-final.css');
  });

  it('reduces the mobile header by 25 percent without shrinking touch targets below 44px', () => {
    expect(finalCss).toContain('--entry-public-header-base: 48px !important');
    expect(finalCss).toContain('--pc-public-header-base-height: 48px !important');
    expect(finalCss).toContain('height: 48px !important');
    expect(finalCss).toContain('min-height: 44px !important');
    expect(finalCss).toContain('width: 44px !important');
    expect(finalCss).toContain("env(safe-area-inset-bottom, 0px)");
    expect(finalCss).toContain('scroll-margin-top: calc(var(--pc-public-header-total-height, 48px) + 12px) !important');
    expect(page).toContain('--entry-public-header-base: 48px');
  });

  it('keeps the first screen Deal-first and places product UI before secondary proof blocks', () => {
    expect(heroCopy).toContain("brand: 'Одна Сделка'");
    expect(heroCopy).not.toContain("brand: 'Прозрачная Цена'");
    expect(home.indexOf("className='pc-v6-control-tower'")).toBeGreaterThan(home.indexOf("className='pc-v6-hero-copy'"));
    expect(home.indexOf("className='pc-v6-hero-proofs'")).toBeGreaterThan(home.indexOf("className='pc-v6-control-tower'"));
    expect(home.indexOf("id='participants'")).toBeLessThan(home.indexOf('<PublicRoleEntrances'));
  });

  it('presents TAI as a distinct agribusiness product without separating it from Deal execution', () => {
    expect(home).toContain('Отдельный AI-продукт для агробизнеса');
    expect(home).toContain('Собственный операционный интеллект для агробизнеса');
    expect(home).toContain('Deal Intelligence');
    expect(home).toContain('Document Intelligence');
    expect(home).toContain("id='tai'");
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

  it('renders a real product-shaped Deal execution workspace without fake-live claims', () => {
    expect(scenario).toContain('className={styles.workspace}');
    expect(scenario).toContain('className={styles.stageRail}');
    expect(scenario).toContain('className={styles.metrics}');
    expect(scenario).toContain('className={styles.rolePanel}');
    expect(scenario).toContain('Пример интерфейса · данные сценария');
    expect(scenario).toContain('Interface example · scenario data');
    expect(scenario).toContain('界面示例 · 场景数据');
    expect(scenario.toLowerCase()).not.toContain('confirmed_live');
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
