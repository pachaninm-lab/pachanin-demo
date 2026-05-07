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

  test('driver field screen keeps work route navigation hidden', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/driver/field', { waitUntil: 'networkidle' });

    await expect(page.getByLabel('Рабочие разделы platform-v7')).toHaveCount(0);
  });
});
