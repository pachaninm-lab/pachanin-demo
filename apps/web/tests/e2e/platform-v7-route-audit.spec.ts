import { expect, test } from '@playwright/test';

const p0Routes = [
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/bank',
  '/platform-v7/bank/clean',
  '/platform-v7/bank/events',
  '/platform-v7/bank/release-safety',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/disputes/DK-2024-89',
  '/platform-v7/dispute/DK-2024-89',
  '/platform-v7/deals/DL-9102/clean',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/investor',
  '/platform-v7/demo',
  '/platform-v7/demo/execution-flow',
  '/platform-v7/simulator',
  '/platform-v7/trust',
  '/platform-v7/reports',
] as const;

const forbiddenVisibleCopy = [
  'Controlled pilot',
  'Simulation-grade',
  'evidence-first',
  'domain-core',
  'Action handoff',
  'requestReserve',
  'fully live',
  'fully integrated',
  'production-ready',
] as const;

test.describe('platform-v7 route audit baseline', () => {
  for (const route of p0Routes) {
    test(`${route} returns an application page without crash copy`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();
      await expect(page.locator('body'), `${route} should render body`).toBeVisible();
      await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i'), `${route} should not render crash or 404 copy`).toHaveCount(0);

      for (const term of forbiddenVisibleCopy) {
        await expect(page.getByText(term, { exact: false }), `${route} should not show ${term}`).toHaveCount(0);
      }
    });
  }

  test('clean routes render stable Russian pilot copy', async ({ page }) => {
    await page.goto('/platform-v7/deals/DL-9102/clean', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Карточка сделки' })).toBeVisible();
    await expect(page.getByText('Стабильная пилотная карточка исполнения сделки.')).toBeVisible();

    await page.goto('/platform-v7/bank/clean', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Деньги по сделкам' })).toBeVisible();
    await expect(page.getByText('Стабильная пилотная страница контроля денег по сделке.')).toBeVisible();
  });
});
