import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectMinimumTargets(page: Page, selector: string) {
  const targets = page.locator(selector);
  await expect(targets.first()).toBeVisible();
  const valid = await targets.evaluateAll((nodes) => nodes.filter((node) => {
    const style = window.getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
  }).every((node) => {
    const box = node.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44;
  }));
  expect(valid, `${selector} must expose 44×44 CSS px visible targets`).toBe(true);
}

async function expectHeaderControlsWithinViewport(page: Page) {
  const viewport = page.viewportSize();
  expect(viewport, 'viewport size').not.toBeNull();
  for (const selector of [
    '.pc-site-mobile-menu > summary',
    '.pc-site-locale-switch',
    '.entry-login',
    '.pc-v6-header-cta',
  ]) {
    const control = page.locator(selector).first();
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box, `${selector} bounding box`).not.toBeNull();
    expect(box!.x, `${selector} left edge`).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, `${selector} right edge`).toBeLessThanOrEqual(viewport!.width + 1);
  }
}

async function expectDealCardHeaderReadable(page: Page) {
  const card = page.locator('[data-testid="platform-v7-deal-card"]');
  const header = card.locator(':scope > div').first();
  const copy = header.locator(':scope > div').first();
  const status = header.locator(':scope > b').first();
  const title = copy.locator('strong').first();
  await expect(header).toBeVisible();
  await expect(copy).toBeVisible();
  await expect(status).toBeVisible();
  await expect(title).toBeVisible();

  const [headerBox, copyBox, statusBox] = await Promise.all([
    header.boundingBox(),
    copy.boundingBox(),
    status.boundingBox(),
  ]);
  expect(headerBox, 'Hero Deal header bounding box').not.toBeNull();
  expect(copyBox, 'Hero Deal copy bounding box').not.toBeNull();
  expect(statusBox, 'Hero Deal status bounding box').not.toBeNull();
  expect(copyBox!.width, 'Hero Deal copy must retain readable width').toBeGreaterThanOrEqual(headerBox!.width * 0.65);
  expect(statusBox!.y, 'Hero Deal status must follow the copy block').toBeGreaterThanOrEqual(copyBox!.y + copyBox!.height - 1);

  const titleLineCount = await title.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    const tops: number[] = [];
    for (const rect of rects) {
      if (!tops.some((top) => Math.abs(top - rect.top) <= 1)) tops.push(rect.top);
    }
    return tops.length;
  });
  expect(titleLineCount, 'Hero Deal title line count').toBeGreaterThanOrEqual(1);
  expect(titleLineCount, 'Hero Deal title must not collapse into a vertical column').toBeLessThanOrEqual(3);
}

async function scrollAndFlush(page: Page, top: number) {
  await page.evaluate(async (targetTop) => {
    window.scrollTo({ top: targetTop, behavior: 'instant' });
    window.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  }, top);
}

async function settleContactDock(page: Page) {
  const dock = page.locator('.pc-public-contact-dock');
  if (await dock.count() === 0) return;

  await expect.poll(async () => {
    await scrollAndFlush(page, 0);
    return dock.getAttribute('data-scroll-hidden');
  }, {
    timeout: 15_000,
    intervals: [100, 250, 500],
    message: 'public contact dock must remain available after route hydration and hash restoration',
  }).toBe('false');
  await expect(dock).toBeVisible();
  await expect(dock.locator('.pc-public-contact-dock-assistant')).toBeEnabled();
}

async function expectNoSeriousAxeViolations(page: Page) {
  await settleContactDock(page);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function fillFirstStep(page: Page) {
  const form = page.locator('#connect-organization form');
  await form.getByLabel('Организация', { exact: true }).fill('ООО Тест Агро');
  await form.getByLabel('ИНН', { exact: true }).fill('7700000000');
  await form.getByLabel('ФИО', { exact: true }).fill('Иван Иванов');
  await form.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(form).toHaveAttribute('data-step', '2');
  return form;
}

test.describe('Platform V7 strategic homepage browser acceptance', () => {
  test('RU EN ZH render the registration-first Deal homepage without runtime or overflow failures', async ({ page }) => {
    const runtimeFailures: string[] = [];
    page.on('pageerror', (error) => runtimeFailures.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
    });

    for (const locale of ['ru', 'en', 'zh'] as const) {
      const response = await page.goto(`/platform-v7?lang=${locale}`, { waitUntil: 'load' });
      expect(response?.ok(), `${locale} homepage response`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
      await expect(page.locator('#pc-v6-title')).toBeVisible();
      await expect(page.locator('.pc-v6-control-tower')).toBeVisible();
      await expect(page.locator('[data-testid="platform-v7-ai-analysis"]')).toBeVisible();
      await expect(page.locator('#deal-path')).toBeVisible();
      await expect(page.locator('#functions article')).toHaveCount(6);
      await expect(page.locator('#trust')).toBeVisible();
      await expect(page.locator('#participants')).toBeVisible();
      await expect(page.locator('#money')).toBeVisible();
      await expect(page.locator('#tai')).toBeVisible();
      await expect(page.locator('#connection-process')).toHaveCount(0);
      await expect(page.locator('#connect-organization')).toBeVisible();
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-step', '1');
      await expect(page.locator('.pc-v6-header-cta')).toBeVisible();
      await expect(page.locator('.pc-v6-header-cta')).toHaveAttribute('href', `/platform-v7/register?lang=${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
      await expectNoHorizontalOverflow(page);
    }

    expect(runtimeFailures).toEqual([]);
  });

  test('participant perspective changes only the public scenario panel', async ({ page }) => {
    const forbiddenRequests: string[] = [];
    page.on('request', (request) => {
      if (/bank-callback|role-assignment|membership|\/auth\/me|\/api\/proxy\//i.test(request.url())) forbiddenRequests.push(request.url());
    });

    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    const tabs = page.getByRole('tablist', { name: 'Выберите роль для просмотра' });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole('tab')).toHaveCount(9);
    const employee = tabs.getByRole('tab', { name: 'Сотрудник платформы', exact: true });
    await employee.click();
    await expect(employee).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('Если Сделка остановилась');
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'public-role-tab-employee');
    expect(forbiddenRequests).toEqual([]);
  });

  test('organization assistance validates step one locally without sending personal data', async ({ page }) => {
    const submittedRequests: string[] = [];
    let captureSubmission = false;
    page.on('request', (request) => {
      if (captureSubmission && request.method() !== 'GET') submittedRequests.push(`${request.method()} ${request.url()}`);
    });

    await page.goto('/platform-v7?lang=ru#connect-organization', { waitUntil: 'load' });
    const form = page.locator('#connect-organization form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#connect-organization')).toContainText('Эта форма не является регистрацией');
    captureSubmission = true;
    await form.getByRole('button', { name: 'Продолжить' }).click();
    await expect(form).toHaveAttribute('data-step', '1');
    await expect(form.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/#connect-organization$/);
    expect(submittedRequests).toEqual([]);
    await expectNoSeriousAxeViolations(page);
  });

  test('organization assistance reaches durable acceptance through the existing endpoint', async ({ page }) => {
    let payload: Record<string, unknown> | null = null;
    let idempotencyKey = '';
    await page.route('**/api/platform-v7/organization-connect', async (route) => {
      const request = route.request();
      payload = request.postDataJSON() as Record<string, unknown>;
      idempotencyKey = request.headers()['idempotency-key'] || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, requestNumber: 'REQ-2026-TEST', status: 'ACCEPTED', replay: false, correlationId: 'corr-test' }),
      });
    });

    await page.goto('/platform-v7?lang=ru#connect-organization', { waitUntil: 'load' });
    const form = await fillFirstStep(page);
    await form.getByLabel('Должность').fill('Директор');
    await form.getByLabel('Телефон').fill('+7 900 000-00-00');
    await form.getByLabel('Email').fill('test@example.com');
    await form.getByLabel('Роль организации').selectOption('BUYER_PROCESSOR');
    await form.getByLabel('С чем нужна помощь').selectOption('DEAL_EXECUTION');
    await form.getByLabel(/Я согласен/).check();
    await form.getByRole('button', { name: 'Отправить запрос на помощь' }).click();

    await expect(page.getByRole('status')).toContainText('REQ-2026-TEST');
    expect(idempotencyKey).toMatch(/^public-org-connect:/);
    expect(payload).toMatchObject({
      organizationName: 'ООО Тест Агро',
      inn: '7700000000',
      contactName: 'Иван Иванов',
      position: 'Директор',
      email: 'test@example.com',
      organizationRole: 'BUYER_PROCESSOR',
      scenario: 'DEAL_EXECUTION',
      locale: 'ru',
      consent: true,
    });
  });

  test('mobile registration and public AI remain visible throughout homepage scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    const headerRegistration = page.locator('.pc-v6-header-cta');
    await expect(headerRegistration).toBeVisible();
    await expect(headerRegistration).toHaveAttribute('href', '/platform-v7/register?lang=ru');
    await expectMinimumTargets(page, '.pc-v6-header-cta');
    await expectHeaderControlsWithinViewport(page);
    await expectDealCardHeaderReadable(page);

    const dock = page.locator('.pc-public-contact-dock');
    const assistant = dock.locator('.pc-public-contact-dock-assistant');
    const secondaryActions = dock.locator('.pc-public-contact-dock-action:not(.pc-public-contact-dock-assistant)');

    await expect(secondaryActions).toHaveCount(2);
    for (const top of [0, 1300, 900, 0]) {
      await scrollAndFlush(page, top);
      await expect(dock).toHaveAttribute('data-scroll-hidden', 'false');
      await expect(dock).toBeVisible();
      await expect(assistant).toBeEnabled();
      await expect(assistant).toHaveAttribute('tabindex', '0');
      for (const action of await secondaryActions.all()) await expect(action).toBeHidden();
    }
  });

  for (const width of [320, 375, 390, 430]) {
    test(`${width}px mobile reflow keeps all progressive-form controls within the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      const form = page.locator('#connect-organization form');
      await expect(form).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('.pc-v6-header-cta')).toBeVisible();
      await expectHeaderControlsWithinViewport(page);
      await expectDealCardHeaderReadable(page);
      await expectNoHorizontalOverflow(page);
      await expectMinimumTargets(page, '[role="tab"]');
      await expectMinimumTargets(page, '#connect-organization input:not([type="checkbox"]):not([tabindex="-1"]):visible');
      await expectMinimumTargets(page, '#connect-organization button:visible');

      await fillFirstStep(page);
      await expectMinimumTargets(page, '#connect-organization input:not([type="checkbox"]):not([tabindex="-1"]):visible');
      await expectMinimumTargets(page, '#connect-organization select:visible');
      await expectMinimumTargets(page, '#connect-organization button:visible');
      await expect(page.locator('#connect-organization input[type="checkbox"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test('768px tablet keeps the Hero Deal header readable', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1000 });
    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expectDealCardHeaderReadable(page);
    await expectNoHorizontalOverflow(page);
  });

  test('1280px header keeps brand, navigation and actions in separate lanes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);

    const brand = page.locator('.pc-site-brand');
    const nav = page.locator('.pc-site-nav');
    const actions = page.locator('.pc-site-actions');
    const navLinks = nav.locator('a');
    const registration = page.locator('.pc-v6-header-cta');
    await expect(brand).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(actions).toBeVisible();
    await expect(registration).toBeVisible();
    expect(await navLinks.count()).toBeGreaterThan(1);

    const [brandBox, firstNavBox, lastNavBox, actionsBox] = await Promise.all([
      brand.boundingBox(),
      navLinks.first().boundingBox(),
      navLinks.last().boundingBox(),
      actions.boundingBox(),
    ]);
    expect(brandBox, 'brand bounding box').not.toBeNull();
    expect(firstNavBox, 'first nav link bounding box').not.toBeNull();
    expect(lastNavBox, 'last nav link bounding box').not.toBeNull();
    expect(actionsBox, 'actions bounding box').not.toBeNull();
    expect(firstNavBox!.x, 'navigation must start after the brand').toBeGreaterThanOrEqual(brandBox!.x + brandBox!.width - 1);
    expect(lastNavBox!.x + lastNavBox!.width, 'navigation must end before header actions').toBeLessThanOrEqual(actionsBox!.x + 1);
    expect(actionsBox!.x + actionsBox!.width, 'header actions must remain inside the viewport').toBeLessThanOrEqual(1281);
    await expectNoHorizontalOverflow(page);
  });

  test('desktop navigation distinguishes in-page Gekta help from the standalone product', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Source-owned navigation labels need one desktop rendering proof.');
    await page.setViewportSize({ width: 1440, height: 900 });
    const expectations = {
      ru: { help: 'Как помогает Гекта', product: 'Гекта' },
      en: { help: 'How Gekta helps', product: 'Gekta' },
      zh: { help: 'Gekta 如何帮助', product: 'Gekta' },
    } as const;

    for (const locale of ['ru', 'en', 'zh'] as const) {
      const response = await page.goto(`/platform-v7?lang=${locale}`, { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      const nav = page.locator('.pc-site-nav');
      await expect(nav).toBeVisible();
      const labels = (await nav.locator('a').allTextContents()).map((label) => label.trim());
      expect(new Set(labels).size, `${locale} desktop nav labels must be distinct`).toBe(labels.length);
      await expect(nav.getByRole('link', { name: expectations[locale].help, exact: true })).toHaveAttribute('href', '#tai');
      const product = nav.getByRole('link', { name: expectations[locale].product, exact: true });
      await expect(product).toHaveAttribute('data-nav-product', 'gekta');
      await expect(product).not.toHaveAttribute('href', '#tai');
    }
  });

  test('captures responsive and multilingual visual evidence', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Visual evidence is captured once in Chromium.');

    for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('.pc-v6-header-cta')).toBeVisible();
      await settleContactDock(page);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`strategic-home-ru-${width}px.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }

    for (const locale of ['en', 'zh'] as const) {
      await page.setViewportSize({ width: 390, height: 900 });
      const response = await page.goto(`/platform-v7?lang=${locale}`, { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('.pc-v6-header-cta')).toBeVisible();
      await settleContactDock(page);
      await page.screenshot({
        path: testInfo.outputPath(`strategic-home-${locale}-390px.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
});

test.describe('Platform V7 strategic homepage no-JavaScript boundary', () => {
  test.use({ javaScriptEnabled: false });

  test('shows no personal-data form and exposes only protected continuation channels', async ({ page }) => {
    const response = await page.goto('/platform-v7?lang=ru#connect-organization', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);

    const fallback = page.locator('.pc-root-loading-noscript');
    await expect(fallback).toBeVisible();
    expect(await fallback.textContent()).toContain('Без JavaScript персональные данные здесь не собираются и не передаются.');
    await expect(page.locator('form:visible')).toHaveCount(0);
    await expect(page.locator('#connect-organization input:visible, #connect-organization select:visible, #connect-organization textarea:visible')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'RU · Защищённая регистрация' })).toHaveAttribute('href', '/platform-v7/register?entry=organization-connect&lang=ru');
    await expect(page.getByRole('link', { name: 'EN · Protected registration' })).toHaveAttribute('href', '/platform-v7/register?entry=organization-connect&lang=en');
    await expect(page.getByRole('link', { name: '中文 · 受保护的注册' })).toHaveAttribute('href', '/platform-v7/register?entry=organization-connect&lang=zh');
    await expect(page.getByRole('link', { name: 'Позвонить · Call · 致电' })).toHaveAttribute('href', 'tel:+79162778989');
    await expectMinimumTargets(page, '.pc-root-loading-noscript a');
    await expectNoHorizontalOverflow(page);
  });
});