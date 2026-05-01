import { expect, test } from '@playwright/test';

const viewports = [320, 360, 375, 390, 393, 402, 414, 430, 480, 540, 768, 820, 834, 1024, 1280, 1366, 1440, 1536] as const;

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

test.describe('platform-v7 mobile release gates', () => {
  for (const width of viewports) {
    for (const route of routes) {
      test(`${route} has no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        expect(response?.ok(), `${route} should return ok response`).toBeTruthy();
        await expect(page.locator('body')).toBeVisible();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${route} should not overflow horizontally at ${width}px`).toBeLessThanOrEqual(1);
      });
    }
  }

  test('driver field shell keeps commercial and banking surfaces out of DOM', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/driver', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-driver-field-shell')).toBeVisible();

    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of ['банк', 'инвестор', 'ставк', 'сумма сделки', 'цена зерна', 'роль']) {
      expect(bodyText, `driver shell must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  test('driver primary actions meet minimum touch target size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/driver', { waitUntil: 'networkidle' });

    const boxes = await page.getByTestId('platform-v7-driver-field-shell').locator('span').evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const text = node.textContent ?? '';
          return { text, width: rect.width, height: rect.height };
        })
        .filter((box) => ['Я прибыл на погрузку', 'Подтвердить загрузку', 'Прикрепить фото', 'Подтвердить пломбу', 'Начать рейс', 'Я прибыл на выгрузку', 'Подтвердить вес', 'Сообщить об отклонении'].includes(box.text))
    );

    expect(boxes.length).toBeGreaterThanOrEqual(8);
    for (const box of boxes) {
      expect(box.width, `${box.text} width should be at least 44px`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${box.text} height should be at least 44px`).toBeGreaterThanOrEqual(44);
    }
  });
});
