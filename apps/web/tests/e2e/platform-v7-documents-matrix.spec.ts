import { expect, test } from '@playwright/test';

test.describe('platform-v7 DocumentsMatrix', () => {
  test('renders on bank page and keeps mobile layout stable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/bank', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-documents-matrix')).toBeVisible();
    await expect(page.getByText('СДИЗ')).toBeVisible();
    await expect(page.getByText('ЭДО')).toBeVisible();
    await expect(page.getByText('ЭТрН')).toBeVisible();
    await expect(page.getByText('Лабораторный протокол')).toBeVisible();
    await expect(page.getByText('Основание для банка')).toBeVisible();
    await expect(page.getByTestId('platform-v7-document-metadata')).toBeVisible();
    await expect(page.getByText('Метаданные документов')).toBeVisible();
    await expect(page.getByText('Подпись')).toBeVisible();
    await expect(page.getByText('Внешнее подтверждение')).toBeVisible();
    await expect(page.getByText('требует подключения')).toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX, '/platform-v7/bank should not have horizontal overflow at 390px').toBe(false);
  });
});
