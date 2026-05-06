import { expect, test } from '@playwright/test';

const CORE_ROUTES = [
  '/platform-v7',
  '/platform-v7/seller',
  '/platform-v7/seller/lots',
  '/platform-v7/deals',
  '/platform-v7/lots',
  '/platform-v7/control-tower',
] as const;

const OPTIONAL_ROUTES = ['/platform-v7/seller/actions'] as const;

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
  const text = await page.locator('body').innerText();
  for (const copy of FORBIDDEN_COPY) {
    expect(text, `${route} should not expose forbidden copy: ${copy}`).not.toContain(copy);
  }
}

test.describe('platform-v7 final mobile excellence pass', () => {
  test('mobile header at 390px keeps only compact primary controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/control-tower', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.locator('.pc-v4-header[data-mobile-shell="true"]')).toHaveCount(1);
    await expect(page.locator('.pc-v4-brand')).toBeVisible();
    await expect(page.locator('.pc-v4-mobile-role')).toBeVisible();
    await expect(page.locator('.pc-v4-search')).toBeHidden();
    await expect(page.locator('.pc-v4-stage')).toBeHidden();

    const headerBox = await page.locator('.pc-v4-header').boundingBox();
    expect(headerBox?.height ?? 999, 'mobile header should not consume the screen').toBeLessThanOrEqual(78);

    const visibleIconCount = await page.locator('.pc-v4-actions .pc-v4-iconbtn:visible').count();
    expect(visibleIconCount, 'mobile header should keep only notification/help-grade icon controls').toBeLessThanOrEqual(2);
    await assertNoHorizontalOverflow(page, '/platform-v7/control-tower');
  });

  test('burger labels and descriptions stay on separate readable lines at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/seller', { waitUntil: 'networkidle' });
    await page.locator('.pc-v4-iconbtn').first().click();

    const drawer = page.locator('.pc-v4-drawer[data-open="true"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.pc-v4-nav-label').first()).toBeVisible();
    await expect(drawer.locator('.pc-v4-nav-note').first()).toBeVisible();

    const drawerText = await drawer.innerText();
    for (const glued of ['Кабинетмои', 'Лоты и запросырынок', 'Создать лотпартия', 'Сделкиисполнение']) {
      expect(drawerText, `drawer should not glue menu text: ${glued}`).not.toContain(glued);
    }

    const supportInBurger = drawer.locator('[data-mobile-support-link="true"]');
    await expect(supportInBurger).toContainText('Поддержка');
    await expect(supportInBurger).toContainText('обращение по сделке или блокеру');
    await assertNoHorizontalOverflow(page, '/platform-v7/seller');
  });

  for (const route of CORE_ROUTES) {
    test(`${route} has clean copy, no overflow and safe bottom at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();

      await expect(page.locator('body')).toContainText('Прозрачная Цена');
      await assertForbiddenCopy(page, route);
      await assertNoHorizontalOverflow(page, route);

      const bottomPadding = await page.locator('.pc-v4-main').evaluate((el) => Number.parseFloat(window.getComputedStyle(el).paddingBottom));
      expect(bottomPadding, `${route} should reserve Safari safe-area bottom`).toBeGreaterThanOrEqual(96);

      const topSupportButtons = await page.locator('.pc-v4-main :is(a, button):visible').evaluateAll((nodes) =>
        nodes
          .slice(0, 12)
          .filter((node) => /Поддержка|Создать обращение/i.test((node.textContent ?? '').replace(/\s+/g, ' '))).length
      );
      expect(topSupportButtons, `${route} should not show global support CTAs at page top`).toBe(0);
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

  test('dark mode surfaces keep readable contrast smoke', async ({ page }) => {
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

  for (const route of OPTIONAL_ROUTES) {
    test(`${route} does not break mobile shell if route is enabled`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      test.skip(response?.status() === 404, `${route} is not enabled in this branch yet`);
      expect(response?.status(), `${route} should not fail server-side`).toBeLessThan(500);
      await assertNoHorizontalOverflow(page, route);
    });
  }
});
