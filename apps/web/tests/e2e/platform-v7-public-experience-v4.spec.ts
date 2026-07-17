import { expect, test } from '@playwright/test';

for (const width of [320, 360, 375, 390, 430]) {
  test(`public product experience reflows at ${width}px`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width, height: 860 });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Сделка под контролем');
    await expect(page.getByRole('link', { name: 'Разобрать демонстрационную сделку' })).toBeVisible();
    await expect(page.getByText('Демонстрационная сделка', { exact: true })).toBeVisible();
    await expect(page.locator('.pc-ppe-hero-progress-mobile')).toBeVisible();
    await expect(page.locator('.pc-ppe-hero-progress-mobile')).toContainText('Этап 1 из 10');
    await expect(page.locator('.pc-ppe-hero-progress-mobile')).toContainText('Условия сделки');
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

  const roleSection = page.locator('#participants');
  await expect(roleSection.locator(':scope > .pc-ppe-perspective-grid > .pc-ppe-perspective-card')).toHaveCount(5);

  const more = roleSection.locator('.pc-ppe-all-participants');
  await expect(more).toBeVisible();
  await more.locator('summary').click();
  await expect(more.locator('.pc-ppe-perspective-card')).toHaveCount(7);
});

test('homepage provides service navigation and institutional trust links', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const header = page.locator('.pc-site-header');
  await expect(header.getByRole('link', { name: 'Как работает' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Участники' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Надёжность' })).toBeVisible();
  await expect(page.locator('.pc-ppe-hero-contour-desktop > span')).toHaveCount(10);
  await expect(page.locator('.pc-ppe-hero-contour-desktop > span[data-active="true"]')).toContainText('Условия');
  await expect(page.locator('#reliability .pc-ppe-trust-card')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'Статус сервисов' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Политика данных' })).toBeVisible();
});

test('mobile service menu is usable and remains inside the 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const menu = page.locator('.pc-site-mobile-menu');
  const summary = menu.locator('summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute('aria-label', 'Меню');
  await summary.click();

  const mobileNav = menu.locator('.pc-site-mobile-nav');
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: 'Как работает' })).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: 'Участники' })).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: 'Надёжность' })).toBeVisible();

  const bounds = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const headerChildren = Array.from(document.querySelectorAll('.pc-site-header > *, .pc-site-actions > *'))
      .filter((node) => window.getComputedStyle(node).display !== 'none')
      .map((node) => node.getBoundingClientRect());
    const nav = document.querySelector('.pc-site-mobile-nav')?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - viewport,
      headerInside: headerChildren.every((rect) => rect.left >= -1 && rect.right <= viewport + 1),
      navInside: Boolean(nav && nav.left >= -1 && nav.right <= viewport + 1),
    };
  });

  expect(bounds.overflow).toBeLessThanOrEqual(1);
  expect(bounds.headerInside).toBe(true);
  expect(bounds.navInside).toBe(true);
  await summary.click();
  await expect(mobileNav).toBeHidden();
});

test('canonical CTA vocabulary remains deliberate and truthful', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  await expect(page.getByRole('link', { name: 'Разобрать демонстрационную сделку' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Посмотреть сделку с начала' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Открыть этап приёмки' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Открыть полный разбор сделки' })).toHaveCount(1);
  await expect(page.getByText('Выбранный ключевой этап: Этап 6 из 10')).toBeVisible();
  await expect(page.getByText(/DEAL-2408|реальная сделка №/i)).toHaveCount(0);
  await expect(page.getByText('Данные вымышлены и используются только для объяснения логики платформы.')).toBeVisible();
});

test('primary journey starts at terms while the highlighted acceptance stage stays directly accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  await page.getByRole('link', { name: 'Разобрать демонстрационную сделку' }).click();
  await expect(page).toHaveURL(/stage=terms/);
  await expect(page).toHaveURL(/perspective=buyer/);
  await expect(page.locator('.pc-ppe-stage-track button[data-state="active"]')).toContainText('Условия');

  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
  await page.getByRole('link', { name: 'Открыть этап приёмки' }).click();
  await expect(page).toHaveURL(/stage=acceptance/);
  await expect(page.locator('.pc-ppe-stage-track button[data-state="active"]')).toContainText('Приёмка');
});

test('bare deal explorer and browser history preserve the first-stage buyer fallback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7/how-it-works?lang=ru', { waitUntil: 'load' });

  const activeStage = page.locator('.pc-ppe-stage-track button[data-state="active"]');
  const perspective = page.locator('.pc-ppe-context-panel select');
  await expect(activeStage).toContainText('Условия');
  await expect(perspective).toHaveValue('buyer');

  await page.locator('.pc-ppe-stage-track').getByRole('button', { name: /Приёмка/ }).click();
  await expect(page).toHaveURL(/stage=acceptance/);
  await expect(activeStage).toContainText('Приёмка');

  await page.goBack();
  await expect(page).not.toHaveURL(/stage=/);
  await expect(activeStage).toContainText('Условия');
  await expect(perspective).toHaveValue('buyer');
});

test('deal explorer exposes four business areas and all ten stages on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 860 });
  await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal&stage=acceptance&lens=participants', { waitUntil: 'load' });

  await expect(page.locator('.pc-ppe-demo-banner')).toContainText('демонстрационными');
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
  await expect(page.getByRole('link', { name: 'Разобрать демонстрационную сделку' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('explicit guided tour advances with reduced motion while animation stays suppressed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal&stage=acceptance&lens=participants', { waitUntil: 'load' });

  const activeStage = page.locator('.pc-ppe-stage-track button[data-state="active"]');
  await page.getByRole('button', { name: 'Запустить показ сделки' }).click();

  await expect(page).toHaveURL(/stage=terms/);
  await expect(page).toHaveURL(/lens=execution/);
  await expect(activeStage).toContainText('Условия');
  await expect(page.locator('.pc-ppe-v4-guide-status')).toContainText('1 / 10 · Условия');

  await expect.poll(() => page.url(), { timeout: 6000 }).toContain('stage=admission');
  await expect(activeStage).toContainText('Допуск');
  await expect(page.locator('.pc-ppe-v4-guide-status')).toContainText('2 / 10 · Допуск');

  await page.getByRole('button', { name: 'Пауза' }).click();
  const pausedUrl = page.url();
  await page.waitForTimeout(3500);
  expect(page.url()).toBe(pausedUrl);
});

test('support opens as an accessible modal bottom sheet and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const trigger = page.locator('.p7-support-chat-button');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Поддержка' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await expect(dialog.getByLabel('Тема')).toBeFocused();

  const bounds = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, viewport: window.innerWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.width).toBeGreaterThanOrEqual(318);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('support control does not cover final homepage actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
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
