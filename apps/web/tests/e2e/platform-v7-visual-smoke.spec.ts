import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7/lots',
  '/platform-v7/lots/LOT-2403/bids',
  '/platform-v7/deals/DL-9116',
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
  'callbacks',
  'evidence-first',
  'release',
  'hold',
  'owner',
  'blocker',
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

async function bodyText(page: import('@playwright/test').Page): Promise<string> {
  await expect(page.locator('body')).toBeVisible();
  return page.locator('body').innerText();
}

test.describe('platform-v7 execution visual gates', () => {
  for (const route of routes) {
    test(`${route} has visible product content and no forbidden visible copy`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();

      await expect(page.locator('body')).toBeVisible();
      const text = await bodyText(page);
      expect(text.trim().length, `${route} should render meaningful content`).toBeGreaterThan(80);

      for (const copy of forbiddenVisibleCopy) {
        expect(text, `${route} should not show ${copy}`).not.toContain(copy);
      }

      const brokenImages = await page.locator('img:visible').evaluateAll((images) =>
        images
          .filter((img) => img instanceof HTMLImageElement)
          .filter((img) => !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0)
          .map((img) => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') }))
      );

      expect(brokenImages, `${route} should not have broken visible images`).toEqual([]);
    });
  }

  test('/platform-v7/lots/LOT-2403/bids exposes seller bid comparison', async ({ page }) => {
    const response = await page.goto('/platform-v7/lots/LOT-2403/bids', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await bodyText(page);
    await expect(page.getByText('Сравнение ставок')).toBeVisible();
    expect(text).toContain('Покупатель A');
    expect(text).toContain('Покупатель B');
    expect(text).toContain('Покупатель C');
    expect(text).toContain('Принять');
  });

  test('/platform-v7/deals/DL-9116 exposes accepted bid to deal timeline', async ({ page }) => {
    const response = await page.goto('/platform-v7/deals/DL-9116', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await bodyText(page);
    await expect(page.getByText('Экономика из принятой ставки')).toBeVisible();
    await expect(page.getByText('Таймлайн исполнения')).toBeVisible();
    expect(text).toContain('Ставка принята');
    expect(text).toContain('Сделка создана');
    expect(text).toContain('Заявка в логистику создана');
    expect(text).toContain('К выпуску денег');
  });

  test('/platform-v7/buyer hides competing bids and seller floor in sealed mode', async ({ page }) => {
    const response = await page.goto('/platform-v7/buyer', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await bodyText(page);
    await expect(page.getByText('Ваша ставка')).toBeVisible();
    await expect(page.getByText('Сделать ставку')).toBeVisible();

    expect(text).not.toContain('Минимум продавца');
    expect(text).not.toContain('Лучшая ставка');
    expect(text).not.toContain('Покупатель A');
    expect(text).not.toContain('Покупатель B');
    expect(text).not.toContain('Покупатель C');
  });

  test('/platform-v7/driver exposes only field trip context', async ({ page }) => {
    const response = await page.goto('/platform-v7/driver', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const text = await bodyText(page);
    await expect(page.getByText('Полевой экран')).toBeVisible();
    await expect(page.getByText('Полевые действия')).toBeVisible();

    for (const forbidden of ['₽', 'Цена', 'Ставка', 'Оплата', 'Резерв', 'Деньги', 'Инвестор', 'Покупатель A', 'Покупатель B', 'Покупатель C']) {
      expect(text, `driver must not see ${forbidden}`).not.toContain(forbidden);
    }
  });

  test('/platform-v7/logistics routes hide trade economics and banking context', async ({ page }) => {
    for (const route of ['/platform-v7/logistics/requests', '/platform-v7/logistics/trips']) {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();
      const text = await bodyText(page);

      expect(text, `${route} should show transport work`).toMatch(/Логистика|Рейс|Маршрут|Погрузка|Выгрузка/);
      for (const forbidden of ['Цена ожидания', 'Лучшая ставка', 'Минимум продавца', 'Покупатель A', 'Покупатель B', 'Покупатель C', 'Резерв', 'Деньги под риском', 'К выпуску']) {
        expect(text, `${route} must not see ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test('/platform-v7/elevator and /platform-v7/lab hide bid fight and bank reserve context', async ({ page }) => {
    for (const route of ['/platform-v7/elevator', '/platform-v7/lab']) {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();
      const text = await bodyText(page);

      expect(text, `${route} should show execution facts`).toMatch(/Сделка|Рейс|приёмка|Лаборатория|Протокол|Вес/);
      for (const forbidden of ['Покупатель A', 'Покупатель B', 'Покупатель C', 'Минимум продавца', 'Лучшая ставка', 'Резерв', 'Инвестор', 'Маржа']) {
        expect(text, `${route} must not see ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
