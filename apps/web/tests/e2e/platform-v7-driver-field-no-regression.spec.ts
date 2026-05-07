import { expect, test } from '@playwright/test';

const DRIVER_FIELD_ROUTE = '/platform-v7/driver/field';

const FORBIDDEN_DRIVER_FIELD_TEXT = [
  'банк',
  'банков',
  'деньги',
  'резерв',
  'выпуск денег',
  'инвестор',
  'инвесторский',
  'центр управления',
  'control tower',
  'role switcher',
  'commercial margin',
  'внутренняя очередь',
  'операторская очередь',
  'ставки',
  'аукцион',
] as const;

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));

  expect(overflow.document, 'driver field should not overflow document horizontally').toBeLessThanOrEqual(4);
  expect(overflow.body, 'driver field should not overflow body horizontally').toBeLessThanOrEqual(4);
}

test.describe('platform-v7 driver field shell no-regression gate', () => {
  test('keeps the driver route field-only and free from bank, investor and control surfaces', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(DRIVER_FIELD_ROUTE, { waitUntil: 'networkidle' });

    expect(response?.ok(), 'driver field route should return 2xx').toBeTruthy();
    await expect(page.getByTestId('platform-v7-driver-field-shell')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/404|500|Application error|Unhandled Runtime Error/i);

    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of FORBIDDEN_DRIVER_FIELD_TEXT) {
      expect(text, `driver field must not show ${forbidden}`).not.toContain(forbidden.toLowerCase());
    }

    await expect(page.locator('.pc-v4-search')).toBeHidden();
    await expect(page.locator('.pc-v4-select')).toBeHidden();
    await expect(page.locator('table')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  });

  test('keeps large field actions, route context, current trip and incident entry visible at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DRIVER_FIELD_ROUTE, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Рейс водителя' })).toBeVisible();
    await expect(page.getByText(/Рейс TRIP-/)).toBeVisible();
    await expect(page.getByText(/Сделка DL-/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Подтвердить прибытие|Прибытие подтверждено/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сообщить об отклонении' })).toBeVisible();

    const fieldButtons = await page.locator('button:visible').evaluateAll((buttons) =>
      buttons.map((button) => ({
        text: button.textContent?.trim() ?? '',
        height: button.getBoundingClientRect().height,
      })),
    );

    const primaryFieldButtons = fieldButtons.filter((button) => ['Подтвердить прибытие', 'Прибытие подтверждено', 'Сообщить об отклонении'].includes(button.text));
    expect(primaryFieldButtons.length, 'driver field should keep primary field actions visible').toBeGreaterThanOrEqual(2);

    for (const button of primaryFieldButtons) {
      expect(button.height, `${button.text} should remain at least 56px tall on mobile`).toBeGreaterThanOrEqual(56);
    }

    await assertNoHorizontalOverflow(page);
  });

  test('keeps deviation reporting inside the field shell without opening unrelated workspaces', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DRIVER_FIELD_ROUTE, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Сообщить об отклонении' }).click();
    await expect(page.getByPlaceholder('Описание ситуации...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отправить' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отмена' })).toBeVisible();

    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text).not.toContain('операторская очередь');
    expect(text).not.toContain('инвестор');
    expect(text).not.toContain('выпуск денег');
    await assertNoHorizontalOverflow(page);
  });
});
