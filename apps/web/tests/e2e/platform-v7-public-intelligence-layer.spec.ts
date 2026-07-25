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

async function scrollAndFlush(page: Page, top: number) {
  await page.evaluate(async (targetTop) => {
    window.scrollTo({ top: targetTop, behavior: 'instant' });
    window.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
  }, top);
}

async function settleContactDock(page: Page) {
  const dock = page.locator('.pc-public-contact-dock');
  if (await dock.count() === 0) return;
  const mobile = (page.viewportSize()?.width ?? 1024) <= 767;
  if (!mobile) {
    await scrollAndFlush(page, 0);
    await expect(dock).toHaveAttribute('data-scroll-hidden', 'false');
    return;
  }
  await scrollAndFlush(page, 0);
  await expect(dock).toHaveAttribute('data-scroll-hidden', 'true');
  await scrollAndFlush(page, 1400);
  await expect(dock).toHaveAttribute('data-scroll-hidden', 'true');
  await scrollAndFlush(page, 800);
  await expect(dock).toHaveAttribute('data-scroll-hidden', 'false');
}

async function expectNoSeriousAxeViolations(page: Page) {
  await settleContactDock(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function expectMinimumTargets(page: Page, locator: string) {
  const elements = page.locator(locator);
  await expect.poll(async () => {
    if (!(await elements.first().isVisible())) await settleContactDock(page);
    const targets = await elements.evaluateAll((nodes) => nodes
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }));
    return targets.length > 0 && targets.every((target) => target.width >= 44 && target.height >= 44);
  }, { timeout: 15_000, intervals: [100, 250, 500], message: `${locator} must remain at least 44×44 CSS px` }).toBe(true);
}

test.describe('P0 public TAI intelligence layer browser acceptance', () => {
  test('home follows the problem → process → TAI → role → maturity story and fails closed', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const forbiddenRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/fgis|esia|gosuslugi|bank-callback|\/api\/proxy\/ai-assistant/i.test(url)) forbiddenRequests.push(url);
    });

    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
    await expect(page.locator('#pc-v6-title')).toContainText('Цена согласована. Но сделка всё ещё может сорваться.');
    await expect(page.locator('#pc-v6-title')).toContainText('доводит её до исполнения и расчёта');
    await expect(page.locator('[data-testid="platform-v7-problem-map"]')).toContainText('Цена уже согласована');

    await expect(page.locator('#deal-path')).toContainText('Одна Сделка связывает участников');
    await expect(page.locator('#tai .pc-v6-control-tower')).toContainText('Расчёт остановлен');
    await expect(page.locator('[data-testid="platform-v7-ai-analysis"]')).toContainText('Окончательный расчёт нельзя продолжить');
    await expect(page.locator('[data-testid="platform-v7-ai-analysis"]')).toContainText('Протокол лаборатории L-204');

    const taiProductLink = page.getByRole('link', { name: 'Посмотреть TAI подробнее' }).first();
    await expect(taiProductLink).toBeVisible();
    await expect(taiProductLink).toHaveAttribute('href', /\/platform-v7\/ai-in-action\?lang=ru/);

    const perspectives = page.getByRole('tablist', { name: 'Что видит каждый участник' });
    await expect(perspectives).toBeVisible();
    await expect(perspectives.getByRole('tab')).toHaveCount(12);
    await perspectives.getByRole('tab', { name: 'Арбитр' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('спорную сумму');
    await expect(page.getByText('Ролевое представление одного сценария. Переключение не открывает данные и не меняет права.')).toBeVisible();

    await expect(page.locator('#maturity')).toContainText('12');
    await expect(page.locator('#maturity')).toContainText('19');
    await expect(page.locator('#maturity')).toContainText('Private cloud и on-premise');

    await settleContactDock(page);
    await expect(page.locator('.pc-public-contact-dock-action')).toHaveCount(3);
    await expectMinimumTargets(page, '.pc-public-contact-dock-action');
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(forbiddenRequests).toEqual([]);
    expect(runtimeFailures).toEqual([]);
  });

  test('390×844 first viewport exposes the problem, resolution and primary action', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('#pc-v6-title')).toBeVisible();
    await expect(page.locator('#pc-v6-title')).toContainText('Цена согласована');
    await expect(page.locator('#pc-v6-title')).toContainText('исполнения и расчёта');
    await expect(page.getByRole('link', { name: 'Посмотреть Сделку в работе' }).first()).toBeVisible();
    await expect(page.locator('[data-testid="platform-v7-problem-map"]')).toBeVisible();
    await expect(page.locator('.pc-public-contact-dock')).toHaveAttribute('data-scroll-hidden', 'true');
    await expectNoHorizontalOverflow(page);
  });

  test('TAI passport exposes controlled layers without overstating maturity', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/platform-v7/ai-in-action?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-testid="platform-v7-ai-in-action-authority"]')).toBeVisible();
    await expect(page.getByText('NOT_ATTESTED', { exact: true })).toBeVisible();
    for (const selector of ['#role-analysis', '#documents', '#government-data', '#risks-money', '#prepared-actions', '#evidence', '#security', '#limitations', '#connection']) {
      await expect(page.locator(selector)).toBeVisible();
    }
    const roleAnalysis = page.locator('#role-analysis');
    await roleAnalysis.getByRole('tab', { name: 'Продавец' }).click();
    await expect(roleAnalysis.locator('[role="tabpanel"]')).toContainText('Версия протокола не связана');

    const government = page.locator('#government-data');
    await expect(government.locator('[data-status="CONNECTED"]')).toHaveCount(0);
    await expect(government.locator('.pc-public-government-result')).toContainText('Проверка не выполнялась');
    await expect(page.locator('#limitations')).toContainText('Неподключённая государственная система не отображается как подключённая');
    await settleContactDock(page);
    await expect(page.locator('.pc-public-contact-dock-action')).toHaveCount(3);
    const media = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    expect(media).toBe(true);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('specified 320–1440 widths keep both public routes inside the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Full width matrix runs once on Chromium.');
    const cases = [
      { width: 320, locale: 'ru' }, { width: 375, locale: 'en' }, { width: 390, locale: 'zh' },
      { width: 430, locale: 'ru' }, { width: 768, locale: 'en' }, { width: 1024, locale: 'zh' }, { width: 1440, locale: 'ru' },
    ] as const;
    for (const item of cases) {
      await page.setViewportSize({ width: item.width, height: 1000 });
      const home = await page.goto(`/platform-v7?lang=${item.locale}`, { waitUntil: 'load' });
      expect(home?.ok(), `home ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await settleContactDock(page);
      await expectMinimumTargets(page, '.pc-public-contact-dock-action');
      const passport = await page.goto(`/platform-v7/ai-in-action?lang=${item.locale}`, { waitUntil: 'load' });
      expect(passport?.ok(), `passport ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-ai-in-action-authority"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await settleContactDock(page);
      await expectMinimumTargets(page, '.pc-public-contact-dock-action');
    }
  });
});
