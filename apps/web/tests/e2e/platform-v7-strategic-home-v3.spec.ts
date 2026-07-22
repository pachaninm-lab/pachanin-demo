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
  const valid = await targets.evaluateAll((nodes) => nodes.every((node) => {
    const box = node.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44;
  }));
  expect(valid, `${selector} must expose 44×44 CSS px targets`).toBe(true);
}

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
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
      await expect(page.locator('#deal-path')).toBeVisible();
      await expect(page.locator('#tai')).toBeVisible();
      await expect(page.locator('#connect-organization')).toBeVisible();
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
      await expectNoHorizontalOverflow(page);
    }

    expect(runtimeFailures).toEqual([]);
  });

  test('participant perspective changes only the public simulation panel', async ({ page }) => {
    const forbiddenRequests: string[] = [];
    page.on('request', (request) => {
      if (/bank-callback|role-assignment|membership|\/auth\/me|\/api\/proxy\//i.test(request.url())) forbiddenRequests.push(request.url());
    });

    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    const tabs = page.getByRole('tablist', { name: 'Посмотреть глазами участника' });
    await expect(tabs).toBeVisible();
    const bank = page.getByRole('tab', { name: 'Банк' });
    await bank.click();
    await expect(bank).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('release запрещён политикой сделки');
    await expect(page.getByText('Публичная симуляция. Роль не предоставляет доступ и не изменяет RBAC.')).toBeVisible();
    expect(forbiddenRequests).toEqual([]);
  });

  test('organization intake validates locally and does not send personal data from the public page', async ({ page }) => {
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
    await form.getByRole('button').click();
    await expect(form.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/#connect-organization$/);
    expect(submittedRequests).toEqual([]);
    await expectNoSeriousAxeViolations(page);
  });

  for (const width of [320, 375, 390, 430]) {
    test(`${width}px mobile reflow keeps touch targets and the form within the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');
      await expectNoHorizontalOverflow(page);
      await expectMinimumTargets(page, '[role="tab"]');
      await expectMinimumTargets(page, '#connect-organization input:not([type="checkbox"])');
      await expectMinimumTargets(page, '#connect-organization select');
      await expectMinimumTargets(page, '#connect-organization button');
      await expectMinimumTargets(page, '#connect-organization a[href^="tel:"]');
    });
  }

  test('captures responsive and multilingual visual evidence', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Visual evidence is captured once in Chromium.');

    for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');
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
