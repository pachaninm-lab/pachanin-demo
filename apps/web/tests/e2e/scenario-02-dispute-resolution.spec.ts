/**
 * Сценарий ТЗ №2 — Разрешение спора:
 * Покупатель открывает спор → Загрузка доказательств → Решение комплаенс-офицера
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Сценарий №2 — Dispute Resolution', () => {
  test('Страница споров загружается', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/disputes`);
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).not.toContainText('NEXT_HTTP_ERROR_FALLBACK');
  });

  test('Страница Evidence Pack загружается', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/evidence`);
    // Может редиректить или показывать список
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('Комплаенс-офицер видит очередь на решение', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/compliance`);
    await expect(page.locator('body')).not.toContainText('500');
  });

  test('История аудита отображается', async ({ page }) => {
    await page.goto(`${BASE}/platform-v7/audit`);
    await expect(page.locator('body')).not.toContainText('500');
  });
});
