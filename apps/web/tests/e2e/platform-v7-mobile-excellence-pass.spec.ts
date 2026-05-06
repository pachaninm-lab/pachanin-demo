import { expect, test } from '@playwright/test';

const CORE_ROUTES = [
  '/platform-v7',
  '/platform-v7/seller',
  '/platform-v7/seller/lots',
  '/platform-v7/deals',
  '/platform-v7/lots',
  '/platform-v7/control-tower',
] as const;

const FORBIDDEN_COPY = [
  'оффер',
  'Оффер',
  'DealDraft',
  'Deal 360',
  'reference',
  'Reference',
  'FGIS-PARTY-',
  'Антиобход',
  'Нужна проверка',
  'нужна проверка',
  'Ручные',
] as const;

async function assertNoHorizontalOverflow(page: import('@playwright/test').Page, route: string) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.document, `${route} should not overflow document horizontally`).toBeLessThanOrEqual(4);
  expect(overflow.body, `${route} should not overflow body horizontally`).toBeLessThanOrEqual(4);
}

async function assertForbiddenCopy(page: import('@playwright/test').Page, route: string) {
  const text = await page.locator('.pc-v4-main').innerText();
  for (const copy of FORBIDDEN_COPY) {
    expect(text, `${route} should not expose forbidden copy in work surface: ${copy}`).not.toContain(copy);
  }
}

test.describe('platform-v7 mobile excellence source-level pass', () => {
  test('mobile header stays compact at 390px without runtime markers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/control-tower', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.locator('.pc-v4-header')).toHaveCount(1);
    await expect(page.locator('.pc-v4-brand')).toBeVisible();
    await expect(page.locator('.pc-v4-mobile-role')).toBeVisible();
    await expect(page.locator('.pc-v4-search')).toBeHidden();
    await expect(page.locator('.pc-v4-stage')).toBeHidden();

    const runtimeFlags = await page.evaluate(() => ({
      mobileRuntime: document.documentElement.dataset.platformV7MobileExcellence,
      shellRuntime: document.querySelector('.pc-v4-header')?.getAttribute('data-mobile-shell'),
    }));
    expect(runtimeFlags.mobileRuntime).toBeUndefined();
    expect(runtimeFlags.shellRuntime).toBeNull();

    const headerBox = await page.locator('.pc-v4-header').boundingBox();
    expect(headerBox?.height ?? 999).toBeLessThanOrEqual(78);

    const visibleIconCount = await page.locator('.pc-v4-actions .pc-v4-iconbtn:visible').count();
    expect(visibleIconCount).toBeLessThanOrEqual(3);
    await assertNoHorizontalOverflow(page, '/platform-v7/control-tower');
  });

  test('burger labels and descriptions stay readable at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/seller', { waitUntil: 'networkidle' });
    await page.locator('.pc-v4-iconbtn').first().click();

    const drawer = page.locator('.pc-v4-drawer[data-open="true"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.pc-v4-nav-label').first()).toBeVisible();
    await expect(drawer.locator('.pc-v4-nav-note').first()).toBeVisible();

    const drawerText = await drawer.innerText();
    for (const glued of ['Кабинетмои', 'Лоты и запросырынок', 'Создать лотпартия', 'Сделкиисполнение']) {
      expect(drawerText).not.toContain(glued);
    }

    await assertNoHorizontalOverflow(page, '/platform-v7/seller');
  });

  for (const route of CORE_ROUTES) {
    test(`${route} has clean work-surface copy and no mobile overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();
      await expect(page.locator('body')).toContainText('Прозрачная Цена');
      await assertForbiddenCopy(page, route);
      await assertNoHorizontalOverflow(page, route);
      const bottomPadding = await page.locator('.pc-v4-main').evaluate((el) => Number.parseFloat(window.getComputedStyle(el).paddingBottom));
      expect(bottomPadding).toBeGreaterThanOrEqual(96);
    });
  }

  for (const route of CORE_ROUTES) {
    test(`${route} keeps desktop width stable at 1440px`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx on desktop`).toBeTruthy();
      await assertForbiddenCopy(page, route);
      await assertNoHorizontalOverflow(page, route);
      await expect(page.locator('.pc-v4-search')).toBeVisible();
      await expect(page.locator('.pc-v4-select')).toBeVisible();
    });
  }

  test('dark mode tokens keep readable contrast smoke', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/control-tower', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.localStorage.setItem('pc-theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    const tokens = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.documentElement);
      return {
        secondary: styles.getPropertyValue('--p7-color-text-secondary').trim(),
        muted: styles.getPropertyValue('--p7-color-text-muted').trim(),
        surface: styles.getPropertyValue('--p7-color-surface').trim(),
        nested: styles.getPropertyValue('--p7-color-surface-muted').trim(),
        successBg: styles.getPropertyValue('--pc-success-bg').trim(),
      };
    });

    expect(tokens.secondary).toBe('#c7d6d1');
    expect(tokens.muted).toBe('#aabbb5');
    expect(tokens.surface).not.toBe(tokens.nested);
    expect(tokens.successBg).toContain('0.09');
  });
});
