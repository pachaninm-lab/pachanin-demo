import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 final homepage polish contract', () => {
  const page = read('app/platform-v7/page.tsx');
  const enhancements = read('components/platform-v7/PlatformV7HomeEnhancements.tsx');
  const finalCss = read('components/platform-v7/PlatformV7HomeFinalPolish.css');
  const homeCopy = read('i18n/platform-v7-home-v3.ts');
  const formCss = read('components/platform-v7/OrganizationConnectForm.module.css');
  const formCopy = read('i18n/platform-v7-organization-connect.ts');
  const lighthouseConfig = read('lighthouserc.cjs');
  const scenario = read('components/platform-v7/PublicDealRoleScenario.tsx');
  const scenarioCss = read('components/platform-v7/PublicDealRoleScenario.module.css');
  const browserAcceptance = read('tests/e2e/platform-v7-strategic-home-v3.spec.ts');

  it('uses one final mobile style authority after the baseline density layer', () => {
    const baselineImport = enhancements.indexOf("import './PlatformV7HomeMobileDensity.css';");
    const finalImport = enhancements.indexOf("import './PlatformV7HomeFinalPolish.css';");

    expect(baselineImport).toBeGreaterThan(-1);
    expect(finalImport).toBeGreaterThan(baselineImport);
    expect(page).not.toContain('platform-v7-mobile-10of10-final.css');
  });

  it('reduces the mobile header by 25 percent without first-paint layout shift or sub-44px targets', () => {
    expect(page).toContain('@media (max-width: 767px)');
    expect(page).toContain('.pc-v7-public-entry { --entry-public-header-base: 48px; }');
    expect(finalCss).toContain('--entry-public-header-base: 48px !important');
    expect(finalCss).toContain('--pc-public-header-base-height: 48px !important');
    expect(finalCss).toContain('height: 48px !important');
    expect(finalCss).toContain('min-height: 44px !important');
    expect(finalCss).toContain('width: 44px !important');
    expect(finalCss).toContain('env(safe-area-inset-bottom, 0px)');
    expect(finalCss).toContain('scroll-margin-top: calc(var(--pc-public-header-total-height, 48px) + 12px) !important');
  });

  it('defers expensive below-fold layout while keeping hero and trust content immediate', () => {
    const deferredStart = finalCss.indexOf('@supports (content-visibility: auto)');
    const deferredEnd = finalCss.indexOf('@media (max-width: 767px)');
    const deferredBlock = finalCss.slice(deferredStart, deferredEnd);

    expect(deferredStart).toBeGreaterThan(-1);
    expect(deferredEnd).toBeGreaterThan(deferredStart);
    expect(deferredBlock).toContain('.pc-v7-public-entry #participants');
    expect(deferredBlock).toContain('.pc-v7-public-entry #tai');
    expect(deferredBlock).toContain('.pc-v7-public-entry #connect-organization');
    expect(deferredBlock).toContain('content-visibility: auto !important');
    expect(deferredBlock).toContain('contain-intrinsic-size: auto 1080px !important');
    expect(deferredBlock).not.toContain('.pc-v6-hero {');
    expect(deferredBlock).not.toContain('.pc-v6-trust-strip');
  });

  it('keeps the strict LCP threshold and uses five runs for a stable median', () => {
    expect(lighthouseConfig).toContain('numberOfRuns: 5');
    expect(lighthouseConfig).toContain("'largest-contentful-paint': ['error', { maxNumericValue: 3000");
    expect(lighthouseConfig).toContain("'categories:performance': ['error', { minScore: 0.85");
    expect(lighthouseConfig).not.toContain('maxNumericValue: 3500');
  });

  it('uses the approved mobile H2 scale and compact conversion controls', () => {
    expect(finalCss).toContain('font-size: clamp(32px, 8.35vw, 36px) !important');
    expect(finalCss).toContain('line-height: 1.055 !important');
    expect(finalCss).toContain('font-size: clamp(34px, 8.45vw, 37px) !important');
    expect(finalCss).toContain('gap: 12px !important');
    expect(finalCss).toContain('min-height: 54px !important');
    expect(homeCopy).toContain("title: 'Платформа ведёт Сделку после выбора цены'");
    expect(homeCopy).toContain("title: 'Выплата — по подтверждённым событиям'");
    expect(homeCopy).toContain("title: 'Критические действия требуют основания'");
    expect(homeCopy).toContain("title: 'Подключите организацию к контуру Сделки'");
    expect(homeCopy).not.toContain("title: 'Платформа не заканчивается после выбора цены'");
    expect(homeCopy).not.toContain("title: 'Выплата опирается на подтверждённые события'");
    expect(homeCopy).not.toContain("title: 'Критические действия имеют проверяемое основание'");
    expect(homeCopy).not.toContain("title: 'Подключите организацию к единому контуру Сделки'");
    expect(formCss).toContain('.assurances a { width: fit-content; min-height: 44px;');
    expect(formCss).toContain('.error button { min-height: 44px;');
    expect(formCopy).toContain('Укажите организацию и контакт. На втором шаге — роль и рабочий сценарий.');
    expect(formCopy).toContain('Enter the organisation and contact. Step two confirms the role and operating scenario.');
    expect(formCopy).toContain('填写机构和联系人，第二步确认角色与运营场景。');
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
    expect(scenarioCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(scenarioCss).toContain('@media (max-width: 359px)');
    expect(scenarioCss).toContain('grid-template-columns: 1fr');
    expect(scenarioCss).toContain('overflow-x: auto');
  });

  it('requires exact 390×844 and 430×932 runtime acceptance and visual evidence', () => {
    expect(browserAcceptance).toContain("{ width: 390, height: 844 }");
    expect(browserAcceptance).toContain("{ width: 430, height: 932 }");
    expect(browserAcceptance).toContain('expectExactMobileComposition(page)');
    expect(browserAcceptance).toContain('metric.lines, metric.text');
    expect(browserAcceptance).toContain("'#participants', '#deal-path', '#tai', '#money', '#integrations', '#connect-organization'");
    expect(browserAcceptance).toContain('strategic-home-ru-${viewport.width}x${viewport.height}.png');
  });
});
