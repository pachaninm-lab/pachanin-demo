import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7/lots',
  '/platform-v7/lots/LOT-2403/bids',
  '/platform-v7/deals/DL-9116',
  '/platform-v7/bank/release-safety',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics/requests',
  '/platform-v7/logistics/trips',
  '/platform-v7/driver',
  '/platform-v7/elevator',
  '/platform-v7/lab',
];

const forbiddenVisibleCopy = [
  'Control Tower',
  'callback',
  'evidence-first',
  'sandbox dispatch',
  'Action handoff',
  'domain-core',
  'runtime',
  'idempotency',
  'guard',
  'legacy',
  'mock',
  'debug',
  'test user',
];

async function readBody(page: import('@playwright/test').Page): Promise<string> {
  await expect(page.locator('body')).toBeVisible();
  return page.locator('body').innerText();
}

test.describe('platform-v7 visual smoke gates', () => {
  for (const route of routes) {
    test(`${route} renders meaningful clean content`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();

      const text = await readBody(page);
      expect(text.trim().length).toBeGreaterThan(80);

      for (const copy of forbiddenVisibleCopy) {
        expect(text, `${route} should not show ${copy}`).not.toContain(copy);
      }
    });
  }

  test('seller bid route exposes bid lifecycle actions', async ({ page }) => {
    await page.goto('/platform-v7/lots/LOT-2403/bids', { waitUntil: 'networkidle' });
    const text = await readBody(page);

    await expect(page.getByText('Сравнение ставок')).toBeVisible();
    await expect(page.getByText('Действия продавца по ставкам')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Принять' }).first()).toBeVisible();
    expect(text).toContain('Покупатель A');
    expect(text).toContain('Покупатель B');
    expect(text).toContain('Покупатель C');
  });

  test('buyer sealed-mode route hides competing bid data and exposes own actions', async ({ page }) => {
    await page.goto('/platform-v7/buyer', { waitUntil: 'networkidle' });
    const text = await readBody(page);

    await expect(page.getByText('Ваша ставка')).toBeVisible();
    await expect(page.getByText('Действия покупателя по своей ставке')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Повысить на 100 ₽/т' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отозвать ставку' })).toBeVisible();

    for (const forbidden of ['Минимум продавца', 'Лучшая ставка', 'Покупатель A', 'Покупатель B', 'Покупатель C']) {
      expect(text, `buyer must not see ${forbidden}`).not.toContain(forbidden);
    }
  });

  test('driver shell hides commercial and banking context', async ({ page }) => {
    await page.goto('/platform-v7/driver', { waitUntil: 'networkidle' });
    const text = await readBody(page);

    await expect(page.getByText('Полевой экран')).toBeVisible();
    await expect(page.getByText('Полевые действия')).toBeVisible();

    for (const forbidden of ['₽', 'Цена', 'Ставка', 'Оплата', 'Резерв', 'Деньги', 'Инвестор']) {
      expect(text, `driver must not see ${forbidden}`).not.toContain(forbidden);
    }
  });

  test('logistics routes hide bid economics and banking context', async ({ page }) => {
    for (const route of ['/platform-v7/logistics/requests', '/platform-v7/logistics/trips']) {
      await page.goto(route, { waitUntil: 'networkidle' });
      const text = await readBody(page);
      expect(text).toMatch(/Логистика|Рейс|Маршрут|Погрузка|Выгрузка/);
      for (const forbidden of ['Цена ожидания', 'Лучшая ставка', 'Минимум продавца', 'Покупатель A', 'Покупатель B', 'Покупатель C']) {
        expect(text, `${route} must not see ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
