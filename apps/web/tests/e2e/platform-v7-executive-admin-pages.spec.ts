import { expect, test } from '@playwright/test';

test.describe('executive and admin pages render correctly', () => {
  test('executive page loads with KPI content', async ({ page }) => {
    const response = await page.goto('/platform-v7/executive', { waitUntil: 'networkidle' });
    expect(response?.ok(), 'executive page should return 200').toBeTruthy();

    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(80);

    await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
    expect(body).toMatch(/исполнительн|KPI|сделк|объём|рейс|read-only|только просмотр/i);
  });

  test('executive page has no horizontal overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/executive', { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, 'executive page should not overflow at 390px').toBe(false);
  });

  test('admin page loads with system health panel', async ({ page }) => {
    const response = await page.goto('/platform-v7/admin', { waitUntil: 'networkidle' });
    expect(response?.ok(), 'admin page should return 200').toBeTruthy();

    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(80);

    await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
    expect(body).toMatch(/администр|Admin|Deals|Shipments|Disputes|Outbox|system/i);
  });

  test('admin page has quick links to other pages', async ({ page }) => {
    await page.goto('/platform-v7/admin', { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Audit Log|Disputes|Evidence/i);
  });

  test('executive page does not show forbidden claims', async ({ page }) => {
    await page.goto('/platform-v7/executive', { waitUntil: 'networkidle' });
    const body = (await page.locator('body').innerText()).toLowerCase();
    const forbidden = ['платформа гарантирует', 'fully live', 'fully integrated', 'нет аналогов'];
    for (const f of forbidden) {
      expect(body, `executive page must not contain "${f}"`).not.toContain(f);
    }
  });
});

test.describe('new pages included in live smoke routes', () => {
  const newRoutes = [
    { route: '/platform-v7/executive', pattern: /исполнительн|сделк|read-only|KPI|объём/i },
    { route: '/platform-v7/admin', pattern: /администр|Deals|Shipments|system|status/i },
  ];

  for (const { route, pattern } of newRoutes) {
    test(`${route} renders recognizable content`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      const body = await page.locator('body').innerText();
      expect(body).toMatch(pattern);
      await expect(page.locator('body')).not.toContainText(/404|Application error/i);
    });
  }
});
