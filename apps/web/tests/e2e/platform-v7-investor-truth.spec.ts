import { expect, test } from '@playwright/test';

const FORBIDDEN_INVESTOR_CLAIMS = [
  'production-ready',
  'fully live',
  'fully integrated',
  'complete product',
  'всё готово',
  'нет рисков',
  'нет аналогов',
  'платформа гарантирует оплату',
  'платформа сама выпускает деньги',
  'лучшая в мире',
] as const;

test.describe('platform-v7 investor truth pass', () => {
  test('/platform-v7/investor separates pilot, test data, live needs, and risks', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/investor', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
    await expect(page.getByTestId('platform-v7-investor-truth-banner')).toBeVisible();
    await expect(page.getByTestId('platform-v7-investor-truth-grid')).toContainText(/что доказано/i);
    await expect(page.getByTestId('platform-v7-investor-truth-grid')).toContainText(/пилотном контуре/i);
    await expect(page.getByTestId('platform-v7-investor-truth-grid')).toContainText(/тестовым/i);
    await expect(page.getByTestId('platform-v7-investor-truth-grid')).toContainText(/live-подключений/i);
    await expect(page.getByTestId('platform-v7-investor-risks')).toContainText(/ручная нагрузка/i);
    await expect(page.getByTestId('platform-v7-investor-risks')).toContainText(/банк/i);

    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const claim of FORBIDDEN_INVESTOR_CLAIMS) {
      expect(text, `/platform-v7/investor should not expose ${claim}`).not.toContain(claim.toLowerCase());
    }
  });
});
