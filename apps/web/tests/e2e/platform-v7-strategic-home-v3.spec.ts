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

async function settleContactDock(page: Page) {
  const dock = page.locator('.pc-public-contact-dock');
  if (await dock.count() === 0) return;
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(dock).toHaveAttribute('data-scroll-hidden', 'false');
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
}

async function scrollAndSettle(page: Page, top: number) {
  await page.evaluate(async (scrollTop) => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
    window.scrollTo({ top: scrollTop, behavior: 'instant' });
    window.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  }, top);
}

async function materializeDeferredSections(page: Page) {
  for (const selector of [
    '.pc-v6-category',
    '.pc-v6-crops',
    '.pc-v6-integrations',
    '.pc-v6-assurance',
    '.pc-v6-faq',
    '.pc-v6-final',
  ]) {
    const section = page.locator(selector);
    if (await section.count() === 0) continue;
    await section.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    }));
  }
  await settleContactDock(page);
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
  test('RU EN ZH render the Deal-first homepage without runtime or horizontal-overflow failures', async ({ page }) => {
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
      await expect(page.locator('#deal-path')).toBeVisible();
      await expect(page.locator('#participants')).toBeVisible();
      await expect(page.locator('#money')).toBeVisible();
      await expect(page.locator('#tai')).toBeVisible();
      await expect(page.locator('#connect-organization')).toBeVisible();
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-step', '1');
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
    const tabs = page.getByRole('tablist', { name: 'Что видит каждый участник' });
    await expect(tabs).toBeVisible();
    const bank = page.getByRole('tab', { name: 'Банк' });
    await bank.click();
    await expect(bank).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('выплата остановлена правилами Сделки');
    await expect(page.getByText('Интерактивный сценарий показывает ролевой контекст. Переключение не открывает данные и не меняет права.')).toBeVisible();
    expect(forbiddenRequests).toEqual([]);
  });

  test('organization intake validates step one locally without sending personal data', async ({ page }) => {
    const submittedRequests: string[] = [];
    let captureSubmission = false;
    page.on('request', (request) => {
      if (captureSubmission && request.method() !== 'GET') submittedRequests.push(`${request.method()} ${request.url()}`);
    });

    await page.goto('/platform-v7?lang=ru#connect-organization', { waitUntil: 'load' });
    const form = page.locator('#connect-organization form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('data-ready', 'true');
    captureSubmission = true;
    await form.getByRole('button', { name: 'Продолжить' }).click();
    await expect(form).toHaveAttribute('data-step', '1');
    await expect(form.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/#connect-organization$/);
    expect(submittedRequests).toEqual([]);
    await expectNoSeriousAxeViolations(page);
  });

  test('organization intake reaches durable acceptance through the existing endpoint', async ({ page }) => {
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
    await form.getByLabel('Интересующий сценарий').selectOption('DEAL_EXECUTION');
    await form.getByLabel(/Я согласен/).check();
    await form.getByRole('button', { name: 'Зарегистрировать заявку' }).click();

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

  test('contact dock stops obscuring content during downward scrolling and returns on upward scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    const dock = page.locator('.pc-public-contact-dock');
    await settleContactDock(page);
    await expect(dock.locator('button').first()).toBeEnabled();
    await scrollAndSettle(page, 1300);
    await expect(dock).toHaveAttribute('data-scroll-hidden', 'true');
    await scrollAndSettle(page, 900);
    await expect(dock).toHaveAttribute('data-scroll-hidden', 'false');
  });

  for (const width of [320, 375, 390, 430]) {
    test(`${width}px mobile reflow keeps all progressive-form controls within the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      const form = page.locator('#connect-organization form');
      await expect(form).toHaveAttribute('data-ready', 'true');
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

  test('captures responsive and multilingual visual evidence', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Visual evidence is captured once in Chromium.');

    for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');
      await materializeDeferredSections(page);
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
      await materializeDeferredSections(page);
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
    await expect(page.locator('input:visible, select:visible, textarea:visible')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'RU · Защищённая регистрация' })).toHaveAttribute('href', '/platform-v7/register?entry=organization-connect&lang=ru');
    await expect(page.getByRole('link', { name: 'EN · Protected registration' })).toHaveAttribute('href', '/platform-v7/register?entry=organization-connect&lang=en');
    await expect(page.getByRole('link', { name: '中文 · 受保护的注册' })).toHaveAttribute('href', '/platform-v7/register?entry=organization-connect&lang=zh');
    await expect(page.getByRole('link', { name: 'Позвонить · Call · 致电' })).toHaveAttribute('href', 'tel:+79162778989');
    await expectMinimumTargets(page, '.pc-root-loading-noscript a');
    await expectNoHorizontalOverflow(page);
  });
});
