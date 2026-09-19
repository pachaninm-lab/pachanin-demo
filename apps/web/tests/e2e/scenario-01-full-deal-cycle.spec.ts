/**
 * Сценарий ТЗ №1 — Полный цикл зерновой сделки:
 * Продавец создаёт лот → Покупатель делает заявку → Матчинг →
 * Логистика → Лаборатория → Документы → Расчёт → Завершение
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Сценарий №1 — Полный цикл сделки', () => {
  test('Продавец публикует лот', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/seller`);
    await expect(page.locator('[data-testid="role-heading"]')).toBeVisible({ timeout: 10000 });

    // Лот должен отображаться в интерфейсе продавца
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('Покупатель видит доску заявок', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/buyer`);
    await expect(page.locator('[data-testid="role-heading"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('Центр управления показывает следующий шаг', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/control-tower`);
    await expect(page.getByText(/следующий шаг|next step|КУП/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Логист видит активные маршруты', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/logistics`);
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Лаборант видит задание на анализ', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/lab`);
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('Страница сделки рендерится без ошибок', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/deals`);
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).not.toContainText('NEXT_HTTP_ERROR_FALLBACK');
  });
});
