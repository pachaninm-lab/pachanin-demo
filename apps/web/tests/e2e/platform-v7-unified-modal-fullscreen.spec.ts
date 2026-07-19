import { expect, test } from '@playwright/test';

test.describe('unified public modal sheet fullscreen control', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 860 });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
  });

  test('every public home alias renders the unified dock instead of standalone support', async ({ page }) => {
    for (const entry of ['/?lang=ru', '/pc-public-entry/platform-v7?lang=ru']) {
      await page.goto(entry, { waitUntil: 'load' });
      const dock = page.getByRole('navigation', { name: 'Связь и помощь' });
      await expect(dock).toBeVisible();
      await expect(page.locator('.p7-support-chat-button')).toBeHidden();
    }
  });

  test('rewritten public home keeps the unified AI, support and call dock visible', async ({ page }) => {
    const dock = page.getByRole('navigation', { name: 'Связь и помощь' });

    await expect(dock).toBeVisible();
    await expect(dock.getByRole('button', { name: 'Открыть ИИ-помощника по платформе' })).toBeVisible();
    await expect(dock.getByRole('button', { name: 'Открыть поддержку' })).toBeVisible();
    await expect(dock.getByRole('link', { name: 'Позвонить по номеру 8 916 277-89-89' }))
      .toHaveAttribute('href', 'tel:+79162778989');

    await expect(page.locator('.pc-public-assistant-shortcut')).toBeHidden();
    await expect(page.locator('.p7-support-chat-button')).toBeHidden();
  });

  test('platform assistant opens as a compact intent-first sheet and preserves fullscreen', async ({ page }) => {
    const dock = page.getByRole('navigation', { name: 'Связь и помощь' });
    await dock.getByRole('button', { name: 'Открыть ИИ-помощника по платформе' }).click();

    const dialog = page.getByRole('dialog', { name: 'Помощник по платформе' });
    const expand = dialog.getByRole('button', { name: 'На весь экран' });
    await expect(dialog).toBeVisible();
    await expect(expand).toBeVisible();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'false');
    await expect(dock).toBeHidden();

    const starters = dialog.locator('.pc-public-assistant-starters button');
    await expect(starters.first()).toBeVisible();
    expect(await starters.count()).toBeGreaterThanOrEqual(3);

    const subtitle = dialog.locator('.pc-public-assistant-identity span:not(.pc-public-assistant-mark)');
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toHaveCSS('white-space', 'normal');

    const compact = await dialog.boundingBox();
    expect(compact).not.toBeNull();
    expect(compact!.height).toBeGreaterThanOrEqual(300);
    expect(compact!.height).toBeLessThanOrEqual(570);

    const composer = dialog.locator('.pc-public-assistant-form');
    const input = composer.locator('textarea');
    const send = composer.locator('.pc-public-assistant-primary');
    await expect(input).toBeVisible();
    await expect(send).toBeDisabled();
    await expect(send).toHaveCSS('cursor', 'not-allowed');

    await expand.click();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'true');
    await expect(dialog.getByRole('button', { name: 'Свернуть окно' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Закрыть помощника по платформе' })).toBeVisible();

    const expanded = await dialog.boundingBox();
    expect(expanded).not.toBeNull();
    expect(expanded!.y).toBeGreaterThanOrEqual(-1);
    expect(expanded!.y + expanded!.height).toBeLessThanOrEqual(861);
    expect(expanded!.height).toBeGreaterThan(compact!.height + 120);
    expect(expanded!.width).toBeGreaterThanOrEqual(389);

    await dialog.getByRole('button', { name: 'Свернуть окно' }).click();
    await expect(dialog).toHaveAttribute('data-pc-fullscreen', 'false');
  });

  test('support is compact, has one focus ring and uses the same fullscreen control', async ({ page }) => {
    const dock = page.getByRole('navigation', { name: 'Связь и помощь' });
    await dock.getByRole('button', { name: 'Открыть поддержку' }).click();

    const dialog = page.getByRole('dialog', { name: 'Поддержка' });
    await expect(dialog).toBeVisible();
    await expect(dock).toBeHidden();
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
