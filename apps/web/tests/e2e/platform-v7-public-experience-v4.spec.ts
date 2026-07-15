import { expect, test } from '@playwright/test';

// Exact-head public acceptance covers every supported mobile width and only visible controls.
for (const width of [320, 360, 375, 390, 430]) {
  test(`public product experience reflows at ${width}px`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width, height: 860 });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Сделка под контролем');
    await expect(page.getByRole('link', { name: 'Посмотреть сделку' })).toBeVisible();
    await expect(page.locator('.pc-ppe-hero-progress-mobile')).toBeVisible();
    await expect(page.locator('.pc-ppe-hero-contour-desktop')).toBeHidden();
    await expect(page.locator('.pc-site-brand-mark')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header')?.getBoundingClientRect();
      const heading = document.querySelector('h1')?.getBoundingClientRect();
      const mark = document.querySelector('.pc-site-brand-mark');
      const raster = mark?.querySelector('img');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerBottom: header?.bottom ?? 0,
        headingTop: heading?.top ?? 0,
        markBackground: mark ? window.getComputedStyle(mark).backgroundColor : '',
        rasterOpacity: raster ? window.getComputedStyle(raster).opacity : '0',
      };
    });

    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.headingTop).toBeGreaterThanOrEqual(metrics.headerBottom - 1);
    expect(metrics.markBackground).toBe('rgb(11, 93, 56)');
    expect(metrics.rasterOpacity).toBe('0');
    expect(runtimeErrors).toEqual([]);
  });
}

test('homepage shows five primary roles and progressively reveals the remaining roles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const roleSection = page.locator('.pc-ppe-section').filter({ has: page.getByRole('heading', { name: 'Как сделку видит каждый участник' }) });
  await expect(roleSection.locator(':scope > .pc-ppe-perspective-grid > .pc-ppe-perspective-card')).toHaveCount(5);

  const more = roleSection.locator('.pc-ppe-all-participants');
  await expect(more).toBeVisible();
  await more.locator('summary').click();
  await expect(more.locator('.pc-ppe-perspective-card')).toHaveCount(7);
});

test('canonical CTA vocabulary does not compete on the homepage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  await expect(page.getByRole('link', { name: 'Посмотреть сделку' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Показать весь путь сделки' })).toHaveCount(2);
  await expect(page.getByText(/сделку изнутри|полный контур/i)).toHaveCount(0);
});

test('deal explorer exposes four business areas and all ten stages on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 860 });
  await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal&stage=acceptance&lens=participants', { waitUntil: 'load' });

  const areas = page.locator('.pc-ppe-lens-list > button:visible');
  await expect(areas).toHaveCount(4);
  await expect(areas).toHaveText(['Исполнение', 'Документы', 'Деньги', 'Риски и спор']);

  const stageTrack = page.locator('.pc-ppe-stage-track');
  await expect(stageTrack).toBeVisible();
  await expect(stageTrack.getByRole('button')).toHaveCount(10);

  const style = await stageTrack.evaluate((node) => {
    const computed = window.getComputedStyle(node);
    const bounds = Array.from(node.querySelectorAll('button')).map((button) => button.getBoundingClientRect());
    return {
      columns: computed.gridTemplateColumns,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      withinViewport: bounds.every((rect) => rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1),
    };
  });

  expect(style.columns.split(' ').length).toBe(1);
  expect(style.overflow).toBeLessThanOrEqual(1);
  expect(style.withinViewport).toBe(true);
});

test('public pages retain information at a 200 percent text scale', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Посмотреть сделку' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('reduced motion prevents automatic stage advancement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal&stage=acceptance', { waitUntil: 'load' });

  const activeStage = page.locator('.pc-ppe-stage-track button[data-state="active"]');
  const before = await activeStage.textContent();
  await page.getByRole('button', { name: 'Запустить показ сделки' }).click();
  await page.waitForTimeout(3100);
  await expect(activeStage).toHaveText(before ?? '');
});

test('public support control does not cover final homepage actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
  await expect(page.locator('.p7-support-chat-button')).toBeVisible();
  await page.locator('.pc-ppe-final-cta').scrollIntoViewIfNeeded();
  await page.waitForTimeout(220);

  const intersections = await page.evaluate(() => {
    const support = document.querySelector('.p7-support-chat-button')?.getBoundingClientRect();
    const actions = Array.from(document.querySelectorAll('.pc-ppe-final-cta a')).map((node) => node.getBoundingClientRect());
    if (!support) return [];
    return actions.map((action) => !(support.right <= action.left || support.left >= action.right || support.bottom <= action.top || support.top >= action.bottom));
  });

  expect(intersections).not.toContain(true);
});
