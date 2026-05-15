import { expect, test } from '@playwright/test';

const CORE_ROUTES = [
  '/platform-v7',
  '/platform-v7/seller',
  '/platform-v7/seller/lots',
  '/platform-v7/deals',
  '/platform-v7/lots',
  '/platform-v7/control-tower',
] as const;

const EXECUTION_MOBILE_ROUTES = [
  '/platform-v7',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/bank/release-safety',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/operator',
  '/platform-v7/investor',
  '/platform-v7/support',
  '/platform-v7/support/new',
  '/platform-v7/support/operator',
  '/platform-v7/deals/grain-release',
] as const;

const REQUIRED_MOBILE_VIEWPORTS = [
  { label: '390x844', width: 390, height: 844 },
  { label: '430x932', width: 430, height: 932 },
  { label: '375x812', width: 375, height: 812 },
  { label: '360x800', width: 360, height: 800 },
  { label: '812x375-landscape', width: 812, height: 375 },
  { label: '1280x720-low-height', width: 1280, height: 720 },
] as const;

const REQUIRED_VIEWPORT_ROUTES = [
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/bank',
  '/platform-v7/executive',
] as const;

const HEADER_ROLE_BOUNDARY_ROUTES = [
  {
    route: '/platform-v7/seller',
    expectedLabels: ['Продавец', 'Покупатель', 'Логистика'],
    forbiddenLabels: ['Банк', 'Арбитр', 'Комплаенс', 'Водитель', 'Сюрвейер', 'Элеватор', 'Лаборатория', 'Оператор', 'Руководитель'],
  },
  {
    route: '/platform-v7/buyer',
    expectedLabels: ['Продавец', 'Покупатель', 'Логистика'],
    forbiddenLabels: ['Банк', 'Арбитр', 'Комплаенс', 'Водитель', 'Сюрвейер', 'Элеватор', 'Лаборатория', 'Оператор', 'Руководитель'],
  },
  {
    route: '/platform-v7/logistics',
    expectedLabels: ['Продавец', 'Покупатель', 'Логистика'],
    forbiddenLabels: ['Банк', 'Арбитр', 'Комплаенс', 'Водитель', 'Сюрвейер', 'Элеватор', 'Лаборатория', 'Оператор', 'Руководитель'],
  },
  {
    route: '/platform-v7/bank',
    expectedLabels: ['Банк', 'Арбитр', 'Комплаенс'],
    forbiddenLabels: ['Продавец', 'Покупатель', 'Логистика', 'Водитель', 'Сюрвейер', 'Элеватор', 'Лаборатория', 'Оператор', 'Руководитель'],
  },
] as const;

const WORK_SURFACE_FORBIDDEN_COPY = [
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

const GLOBAL_FORBIDDEN_CLAIMS = [
  'production-ready',
  'fully live',
  'fully integrated',
  'нет аналогов',
  'без рисков',
  'гарантирует оплату',
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
  for (const copy of WORK_SURFACE_FORBIDDEN_COPY) {
    expect(text, `${route} should not expose forbidden copy in work surface: ${copy}`).not.toContain(copy);
  }
}

async function assertGlobalForbiddenClaims(page: import('@playwright/test').Page, route: string) {
  const text = (await page.locator('body').innerText()).toLowerCase();
  for (const copy of GLOBAL_FORBIDDEN_CLAIMS) {
    expect(text, `${route} should not expose over-claiming copy: ${copy}`).not.toContain(copy.toLowerCase());
  }
}

async function assertMobileExecutionRoute(page: import('@playwright/test').Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.ok(), `${route} should return 2xx on mobile`).toBeTruthy();
  await expect(page.locator('body'), `${route} should render body on mobile`).toBeVisible();
  await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i'), `${route} should not render crash or 404 copy`).toHaveCount(0);

  await assertNoHorizontalOverflow(page, route);
  await assertGlobalForbiddenClaims(page, route);

  const headerCount = await page.locator('.pc-v4-header').count();
  expect(headerCount, `${route} should not duplicate the platform header`).toBeLessThanOrEqual(1);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length, `${route} should not render an empty mobile route`).toBeGreaterThan(30);
}

async function assertHeaderDoesNotDominateViewport(page: import('@playwright/test').Page, route: string, viewport: { readonly label: string; readonly height: number }) {
  const headerBox = await page.locator('.pc-v4-header').boundingBox();
  const maxHeaderHeight = Math.min(96, viewport.height * 0.24);
  expect(headerBox?.height ?? 999, `${route} header should stay compact at ${viewport.label}`).toBeLessThanOrEqual(maxHeaderHeight);
}

test.describe('platform-v7 mobile excellence source-level pass', () => {
  test('mobile header stays compact at 390px without runtime markers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7/control-tower', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.locator('.pc-v4-header')).toHaveCount(1);
    await expect(page.locator('.pc-v4-brand')).toBeVisible();
    await expect(page.locator('.pc-v4-select')).toBeVisible();
    await expect(page.locator('.pc-v4-mobile-role')).toBeHidden();
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
    await assertGlobalForbiddenClaims(page, '/platform-v7/control-tower');
  });

  test('field mobile header keeps role label visible and selector hidden', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/driver/field', { waitUntil: 'networkidle' });

    await expect(page.locator('.pc-v4-header')).toHaveCount(1);
    await expect(page.locator('.pc-v4-brand')).toBeVisible();
    await expect(page.locator('[data-role-header-label="true"]')).toContainText('Водитель');
    await expect(page.locator('[data-role-header-switcher="true"]')).toHaveCount(0);
    await expect(page.locator('.pc-v4-drawer')).toBeHidden();
    await expect(page.locator('.pc-v4-top > button.pc-v4-iconbtn').first()).toBeHidden();

    const visibleIconCount = await page.locator('.pc-v4-actions .pc-v4-iconbtn:visible').count();
    expect(visibleIconCount).toBeLessThanOrEqual(3);
    await assertNoHorizontalOverflow(page, '/platform-v7/driver/field');
    await assertGlobalForbiddenClaims(page, '/platform-v7/driver/field');
  });

  test('operator burger labels, descriptions and active state stay readable at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/control-tower', { waitUntil: 'networkidle' });
    await page.locator('.pc-v4-iconbtn').first().click();

    const drawer = page.locator('.pc-v4-drawer[data-open="true"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.pc-v4-nav-label').first()).toBeVisible();
    await expect(drawer.locator('.pc-v4-nav-note').first()).toBeVisible();

    const activeItem = drawer.locator('.pc-v4-nav-item[data-active="true"]').first();
    await expect(activeItem).toBeVisible();
    await expect(activeItem).toContainText('Центр управления');

    const drawerText = await drawer.innerText();
    for (const glued of ['Центр управленияблокеры', 'Сделкиреестр', 'Лоты и запросыпредсделочный', 'Спорыудержания']) {
      expect(drawerText).not.toContain(glued);
    }

    await assertNoHorizontalOverflow(page, '/platform-v7/control-tower');
    await assertGlobalForbiddenClaims(page, '/platform-v7/control-tower');
  });

  test('seller scoped mobile shell keeps burger and drawer hidden', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7/seller', { waitUntil: 'networkidle' });
    await expect(page.locator('.pc-v4-drawer')).toBeHidden();
    await expect(page.locator('.pc-v4-top > button.pc-v4-iconbtn').first()).toBeHidden();
    await assertNoHorizontalOverflow(page, '/platform-v7/seller');
    await assertGlobalForbiddenClaims(page, '/platform-v7/seller');
  });

  for (const config of HEADER_ROLE_BOUNDARY_ROUTES) {
    test(`${config.route} keeps mobile portal role selector scoped`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(config.route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${config.route} should return 2xx`).toBeTruthy();

      const switcher = page.locator('[data-role-header-switcher="true"]');
      await expect(switcher, `${config.route} should expose exactly one portal role selector`).toHaveCount(1);
      await expect(switcher).toBeVisible();
      await expect(page.locator('[data-role-header-label="true"]')).toHaveCount(0);
      await expect(page.locator('.pc-v4-drawer')).toBeHidden();
      await expect(page.locator('.pc-v4-top > button.pc-v4-iconbtn').first()).toBeHidden();

      const labels = (await switcher.locator('option').allTextContents()).map((item) => item.trim());
      expect(labels).toEqual(config.expectedLabels);
      for (const forbiddenLabel of config.forbiddenLabels) {
        expect(labels, `${config.route} should not expose ${forbiddenLabel} in role selector`).not.toContain(forbiddenLabel);
      }

      await assertNoHorizontalOverflow(page, config.route);
      await assertGlobalForbiddenClaims(page, config.route);
    });
  }

  for (const route of CORE_ROUTES) {
    test(`${route} has clean work-surface copy and no mobile overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();
      await expect(page.locator('body')).toContainText('Прозрачная Цена');
      await assertForbiddenCopy(page, route);
      await assertGlobalForbiddenClaims(page, route);
      await assertNoHorizontalOverflow(page, route);
      const bottomPadding = await page.locator('.pc-v4-main').evaluate((el) => Number.parseFloat(window.getComputedStyle(el).paddingBottom));
      expect(bottomPadding).toBeGreaterThanOrEqual(96);
    });
  }

  for (const route of EXECUTION_MOBILE_ROUTES) {
    test(`${route} keeps execution mobile route stable at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await assertMobileExecutionRoute(page, route);
    });
  }

  for (const viewport of REQUIRED_MOBILE_VIEWPORTS) {
    for (const route of REQUIRED_VIEWPORT_ROUTES) {
      test(`${route} has no horizontal overflow and compact header at ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await assertMobileExecutionRoute(page, route);
        await assertHeaderDoesNotDominateViewport(page, route, viewport);
      });
    }
  }

  for (const viewport of REQUIRED_MOBILE_VIEWPORTS) {
    test(`driver primary action stays visible at ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto('/platform-v7/driver/field', { waitUntil: 'networkidle' });
      expect(response?.ok(), `driver field should return 2xx at ${viewport.label}`).toBeTruthy();

      const action = page.getByRole('link', { name: 'Подтвердить прибытие' });
      await expect(action).toBeVisible();
      const actionBox = await action.boundingBox();
      expect(actionBox?.y ?? 9999, `driver action should start inside viewport at ${viewport.label}`).toBeLessThan(viewport.height);
      expect((actionBox?.y ?? 9999) + (actionBox?.height ?? 0), `driver action should be fully visible at ${viewport.label}`).toBeLessThanOrEqual(viewport.height);
      await assertNoHorizontalOverflow(page, '/platform-v7/driver/field');
      await assertGlobalForbiddenClaims(page, '/platform-v7/driver/field');
    });
  }

  for (const route of CORE_ROUTES) {
    test(`${route} keeps desktop width stable at 1440px`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx on desktop`).toBeTruthy();
      await assertForbiddenCopy(page, route);
      await assertGlobalForbiddenClaims(page, route);
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
