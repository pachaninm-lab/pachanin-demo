/**
 * E2E Deal Simulation — ТЗ 6.4 / ТЗ 15.2
 * Полный цикл сделки: создание → переговоры → подписание → оплата →
 * логистика → приёмка → качество → ЭДО → закрытие
 *
 * Этот тест использует backend API `/admin/simulate-deal` (mock mode)
 * для верификации полного 21-шагового цикла.
 *
 * UI тесты проверяют критические экраны для ролей Farmer и Buyer.
 */
import { expect, test } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001';

test.describe('E2E Deal Simulation — ТЗ 6.4', () => {
  test('Backend: полный 21-шаговый цикл сделки через simulate-deal API', async ({ request }) => {
    const res = await request.post(`${API_BASE}/admin/simulate-deal`, {
      headers: { Authorization: 'Bearer admin-token-for-test' },
    });

    // В mock режиме endpoint работает без реального auth (тест пишет warning если 401)
    if (res.status() === 401) {
      test.skip(true, 'Admin token not available in this environment — skipping API simulation');
      return;
    }

    expect(res.status()).toBe(201);
    const body = await res.json();

    expect(body).toMatchObject({
      totalSteps: 21,
      passed: 21,
    });
    expect(body.steps).toHaveLength(21);
    expect(body.steps.every((s: { status: string }) => s.status === 'ok')).toBe(true);
    expect(body.summary).toMatch(/passed/i);
  });

  test('UI: Farmer — раздел сделок доступен и рендерится', async ({ page }) => {
    await page.goto('/platform-v7/farmer');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('UI: Buyer — поиск заявок доступен', async ({ page }) => {
    await page.goto('/platform-v7/buyer');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('UI: Deal detail — карточка сделки рендерится без ошибок', async ({ page }) => {
    await page.goto('/platform-v7/deals/DL-9102/clean');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404|Unhandled Runtime Error/i);
    await expect(page.getByText('DL-9102', { exact: false })).toBeVisible();
  });

  test('UI: Deal audit trail — hash chain отображается', async ({ page }) => {
    await page.goto('/platform-v7/deals/DL-9106/audit');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
    await expect(page.getByText('DL-9106', { exact: false })).toBeVisible();
  });

  test('UI: Deal money — финансовый раздел доступен', async ({ page }) => {
    await page.goto('/platform-v7/deals/DL-9106/money');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
  });

  test('UI: Lab — лабораторный модуль доступен', async ({ page }) => {
    await page.goto('/platform-v7/lab');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
  });

  test('UI: Logistician — логистика доступна', async ({ page }) => {
    await page.goto('/platform-v7/logistician');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
  });

  test('UI: Elevator — приёмка доступна', async ({ page }) => {
    await page.goto('/platform-v7/elevator');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
  });

  test('UI: Compliance — KYC очередь доступна', async ({ page }) => {
    await page.goto('/platform-v7/compliance');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
  });

  test('UI: Arbitrator — споры доступны', async ({ page }) => {
    await page.goto('/platform-v7/arbitrator');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
  });

  test('UI: Executive analytics — аналитика доступна', async ({ page }) => {
    await page.goto('/platform-v7/executive');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
  });

  test('UI: Admin panel — администрирование доступно', async ({ page }) => {
    await page.goto('/platform-v7/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/Application error|500|404/i);
  });
});
