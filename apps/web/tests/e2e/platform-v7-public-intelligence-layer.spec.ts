import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function collectRuntimeFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/hydration|failed to hydrate|uncaught|react error|error boundary/i.test(text)) failures.push(`console: ${text}`);
  });
  return failures;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function expectMinimumTargets(page: Page, locator: string) {
  const elements = page.locator(locator);
  await expect(elements.first()).toBeVisible();
  const targets = await elements.evaluateAll((nodes) => nodes.map((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.every((target) => target.width >= 44 && target.height >= 44)).toBe(true);
}

test.describe('P0 public TAI intelligence layer browser acceptance', () => {
  test('home intelligence is Deal-aware, interactive and fail-closed', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const forbiddenRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/fgis|esia|gosuslugi|bank-callback|\/api\/proxy\/ai-assistant/i.test(url)) forbiddenRequests.push(url);
    });

    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);

    await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
    await expect(page.locator('.pc-v6-control-tower')).toBeVisible();
    await expect(page.locator('.pc-v6-control-tower')).toContainText('Расчёт заблокирован');
    await expect(page.locator('.pc-v6-control-tower')).toContainText('TAI выявил два блокера');

    const tai = page.locator('#tai');
    await expect(tai).toBeVisible();
    await expect(tai.locator('.pc-v6-tai-answer')).toContainText('Источник: протокол лаборатории № L-204');
    await expect(tai.locator('.pc-v6-tai-answer')).toContainText('Уверенность: высокая');
    await expect(tai.locator('.pc-v6-prepared-action')).toContainText('требуется подтверждение пользователя');
    await expect(tai).toContainText('TAI не меняет роль или организацию');

    const perspectives = page.getByRole('tablist', { name: 'Посмотреть глазами участника' });
    await expect(perspectives).toBeVisible();
    await expect(perspectives.getByRole('tab')).toHaveCount(6);
    await perspectives.getByRole('tab', { name: 'Банк' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('release запрещён политикой сделки');
    await expect(page.getByText('Публичная симуляция. Роль не предоставляет доступ и не изменяет RBAC.')).toBeVisible();

    const integrations = page.locator('#integrations');
    await expect(integrations).toBeVisible();
    await expect(integrations).toContainText('ФГИС «Зерно» / СДИЗ');
    await expect(integrations).toContainText('Не подтверждено');
    await expect(integrations).not.toContainText('Подключено');

    await expect(page.locator('.pc-public-contact-dock-action')).toHaveCount(3);
    await expectMinimumTargets(page, '.pc-public-contact-dock-action');
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(forbiddenRequests).toEqual([]);
    expect(runtimeFailures).toEqual([]);
  });

  test('TAI passport exposes all controlled layers without overstating maturity', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const response = await page.goto('/platform-v7/ai-in-action?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-testid="platform-v7-ai-in-action-authority"]')).toBeVisible();
    await expect(page.getByText('NOT_ATTESTED', { exact: true })).toBeVisible();

    for (const selector of [
      '#role-analysis',
      '#documents',
      '#government-data',
      '#risks-money',
      '#prepared-actions',
      '#evidence',
      '#security',
      '#limitations',
      '#connection',
    ]) {
      await expect(page.locator(selector)).toBeVisible();
    }

    const roleAnalysis = page.locator('#role-analysis');
    await roleAnalysis.getByRole('tab', { name: 'Продавец' }).click();
    await expect(roleAnalysis.locator('[role="tabpanel"]')).toContainText('Версия протокола не связана');

    const government = page.locator('#government-data');
    await expect(government.locator('[data-status="CONNECTED"]')).toHaveCount(0);
    await expect(government.locator('.pc-public-government-result')).toContainText('Проверка не выполнялась');
    await expect(page.locator('#limitations')).toContainText('Неподключённая государственная система не отображается как подключённая');
    await expect(page.locator('.pc-public-contact-dock-action')).toHaveCount(3);

    const media = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    expect(media).toBe(true);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('specified 320–1440 widths keep both public routes inside the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Full width matrix runs once on Chromium; engine coverage is provided by the other projects.');

    const cases = [
      { width: 320, locale: 'ru' },
      { width: 375, locale: 'en' },
      { width: 390, locale: 'zh' },
      { width: 430, locale: 'ru' },
      { width: 768, locale: 'en' },
      { width: 1024, locale: 'zh' },
      { width: 1440, locale: 'ru' },
    ] as const;

    for (const item of cases) {
      await page.setViewportSize({ width: item.width, height: 1000 });

      const home = await page.goto(`/platform-v7?lang=${item.locale}`, { waitUntil: 'load' });
      expect(home?.ok(), `home ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectMinimumTargets(page, '.pc-public-contact-dock-action');

      const passport = await page.goto(`/platform-v7/ai-in-action?lang=${item.locale}`, { waitUntil: 'load' });
      expect(passport?.ok(), `passport ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-ai-in-action-authority"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectMinimumTargets(page, '.pc-public-contact-dock-action');
    }
  });
});
