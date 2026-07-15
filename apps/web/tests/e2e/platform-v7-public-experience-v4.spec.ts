import { expect, test } from '@playwright/test';

for (const width of [320, 390]) {
  test(`public product experience reflows at ${width}px`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width, height: 860 });
    await page.goto('/platform-v7?lang=ru');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Сделка под контролем');
    await expect(page.locator('.pc-ppe-hero-progress-mobile')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header')?.getBoundingClientRect();
      const heading = document.querySelector('h1')?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerBottom: header?.bottom ?? 0,
        headingTop: heading?.top ?? 0,
      };
    });

    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.headingTop).toBeGreaterThanOrEqual(metrics.headerBottom - 1);
    expect(runtimeErrors).toEqual([]);
  });
}

test('deal explorer exposes all ten stages as a vertical mobile stepper', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 860 });
  await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal&stage=acceptance');

  const stageTrack = page.locator('.pc-ppe-stage-track');
  await expect(stageTrack).toBeVisible();
  await expect(stageTrack.getByRole('button')).toHaveCount(10);

  const style = await stageTrack.evaluate((node) => {
    const computed = window.getComputedStyle(node);
    return {
      columns: computed.gridTemplateColumns,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(style.columns.split(' ').length).toBe(1);
  expect(style.overflow).toBeLessThanOrEqual(1);
});

test('role entry shows five primary roles and reveals remaining roles on demand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7/how-it-works?lang=ru&entry=role');

  const primaryGroup = page.locator('.pc-ppe-entry-gate > .pc-ppe-entry-options');
  await expect(primaryGroup.getByRole('button')).toHaveCount(5);

  const more = page.locator('.pc-ppe-entry-more');
  await expect(more).toBeVisible();
  await more.locator('summary').click();
  await expect(more.locator('.pc-ppe-entry-options').getByRole('button')).toHaveCount(1);
});
