import { expect, test } from '@playwright/test';

test.describe('unified public modal sheet fullscreen control', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 860 });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
  });

  test('platform assistant expands to the visual viewport and restores compact mode', async ({ page }) => {
    await page.locator('.pc-public-assistant-shortcut').click();

    const dialog = page.getByRole('dialog', { name: 'Помощник по платформе' });
    const expand = dialog.getByRole('button', { name: 'На весь экран' });
    await expect(dialog).toBeVisible();
    await expect(expand).toBeVisible();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'false');

    const compact = await dialog.boundingBox();
    expect(compact).not.toBeNull();

    await expand.click();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'true');
    await expect(dialog.getByRole('button', { name: 'Свернуть окно' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Закрыть помощника по платформе' })).toBeVisible();

    const expanded = await dialog.boundingBox();
    expect(expanded).not.toBeNull();
    expect(expanded!.top).toBeGreaterThanOrEqual(-1);
    expect(expanded!.bottom).toBeLessThanOrEqual(861);
    expect(expanded!.height).toBeGreaterThan(compact!.height + 120);
    expect(expanded!.width).toBeGreaterThanOrEqual(389);

    await dialog.getByRole('button', { name: 'Свернуть окно' }).click();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'false');
  });

  test('support uses the same fullscreen control without changing its short title', async ({ page }) => {
    await page.locator('.p7-support-chat-button').click();

    const dialog = page.getByRole('dialog', { name: 'Поддержка' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Поддержка', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Поддержка Прозрачной Цены', { exact: true })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'На весь экран' }).click();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'true');
    await expect(dialog.getByRole('button', { name: 'Закрыть поддержку' })).toBeVisible();

    const expanded = await dialog.boundingBox();
    expect(expanded).not.toBeNull();
    expect(expanded!.top).toBeGreaterThanOrEqual(-1);
    expect(expanded!.bottom).toBeLessThanOrEqual(861);
    expect(expanded!.width).toBeGreaterThanOrEqual(389);
  });
});
