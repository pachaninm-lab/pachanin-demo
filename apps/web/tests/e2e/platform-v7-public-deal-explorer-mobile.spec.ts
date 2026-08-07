import { expect, test } from '@playwright/test';

for (const width of [320, 390, 430]) {
  test(`deal explorer keeps the mobile decision path clear at ${width}px`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width, height: 860 });
    await page.goto('/platform-v7/how-it-works?lang=ru', { waitUntil: 'load' });

    const controls = page.locator('.pc-ppe-v4-mobile-controls');
    const role = controls.locator('select');
    const scenarioList = controls.locator('.pc-ppe-v4-mobile-scenario-list');
    const guide = page.locator('.pc-ppe-v4-guide-bar');
    const explorer = page.locator('.pc-ppe-explorer-grid');

    await expect(controls).toBeVisible();
    await expect(role).toBeVisible();
    await expect(scenarioList).toBeVisible();
    await expect(scenarioList.getByRole('button')).toHaveCount(3);
    await expect(page.locator('.pc-ppe-explorer-toolbar')).toBeHidden();
    await expect(page.locator('.pc-ppe-context-panel .pc-ppe-select-label')).toBeHidden();

    const layout = await page.evaluate(() => {
      const controlsRect = document.querySelector('.pc-ppe-v4-mobile-controls')?.getBoundingClientRect();
      const guideRect = document.querySelector('.pc-ppe-v4-guide-bar')?.getBoundingClientRect();
      const explorerRect = document.querySelector('.pc-ppe-explorer-grid')?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        controlsBeforeGuide: Boolean(controlsRect && guideRect && controlsRect.bottom <= guideRect.top + 1),
        guideBeforeExplorer: Boolean(guideRect && explorerRect && guideRect.bottom <= explorerRect.top + 1),
      };
    });

    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.controlsBeforeGuide).toBe(true);
    expect(layout.guideBeforeExplorer).toBe(true);

    const partial = scenarioList.getByRole('button', { name: 'Частичная приёмка' });
    await partial.click();
    await expect(page).toHaveURL(/scenario=partial/);
    await expect(partial).toHaveAttribute('aria-pressed', 'true');

    await role.selectOption('seller');
    await expect(page).toHaveURL(/perspective=seller/);

    await page.getByRole('button', { name: 'Запустить показ сделки' }).click();
    await expect(page).toHaveURL(/stage=terms/);
    await expect(page).toHaveURL(/scenario=partial/);
    await expect(page).toHaveURL(/perspective=seller/);
    await expect(page.locator('.pc-ppe-v4-guide-status')).toContainText('1 / 10');

    expect(runtimeErrors).toEqual([]);
  });
}
