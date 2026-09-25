import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function collectRuntimeFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push('pageerror: ' + error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/hydration|failed to hydrate|uncaught|react error|error boundary/i.test(text)) failures.push('console: ' + text);
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
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function expectMinimumTargets(page: Page, locator: string) {
  const elements = page.locator(locator);
  await expect.poll(async () => {
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
  }, { timeout: 15_000, intervals: [100, 250, 500], message: locator + ' must remain at least 44×44 CSS px' }).toBe(true);
}

test.describe('Public Deal and Gekta intelligence layer', () => {
  test('home presents the registration-first canonical Deal argument and fails closed', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const forbiddenRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/fgis|esia|gosuslugi|bank-callback|\/api\/proxy\/ai-assistant/i.test(url)) forbiddenRequests.push(url);
    });

    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    const root = page.locator('[data-testid="platform-v7-root-execution-cockpit"]');
    await expect(root).toBeVisible();
    await expect(page.locator('#pc-cp-home-title')).toContainText('Агросделка');
    await expect(page.locator('#pc-cp-home-title')).toContainText('до результата');

    const headerRegister = page.locator('.pc-site-header .pc-v6-header-cta');
    await expect(headerRegister).toBeVisible();
    await expect(headerRegister).toHaveAttribute('href', '/platform-v7/register?lang=ru');

    const heroActions = page.locator('.pc-cp-hero-copy .pc-cp-button');
    await expect(heroActions).toHaveCount(2);
    await expect(heroActions.nth(0)).toHaveAttribute('href', '/platform-v7/register?lang=ru&intent=sell');
    await expect(heroActions.nth(1)).toHaveAttribute('href', '/platform-v7/register?lang=ru&intent=buy');

    const lens = page.locator('.pc-cp-deal-lens');
    await expect(lens).toContainText('Структура Сделки');
    await expect(lens.locator('.pc-cp-deal-lens-cell')).toHaveCount(4);

    await expect(page.locator('#market')).toBeVisible();
    await expect(page.locator('[data-testid="canonical-market-preview"]')).toBeVisible();
    await expect(page.locator('#deal-path .pc-cp-stage')).toHaveCount(7);
    await expect(page.locator('#participants .pc-cp-role-tags span')).toHaveCount(9);
    await expect(page.locator('#live .pc-cp-state-cell')).toHaveCount(5);
    await expect(page.locator('#trust .pc-cp-trust-card')).toHaveCount(4);
    await expect(page.locator('#gekta .pc-cp-gekta-strip')).toBeVisible();
    await expect(page.locator('#capabilities .pc-cp-capability')).toHaveCount(12);

    // The canonical landing intentionally does not hydrate the retired support dock.
    await expect(page.locator('.pc-public-contact-dock')).toHaveCount(0);
    await expectMinimumTargets(page, '.pc-site-brand, .pc-site-mobile-menu > summary, .pc-site-locale-option:visible, .pc-v6-header-cta:visible, .pc-cp-hero-copy .pc-cp-button');
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(forbiddenRequests).toEqual([]);
    expect(runtimeFailures).toEqual([]);
  });

  test('390×844 first viewport keeps registration and canonical Deal context visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);

    const heading = page.locator('#pc-cp-home-title');
    await expect(heading).toBeVisible();
    const primary = page.locator('.pc-cp-hero-copy .pc-cp-button').first();
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute('href', '/platform-v7/register?lang=ru&intent=sell');
    const primaryBox = await primary.boundingBox();
    expect(primaryBox).not.toBeNull();
    expect((primaryBox?.y ?? 9999) + (primaryBox?.height ?? 9999)).toBeLessThanOrEqual(844);

    await expect(page.locator('.pc-cp-deal-lens')).toBeVisible();
    await expect(page.locator('.pc-public-contact-dock')).toHaveCount(0);
    await expect(page.locator('.pc-cp-bottom-nav a')).toHaveCount(5);
    await expectMinimumTargets(page, '.pc-cp-bottom-nav a');
    await expectNoHorizontalOverflow(page);
  });

  test('public Trust Center states verifiable boundaries without certification claims', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const response = await page.goto('/platform-v7/trust?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    const root = page.locator('.pc-cp-page-trust');
    await expect(root.locator('h1')).toBeVisible();
    await expect(root.locator('.pc-cp-trust-pillar')).toHaveCount(4);
    await expect(root).toContainText('Проверяемые факты');
    await expect(root).toContainText('Полномочия');
    await expect(root).not.toContainText('сертифицирован');
    await expect(page.locator('.pc-public-contact-dock')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('Gekta public page exposes human-readable boundaries without independent authority', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto('/platform-v7/ai-in-action?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    const root = page.locator('.pc-cp-page-gekta');
    await expect(root).toBeVisible();
    await expect(root.locator('.pc-cp-gekta-workspace')).toBeVisible();
    await expect(root).toContainText('Только разрешённый контекст');
    await expect(root).toContainText('Гекта не создаёт полномочия');
    await expect(root).toContainText('не подменяет источник');
    await expect(root).not.toContainText('NOT_ATTESTED');
    await expect(page.locator('.pc-public-contact-dock')).toHaveCount(0);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('specified 320–1440 widths keep canonical public routes inside the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Full width matrix runs once on Chromium.');
    const cases = [
      { width: 320, locale: 'ru' }, { width: 375, locale: 'en' }, { width: 390, locale: 'zh' },
      { width: 430, locale: 'ru' }, { width: 768, locale: 'en' }, { width: 1280, locale: 'zh' }, { width: 1440, locale: 'ru' },
    ] as const;
    for (const item of cases) {
      await page.setViewportSize({ width: item.width, height: 1000 });
      const home = await page.goto('/platform-v7?lang=' + item.locale, { waitUntil: 'load' });
      expect(home?.ok(), 'home ' + item.width + 'px ' + item.locale).toBe(true);
      for (const selector of ['#market', '#deal-path', '#participants', '#live', '#trust', '#gekta', '#capabilities']) await expect(page.locator(selector)).toBeVisible();
      await expect(page.locator('.pc-public-contact-dock')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);

      const trust = await page.goto('/platform-v7/trust?lang=' + item.locale, { waitUntil: 'load' });
      expect(trust?.ok(), 'trust ' + item.width + 'px ' + item.locale).toBe(true);
      await expect(page.locator('.pc-cp-page-trust .pc-cp-trust-pillar')).toHaveCount(4);
      await expectNoHorizontalOverflow(page);

      const gekta = await page.goto('/platform-v7/ai-in-action?lang=' + item.locale, { waitUntil: 'load' });
      expect(gekta?.ok(), 'gekta ' + item.width + 'px ' + item.locale).toBe(true);
      await expect(page.locator('.pc-cp-page-gekta .pc-cp-gekta-workspace')).toBeVisible();
      await expectNoHorizontalOverflow(page);
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
      for (const path of ['about', 'contact', 'how-it-works'] as const) {
        const response = await page.goto('/platform-v7/' + path + '?lang=' + item.locale, { waitUntil: 'load' });
        expect(response?.ok(), path + ' ' + item.width + 'px ' + item.locale).toBe(true);
        await expect(page.locator('h1')).toBeVisible();
        const register = page.locator('.pc-site-header a[href="/platform-v7/register?lang=' + item.locale + '"]:visible').first();
        await expect(register).toBeVisible();
        const box = await register.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await expectNoHorizontalOverflow(page);
      }
    }
  });
});
