import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/bank',
  '/platform-v7/bank/events',
  '/platform-v7/bank/release-safety',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/disputes/DK-2024-89',
  '/platform-v7/dispute/DK-2024-89',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/investor',
  '/platform-v7/operator',
  '/platform-v7/status',
  '/platform-v7/profile',
  '/platform-v7/auth',
  '/platform-v7/support',
  '/platform-v7/support/new',
  '/platform-v7/support/operator',
  '/platform-v7/deals/grain-release',
  '/platform-v7/demo',
  '/platform-v7/demo/execution-flow',
  '/platform-v7/simulator',
  '/platform-v7/trust',
  '/platform-v7/reports',
] as const;

const forbiddenVisibleTerms = [
  'Controlled pilot',
  'callbacks',
  'evidence-first',
  'Simulation-grade',
  'simulation-grade',
  'sandbox projection',
  'sandbox dispatch',
  'sandbox',
  'domain-core',
  'guard-правила',
  'guard',
  'runtime-контур',
  'runtime',
  'release callbacks',
  'Action handoff',
  'requestReserve',
  'legacy-логика',
  'legacy',
  'Live GPS',
  'production-ready',
  'fully live',
  'fully integrated',
  'complete product',
  'no risks',
  'нет аналогов',
  'без рисков',
  'всё готово',
  'полностью готово',
  'гарантирует оплату',
  'прямой выпуск',
  'выпустить сейчас',
] as const;

const forbiddenVisiblePatterns = [
  /банк\s+[^\n]{0,24}подключ[её]н/i,
  /ФГИС\s+[^\n]{0,24}подключ[её]н/i,
  /ЭДО\s+[^\n]{0,24}подключ[её]н/i,
  /ЭПД\s+[^\n]{0,24}подключ[её]н/i,
  /ГИС\s+ЭПД\s+[^\n]{0,24}подключ[её]н/i,
  /bank\s+[^\n]{0,24}connected/i,
  /FGIS\s+[^\n]{0,24}connected/i,
  /EDO\s+[^\n]{0,24}connected/i,
  /EPD\s+[^\n]{0,24}connected/i,
  /live\s+[^\n]{0,24}(bank|FGIS|EDO|EPD)/i,
  /платформа\s+[^\n]{0,32}гарантир[^\n]{0,16}оплат/i,
  /платформа\s+[^\n]{0,32}выпускает\s+деньги/i,
  /оплат[аы]\s+[^\n]{0,32}гарантирован[аы]\s+[^\n]{0,32}платформ/i,
  /payment\s+[^\n]{0,32}guaranteed\s+[^\n]{0,32}platform/i,
  /platform\s+[^\n]{0,32}releases\s+money/i,
  /AI\s+[^\n]{0,32}binding\s+decisions/i,
  /ИИ\s+[^\n]{0,32}обязательн[^\n]{0,16}решен/i,
] as const;

test.describe('platform-v7 forbidden user-facing copy', () => {
  for (const route of routes) {
    test(`${route} does not expose forbidden technical or inflated copy`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();

      const visibleText = await page.locator('body').innerText();

      for (const term of forbiddenVisibleTerms) {
        expect(visibleText, `${route} should not expose "${term}"`).not.toContain(term);
      }

      for (const pattern of forbiddenVisiblePatterns) {
        expect(visibleText, `${route} should not match ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});
