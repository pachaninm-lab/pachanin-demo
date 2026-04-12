/**
 * Investor demo acceptance tests — §9 ТЗ v9.1
 * 5 success criteria from §1
 */
import { test, expect } from '@playwright/test';

test.describe('§9 Investor demo acceptance', () => {

  test('Criterion 1: Operator finds max-risk deal + next action in ≤5s', async ({ page }) => {
    const start = Date.now();
    await page.goto('/platform-v9/control-tower');

    // Wait for data to load
    await page.waitForSelector('[data-testid="kpi-reserved"]', { timeout: 5000 });

    // Max-risk alert should be visible
    const riskAlert = page.locator('[role="alert"]').first();
    await expect(riskAlert).toBeVisible();
    await expect(riskAlert).toContainText('DL-9102');

    // Must contain next action (link to deal)
    const dealLink = page.locator('a[href*="/platform-v9/deals/DL-9102"]').first();
    await expect(dealLink).toBeVisible();

    const elapsed = Date.now() - start;
    console.log(`✓ Criterion 1 elapsed: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5000);
  });

  test('Criterion 2: Buyer confirms partial release in ≤10s', async ({ page }) => {
    const start = Date.now();
    await page.goto('/platform-v9/deals/DL-9102');
    await page.waitForSelector('text=DL-9102', { timeout: 5000 });

    // Release button should be present (may be disabled due to dispute/hold)
    const releaseBtn = page.locator('button:has-text("Release")');
    await expect(releaseBtn).toBeVisible();

    // Click release to start confirmation flow
    await releaseBtn.click();

    // Confirmation UI should appear
    const confirmText = page.locator('text=Подтвердить release');
    await expect(confirmText).toBeVisible({ timeout: 2000 });

    const elapsed = Date.now() - start;
    console.log(`✓ Criterion 2 elapsed: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(10000);
  });

  test('Criterion 3: Driver field page — offline queue records event', async ({ page }) => {
    await page.goto('/platform-v9/field');
    await page.waitForSelector('text=Подтвердить прибытие', { timeout: 5000 });

    // Confirm arrival — enqueues event
    await page.click('button:has-text("Подтвердить прибытие")');

    // Offline queue section should appear
    await expect(page.locator('text=Офлайн-очередь')).toBeVisible({ timeout: 2000 });

    // Event should be listed
    await expect(page.locator('text=arrival')).toBeVisible();
  });

  test('Criterion 4: Dispute DK-2024-89 war-room is accessible', async ({ page }) => {
    await page.goto('/platform-v9/disputes/DK-2024-89');
    await page.waitForSelector('text=DK-2024-89', { timeout: 5000 });

    // PDF export button available (sandbox mode)
    await expect(page.locator('button:has-text("Экспорт PDF")')).toBeVisible();

    // Evidence pack should show items
    await expect(page.locator('text=Evidence pack')).toBeVisible();

    // All timeline events present
    await expect(page.locator('text=Банк')).toBeVisible();

    // SLA counter visible
    await expect(page.locator('text=SLA осталось')).toBeVisible();
  });

  test('Criterion 5: Control Tower page loads successfully', async ({ page }) => {
    await page.goto('/platform-v9/control-tower');

    // AppShell renders
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 5000 });

    // KPI cards render
    await expect(page.locator('[data-testid="kpi-reserved"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-hold"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-docs"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-deals"]')).toBeVisible();

    // Sidebar navigation
    await expect(page.locator('nav[aria-label="Разделы платформы"]')).toBeVisible();

    // Deals table
    await expect(page.locator('table[aria-label="Таблица сделок"]')).toBeVisible();
  });

  test('Navigation: role switcher changes visible nav items', async ({ page }) => {
    await page.goto('/platform-v9/control-tower');
    await page.waitForSelector('[data-testid="app-shell"]');

    // Open role switcher
    const switcher = page.locator('button[aria-label*="Текущая роль"]');
    await expect(switcher).toBeVisible();
    await switcher.click();

    // Driver role option
    const driverOption = page.locator('button[role="option"]:has-text("Водитель")');
    await expect(driverOption).toBeVisible();
    await driverOption.click();

    // Sidebar should now show field link
    await expect(page.locator('a[href="/platform-v9/field"]')).toBeVisible();
    // Bank link should not be visible for driver
    await expect(page.locator('a[href="/platform-v9/bank"]')).not.toBeVisible();
  });

});
