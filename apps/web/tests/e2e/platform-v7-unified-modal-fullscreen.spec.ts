import { expect, test } from '@playwright/test';

test.describe('unified public modal sheet fullscreen control', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 860 });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
  });

  test('AI assistant opens as a visible intent-first sheet and preserves fullscreen', async ({ page }) => {
    await page.locator('.pc-public-assistant-shortcut').click();

    const dialog = page.getByRole('dialog', { name: 'ИИ-помощник' });
    const expand = dialog.getByRole('button', { name: 'На весь экран' });
    await expect(dialog).toBeVisible();
    await expect(expand).toBeVisible();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'false');
    await expect(dialog).toHaveAttribute('data-conversation', 'false');

    await expect(dialog.getByText('Что нужно узнать?', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Быстрые сценарии', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Публичный режим · без доступа к данным сделок', { exact: true })).toBeVisible();

    const starters = dialog.locator('.pc-public-assistant-starters button');
    await expect(starters.first()).toBeVisible();
    expect(await starters.count()).toBeGreaterThanOrEqual(4);

    const compact = await dialog.boundingBox();
    expect(compact).not.toBeNull();
    expect(compact!.height).toBeGreaterThanOrEqual(420);
    expect(compact!.height).toBeLessThanOrEqual(700);

    const composer = dialog.locator('.pc-public-assistant-form');
    const input = composer.locator('textarea');
    const send = composer.getByRole('button', { name: 'Спросить' });
    await expect(input).toBeVisible();
    await expect(input).not.toBeFocused();
    await expect(send).toBeDisabled();
    await expect(send).toHaveCSS('cursor', 'not-allowed');
    await expect(composer.locator('.pc-public-assistant-secondary')).toHaveCount(0);

    await expand.click();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'true');
    await expect(dialog.getByRole('button', { name: 'Свернуть окно' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Закрыть ИИ-помощника' })).toBeVisible();

    const expanded = await dialog.boundingBox();
    expect(expanded).not.toBeNull();
    expect(expanded!.y).toBeGreaterThanOrEqual(-1);
    expect(expanded!.y + expanded!.height).toBeLessThanOrEqual(861);
    expect(expanded!.height).toBeGreaterThan(compact!.height + 100);
    expect(expanded!.width).toBeGreaterThanOrEqual(389);

    await dialog.getByRole('button', { name: 'Свернуть окно' }).click();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'false');
  });

  test('support is compact, has one focus ring and uses the same fullscreen control', async ({ page }) => {
    await page.locator('.p7-support-chat-button').click();

    const dialog = page.getByRole('dialog', { name: 'Поддержка' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Поддержка', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Поддержка Прозрачной Цены', { exact: true })).toHaveCount(0);

    const topic = dialog.locator('select');
    const name = dialog.locator('input[autocomplete="name"]');
    const question = dialog.locator('textarea');
    await topic.focus();
    await expect(topic).toHaveCSS('outline-style', 'none');
    await expect(topic).toHaveCSS('border-color', 'rgb(21, 148, 93)');

    const nameBox = await name.boundingBox();
    const questionBox = await question.boundingBox();
    expect(nameBox).not.toBeNull();
    expect(questionBox).not.toBeNull();
    expect(nameBox!.height).toBeGreaterThanOrEqual(44);
    expect(nameBox!.height).toBeLessThanOrEqual(54);
    expect(questionBox!.height).toBeGreaterThanOrEqual(88);
    expect(questionBox!.height).toBeLessThanOrEqual(130);

    await dialog.getByRole('button', { name: 'На весь экран' }).click();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'true');
    await expect(dialog.getByRole('button', { name: 'Закрыть поддержку' })).toBeVisible();

    const expanded = await dialog.boundingBox();
    expect(expanded).not.toBeNull();
    expect(expanded!.y).toBeGreaterThanOrEqual(-1);
    expect(expanded!.y + expanded!.height).toBeLessThanOrEqual(861);
    expect(expanded!.width).toBeGreaterThanOrEqual(389);
  });
});
