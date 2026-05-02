import { expect, test } from '@playwright/test';

const REQUIRED_STEPS = [
  'Создать лот',
  'Получить ставку',
  'Принять предложение',
  'Создать сделку',
  'Запросить резерв',
  'Подтвердить резерв',
  'Назначить логистику',
  'Закрыть рейс',
  'Подтвердить приёмку',
  'Загрузить лабораторию',
  'Проверить документы',
  'Выпуск или удержание',
  'Открыть спор',
  'Закрыть по доказательствам',
] as const;

test.describe('platform-v7 final demo flow', () => {
  test('/platform-v7/demo shows the full execution chain without live claims', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/demo', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
    await expect(page.getByTestId('platform-v7-demo-flow-hero')).toContainText(/тестовый сценарий/i);
    await expect(page.getByTestId('platform-v7-demo-flow-hero')).not.toContainText(/fully live|production-ready|fully integrated/i);

    const flow = page.getByTestId('platform-v7-demo-flow');
    await expect(flow).toBeVisible();
    await expect(flow).toContainText(/роль|статус|причину остановки|влияние/i);

    for (const step of REQUIRED_STEPS) {
      await expect(flow).toContainText(step);
    }

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX).toBe(false);
  });
});
