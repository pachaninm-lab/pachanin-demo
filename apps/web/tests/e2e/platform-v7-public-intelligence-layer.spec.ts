import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectHeaderAccess(page: Page, locale = 'ru') {
  const mobile = (page.viewportSize()?.width ?? 1440) < 768;
  const menu = page.locator('.pc-site-mobile-menu');
  const wasOpen = await menu.getAttribute('open') !== null;
  if (mobile && !wasOpen) {
    await menu.locator('summary').focus();
    await page.keyboard.press('Enter');
  }
  for (const route of ['login', 'register']) {
    const link = mobile
      ? menu.locator(`a.pc-final-mobile-access[href="/platform-v7/${route}?lang=${locale}"]`)
      : page.locator(route === 'login' ? '.entry-login' : '.pc-v6-header-cta');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `/platform-v7/${route}?lang=${locale}`);
    await expect(link).toBeInViewport({ ratio: 1 });
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44 - 0.001);
    expect(box!.height).toBeGreaterThanOrEqual(44 - 0.001);
  }
  if (mobile) {
    await expect(page.locator('.pc-v6-header-actions')).toBeHidden();
    if (!wasOpen) await menu.locator('summary').click();
  }
}


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
  await scrollAndFlush(page, 0);
  await expect(dock).toHaveAttribute('data-scroll-hidden', 'false');
  await expect(dock).toBeVisible();
  await expect(dock.locator('.pc-public-contact-dock-assistant')).toBeEnabled();
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

test.describe('Public Deal and Gekta intelligence layer', () => {
  test('home presents the registration-first ordinary Deal argument and fails closed', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const forbiddenRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/fgis|esia|gosuslugi|bank-callback|\/api\/proxy\/ai-assistant/i.test(url)) forbiddenRequests.push(url);
    });

    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
    await expect(page.locator('#pc-final-title')).toContainText('От лота и цены');
    await expect(page.locator('#pc-final-title')).toContainText('до поставки, качества и расчёта');
    await expectHeaderAccess(page);

    const heroPrimary = page.locator('.pc-final-hero .pc-final-primary');
    await expect(heroPrimary).toHaveCount(1);
    await expect(heroPrimary).toHaveAttribute('href', '/platform-v7/register?lang=ru&intent=sell');
    await expect(page.locator('.pc-final-hero .pc-final-secondary')).toHaveAttribute('href', '/platform-v7/register?lang=ru&intent=buy');
    await expect(page.locator('.pc-final-hero-visual')).toContainText('Одна Сделка');
    await expect(page.locator('.pc-final-hero-visual')).not.toContainText('1 200');
    await expect(page.locator('#how-it-works')).toContainText('Торги — только начало');
    await expect(page.locator('.pc-final-stages li')).toHaveCount(7);
    await expect(page.locator('.pc-final-participant-grid article')).toHaveCount(4);
    await expect(page.locator('.pc-final-carousel article')).toHaveCount(12);
    await expect(page.locator('#trust article')).toHaveCount(4);
    await expect(page.locator('#connection-process')).toHaveCount(0);
    await expect(page.locator('#connect-organization')).toBeVisible();
    await expect(page.getByRole('main')).toHaveAttribute('id', 'main-content');
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    await expect(page.locator('.pc-v6-control-tower')).toHaveCount(0);
    const execution = page.locator('.pc-final-state-tabs');
    await expect(execution.getByRole('tab')).toHaveCount(3);
    await expect(execution.getByRole('tab', { name: 'Норма', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#public-final-panel-normal')).toContainText('Основание подтверждено.');
    await execution.getByRole('tab', { name: 'Отклонение', exact: true }).click();
    await expect(page.locator('#public-final-panel-deviation')).toContainText('Фактическое качество отличается');
    await expect(page.locator('#public-final-panel-deviation')).toContainText('Требуется решение.');
    await execution.getByRole('tab', { name: 'Спор', exact: true }).click();
    await expect(page.locator('#public-final-panel-dispute')).toContainText('Финансовое действие остановлено');
    const carousel = page.locator('.pc-final-carousel');
    await carousel.focus();
    await expect(carousel).toBeFocused();
    await page.locator('#capability-1 nav a').click();
    await expect(page).toHaveURL(/#capability-2$/);
    await expect(page.locator('#capability-2')).toBeInViewport();

    const perspectives = page.getByRole('tablist', { name: 'Выберите роль для просмотра' });
    await page.locator('.pc-final-role-explorer > summary').click();
    await expect(perspectives).toBeVisible();
    await expect(perspectives.getByRole('tab')).toHaveCount(9);
    const employee = perspectives.getByRole('tab', { name: 'Сотрудник подключённой организации', exact: true });
    await employee.click();
    await expect(page.locator('#public-role-panel')).toContainText('Только данные и действия');
    await expect(page.locator('#public-role-panel')).toHaveAttribute('aria-labelledby', 'public-role-tab-employee');

    const taiProductLink = page.getByRole('link', { name: 'Гекта в Сделке' }).first();
    await expect(taiProductLink).toHaveAttribute('href', /\/platform-v7\/ai-in-action\?lang=ru/);

    await expect(page.locator('#maturity, #integrations, #role-entry')).toHaveCount(0);
    await expect(page.locator('#faq details')).toHaveCount(0);
    await expect(page.locator('.pc-final-footer-groups nav')).toHaveCount(4);

    await settleContactDock(page);
    await expect(page.locator('.pc-public-contact-dock-action')).toHaveCount(3);
    await expectMinimumTargets(page, '.pc-public-contact-dock-action');
    await expectMinimumTargets(
      page,
      '.pc-site-brand, .pc-skip-link, .pc-site-mobile-menu > summary, .pc-site-locale-switch, .entry-login, .pc-v6-header-cta, .pc-final-state-tabs button, .pc-final-role-link, .pc-final-footer-groups a',
    );
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(forbiddenRequests).toEqual([]);
    expect(runtimeFailures).toEqual([]);
  });

  test('390×844 first viewport keeps registration visible and the public assistant compact', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);

    await expect(page.locator('#pc-final-title')).toContainText('От лота и цены');
    await expect(page.locator('#pc-final-title')).toContainText('до поставки, качества и расчёта');
    const primary = page.locator('.pc-final-hero .pc-final-primary');
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute('href', '/platform-v7/register?lang=ru&intent=sell');
    const primaryBox = await primary.boundingBox();
    expect(primaryBox).not.toBeNull();
    expect((primaryBox?.y ?? 9999) + (primaryBox?.height ?? 9999)).toBeLessThanOrEqual(844);
    await expectHeaderAccess(page);

    const dealCardBox = await page.locator('.pc-final-hero-visual').boundingBox();
    expect(dealCardBox).not.toBeNull();
    expect(dealCardBox?.y ?? 9999).toBeLessThan(844);
    const dock = page.locator('.pc-public-contact-dock');
    await expect(dock).toHaveAttribute('data-scroll-hidden', 'false');
    await expect(dock).toBeVisible();
    await expect(dock.locator('.pc-public-contact-dock-assistant')).toBeEnabled();
    const secondaryActions = dock.locator('.pc-public-contact-dock-action:not(.pc-public-contact-dock-assistant)');
    await expect(secondaryActions).toHaveCount(2);
    for (const action of await secondaryActions.all()) await expect(action).toBeHidden();
    const dockBox = await dock.boundingBox();
    expect(dockBox).not.toBeNull();
    expect(dockBox?.width ?? 9999).toBeLessThanOrEqual(58);
    expect(dockBox?.x ?? -1).toBeGreaterThanOrEqual(320);
    await expectNoHorizontalOverflow(page);
  });

  test('public Trust Center states verifiable boundaries without certification claims', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const response = await page.goto('/platform-v7/trust?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('#pc-trust-title')).toBeVisible();
    await expect(page.locator('.pc-trust-domains article')).toHaveCount(4);
    await expect(page.locator('#controls')).toContainText('Критические решения подтверждает уполномоченный участник');
    await expect(page.locator('#ai')).toContainText('нет самостоятельного права');
    await expect(page.locator('#claims')).toContainText('не заявляет без доказательств');
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('Gekta public page exposes human-readable boundaries and keyboard-complete role views', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/platform-v7/ai-in-action?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-testid="platform-v7-ai-in-action-authority"]')).toBeVisible();
    await expect(page.getByText('NOT_ATTESTED', { exact: true })).toHaveCount(0);
    const compatibilityMarker = page.locator('[data-release-compat="ai-passport"]');
    await expect(compatibilityMarker).toHaveCount(1);
    await expect(compatibilityMarker).toBeHidden();
    for (const selector of ['#role-analysis', '#documents', '#government-data', '#risks-money', '#prepared-actions', '#evidence', '#security', '#limitations', '#connection']) {
      await expect(page.locator(selector)).toBeVisible();
    }

    const roleAnalysis = page.locator('#role-analysis');
    const tabs = roleAnalysis.getByRole('tab');
    await expect(tabs).toHaveCount(9);
    const buyer = roleAnalysis.getByRole('tab', { name: 'Покупатель', exact: true });
    await buyer.focus();
    await buyer.press('ArrowRight');
    const logistics = roleAnalysis.getByRole('tab', { name: 'Логистика', exact: true });
    await expect(logistics).toBeFocused();
    await expect(logistics).toHaveAttribute('aria-selected', 'true');
    await logistics.press('End');
    const employee = roleAnalysis.getByRole('tab', { name: 'Сотрудник подключённой организации', exact: true });
    await expect(employee).toBeFocused();
    await expect(employee).toHaveAttribute('aria-selected', 'true');
    await expect(roleAnalysis.locator('[role="tabpanel"]')).toHaveAttribute('aria-labelledby', 'pc-ai-role-tab-employee');
    await expect(roleAnalysis.locator('[role="tabpanel"]')).toContainText('Сделка остановилась');

    const government = page.locator('#government-data');
    await expect(government.locator('[data-status="CONNECTED"]')).toHaveCount(0);
    await expect(government).toContainText('Текущая проверка не выполнялась');
    await expect(page.locator('#limitations')).toContainText('Гекта не придумывает данные внешней системы, если не получила их из разрешённого источника');
    await expect(page.locator('#limitations')).toContainText('Гекта не назначает роль и не меняет права доступа');
    await settleContactDock(page);
    await expect(page.locator('.pc-public-contact-dock-action')).toHaveCount(3);
    const media = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    expect(media).toBe(true);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('specified 320–1440 widths keep public routes inside the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Full width matrix runs once on Chromium.');
    const cases = [
      { width: 320, locale: 'ru' }, { width: 375, locale: 'en' }, { width: 390, locale: 'zh' },
      { width: 430, locale: 'ru' }, { width: 768, locale: 'en' }, { width: 1280, locale: 'zh' }, { width: 1440, locale: 'ru' },
    ] as const;
    for (const item of cases) {
      await page.setViewportSize({ width: item.width, height: 1000 });
      const home = await page.goto(`/platform-v7?lang=${item.locale}`, { waitUntil: 'load' });
      expect(home?.ok(), `home ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
      await expect(page.locator('.pc-final-participant-grid')).toBeVisible();
      await expect(page.locator('#how-it-works')).toBeVisible();
      await expect(page.locator('.pc-final-carousel')).toBeVisible();
      await expect(page.locator('.pc-final-execution-states')).toBeVisible();
      await expect(page.locator('#trust')).toBeVisible();
      await expect(page.locator('#connect-organization')).toBeVisible();
      await expect(page.locator('#connection-process')).toHaveCount(0);
      await expect(page.locator('#maturity, #integrations, #role-entry')).toHaveCount(0);
      await expectHeaderAccess(page, item.locale);
      await expectNoHorizontalOverflow(page);
      await settleContactDock(page);
      await expectMinimumTargets(page, '.pc-public-contact-dock-action');
      const trust = await page.goto(`/platform-v7/trust?lang=${item.locale}`, { waitUntil: 'load' });
      expect(trust?.ok(), `trust ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('.pc-trust-domains article')).toHaveCount(4);
      await expectNoHorizontalOverflow(page);
      const gekta = await page.goto(`/platform-v7/ai-in-action?lang=${item.locale}`, { waitUntil: 'load' });
      expect(gekta?.ok(), `gekta ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-ai-in-action-authority"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await settleContactDock(page);
      await expectMinimumTargets(page, '.pc-public-contact-dock-action');
    }
  });

  test('About, Contact and How it works keep registration-first chrome on mobile and desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Linked-page responsive matrix runs once on Chromium.');
    const cases = [
      { width: 320, locale: 'ru' },
      { width: 390, locale: 'zh' },
      { width: 1440, locale: 'en' },
    ] as const;

    for (const item of cases) {
      await page.setViewportSize({ width: item.width, height: 1000 });

      const about = await page.goto(`/platform-v7/about?lang=${item.locale}`, { waitUntil: 'load' });
      expect(about?.ok(), `about ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.p7-about-register')).toBeVisible();
      await expect(page.locator('.p7-about-register')).toHaveAttribute('href', `/platform-v7/register?lang=${item.locale}`);
      await expectMinimumTargets(page, '.p7-about-register');
      await expectNoHorizontalOverflow(page);

      const contact = await page.goto(`/platform-v7/contact?lang=${item.locale}`, { waitUntil: 'load' });
      expect(contact?.ok(), `contact ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-question-form-page"]')).toBeVisible();
      await expect(page.locator('.p7-contact-register')).toBeVisible();
      await expect(page.locator('.p7-contact-register')).toHaveAttribute('href', `/platform-v7/register?lang=${item.locale}`);
      await expect(page.locator("form[action='/api/platform-v7/inquiries']")).toBeVisible();
      await expectMinimumTargets(page, '.p7-contact-register');
      await expectNoHorizontalOverflow(page);

      const how = await page.goto(`/platform-v7/how-it-works?lang=${item.locale}`, { waitUntil: 'load' });
      expect(how?.ok(), `how-it-works ${item.width}px ${item.locale}`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-deal-from-inside"]')).toBeVisible();
      const howRegister = page.locator('.pc-site-header .pc-ppe-primary-button');
      await expect(howRegister).toBeVisible();
      await expect(howRegister).toHaveAttribute('href', `/platform-v7/register?lang=${item.locale}`);
      await expectMinimumTargets(page, '.pc-site-header .pc-ppe-primary-button');
      await expectNoHorizontalOverflow(page);
    }
  });
});
