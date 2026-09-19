import { expect, test } from '@playwright/test';

const WORK_LINKS = [
  'Центр управления',
  'Сделки',
  'Лоты и запросы',
  'Партии',
  'Предложения',
  'Логистика',
  'Деньги',
  'Документы',
  'Споры',
  'Подключения',
  'Поддержка',
] as const;

const DRIVER_FORBIDDEN_VISIBLE_CHROME = [
  'Центр управления',
  'Сделки',
  'Лоты и запросы',
  'Партии',
  'Предложения',
  'Деньги',
  'Споры',
  'Подключения',
] as const;

test.describe('platform-v7 work route navigation', () => {
  test('main work routes are visible from operational screens', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/seller', { waitUntil: 'networkidle' });

    const nav = page.getByLabel('Рабочие разделы platform-v7');
    await expect(nav).toBeVisible();

    for (const label of WORK_LINKS) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('driver routes keep work route navigation and broad platform chrome hidden', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ['/platform-v7/driver', '/platform-v7/driver/field']) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await expect(page.getByLabel('Рабочие разделы platform-v7')).toHaveCount(0);
      await expect(page.locator('.pc-v4-mobile-role')).toBeHidden();
      await expect(page.locator('.pc-v4-search')).toBeHidden();

      for (const label of DRIVER_FORBIDDEN_VISIBLE_CHROME) {
        await expect(page.getByText(label, { exact: true })).toHaveCount(0);
      }
    }
  });
});
