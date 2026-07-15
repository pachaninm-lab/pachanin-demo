import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// WCAG assertions stay fail-closed across every configured desktop and mobile engine.
function installLayoutShiftObserver(page: Page) {
  return page.addInitScript(() => {
    (window as Window & { __pcPublicExperienceLayoutShift?: number }).__pcPublicExperienceLayoutShift = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
          if (entry.hadRecentInput) continue;
          const target = window as Window & { __pcPublicExperienceLayoutShift?: number };
          target.__pcPublicExperienceLayoutShift = (target.__pcPublicExperienceLayoutShift || 0) + (entry.value || 0);
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Some engines do not expose LayoutShift. The accumulated value stays zero.
    }
  });
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

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function expectLayoutShiftWithinBudget(page: Page) {
  await page.waitForTimeout(250);
  const cls = await page.evaluate(() => (
    window as Window & { __pcPublicExperienceLayoutShift?: number }
  ).__pcPublicExperienceLayoutShift || 0);
  expect(cls).toBeLessThanOrEqual(0.1);
}

async function expectMinimumTargets(page: Page, locator: string) {
  const targets = await page.locator(locator).evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.every((target) => target.width >= 44 && target.height >= 44)).toBe(true);
}

async function expectNoOverlap(page: Page, floatingSelector: string, targetSelector: string) {
  const overlap = await page.evaluate(({ floatingSelector, targetSelector }) => {
    const floating = document.querySelector<HTMLElement>(floatingSelector);
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!floating || !target) return false;
    const a = floating.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }, { floatingSelector, targetSelector });
  expect(overlap).toBe(false);
}

test.describe('Public Product Experience V4 browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await installLayoutShiftObserver(page);
  });

  test('homepage is compact, localized and keeps support clear of primary actions', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    await page.setViewportSize({ width: 320, height: 900 });
    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);

    await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
    await expect(page.locator('.pc-site-brand img')).toBeVisible();
    await expect(page.locator('.pc-ppe-hero-progress-mobile')).toBeVisible();
    await expect(page.locator('.pc-ppe-hero-contour-desktop')).toBeHidden();
    await expect(page.getByRole('link', { name: /Посмотреть сделку изнутри/ }).first()).toBeVisible();
    await expect(page.locator('.pc-ppe-section').nth(1).locator(':scope > .pc-ppe-perspective-grid > .pc-ppe-perspective-card')).toHaveCount(5);
    await expect(page.locator('.pc-ppe-all-participants')).not.toHaveAttribute('open', '');

    const support = page.locator('.p7-support-chat-button');
    await expect(support).toBeVisible();
    await page.locator('.pc-ppe-final-cta').scrollIntoViewIfNeeded();
    await page.waitForTimeout(260);
    await expectNoOverlap(page, '.p7-support-chat-button', '.pc-ppe-final-cta .pc-ppe-primary-button');
    await expectNoOverlap(page, '.p7-support-chat-button', '.pc-ppe-final-cta .pc-ppe-secondary-button');

    await page.evaluate(() => document.getElementById('pc-ppe-perspectives-title')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(100);
    const headingTop = await page.locator('#pc-ppe-perspectives-title').evaluate((element) => element.getBoundingClientRect().top);
    expect(headingTop).toBeGreaterThanOrEqual(63);

    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    await expectLayoutShiftWithinBudget(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('deal explorer is localized, deterministic and isolated from live APIs', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const forbiddenRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/\/api\/|fgis|esia|sber|bank-callback|event-bus/i.test(url)) forbiddenRequests.push(url);
    });

    for (const locale of ['ru', 'en', 'zh'] as const) {
      const response = await page.goto(
        `/platform-v7/how-it-works?lang=${locale}&entry=deal&lens=money&stage=settlement&scenario=partial&perspective=bank&risk=paymentBasis&ai=0`,
        { waitUntil: 'load' },
      );
      expect(response?.ok(), `${locale} deal explorer response`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-deal-from-inside"]')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
      await expect(page.locator('.pc-ppe-explorer')).toHaveAttribute('data-lens', 'money');
      await expect(page.locator('.pc-ppe-explorer')).toHaveAttribute('data-scenario', 'partial');
      await expect(page.locator('.pc-ppe-deal-card')).toBeVisible();
      await expect(page.locator('.pc-ppe-lens-list button')).toHaveCount(6);
      await expect(page.locator('.pc-ppe-segmented button')).toHaveCount(3);
      await expect(page.locator('.pc-ppe-select-label option')).toHaveCount(12);
      await expect(page.locator('.pc-ppe-stage-track button')).toHaveCount(10);
      await expectNoHorizontalOverflow(page);
    }

    expect(forbiddenRequests).toEqual([]);
    expect(runtimeFailures).toEqual([]);
  });

  test('role-first, problem-first and deal-first entries resolve into the same deal', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);

    await page.goto('/platform-v7/how-it-works?lang=ru&entry=role', { waitUntil: 'load' });
    const roleGate = page.locator('.pc-ppe-entry-gate');
    await expect(roleGate).toHaveAttribute('data-entry-variant', 'role');
    await expect(page.locator('.pc-ppe-entry-option')).toHaveCount(4);
    await page.getByRole('button', { name: /Я контролирую деньги и риски/ }).click();
    await expect(page.locator('.pc-ppe-explorer')).toHaveAttribute('data-lens', 'money');
    await expect(page.locator('.pc-ppe-select-label select')).toHaveValue('bank');
    await expect(page).toHaveURL(/entry=deal/);
    await expect(page).toHaveURL(/source=role-first/);
    await expect(page).not.toHaveURL(/[?&](role|membership|token|permission)=/);

    await page.goBack();
    await expect(roleGate).toHaveAttribute('data-entry-variant', 'role');

    await page.goto('/platform-v7/how-it-works?lang=ru&entry=problem', { waitUntil: 'load' });
    const problemGate = page.locator('.pc-ppe-entry-gate');
    await expect(problemGate).toHaveAttribute('data-entry-variant', 'problem');
    await expect(page.locator('.pc-ppe-entry-option')).toHaveCount(4);
    await page.getByRole('button', { name: /Что происходит при отклонении/ }).click();
    await expect(page.locator('.pc-ppe-explorer')).toHaveAttribute('data-lens', 'risk');
    await expect(page).toHaveURL(/source=problem-first/);

    await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal', { waitUntil: 'load' });
    await expect(page.locator('.pc-ppe-entry-gate')).toHaveCount(0);
    await expect(page.locator('.pc-ppe-explorer')).toBeVisible();

    await expectNoSeriousAxeViolations(page);
    await expectNoHorizontalOverflow(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('lenses, scenarios, AI layer and browser history remain operable', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    await page.goto(
      '/platform-v7/how-it-works?lang=ru&entry=deal&lens=money&stage=settlement&scenario=partial&perspective=bank&risk=paymentBasis&ai=0',
      { waitUntil: 'load' },
    );

    const explorer = page.locator('.pc-ppe-explorer');
    await page.locator('.pc-ppe-lens-list button').filter({ hasText: 'Риски и спор' }).click();
    await expect(explorer).toHaveAttribute('data-lens', 'risk');
    await expect(page).toHaveURL(/lens=risk/);

    await page.locator('.pc-ppe-segmented button').filter({ hasText: 'Спор по качеству' }).click();
    await expect(explorer).toHaveAttribute('data-scenario', 'dispute');
    await expect(page).toHaveURL(/scenario=dispute/);

    await page.goBack();
    await expect(explorer).toHaveAttribute('data-lens', 'risk');
    await expect(explorer).toHaveAttribute('data-scenario', 'partial');

    await page.locator('.pc-ppe-lens-list button').filter({ hasText: 'ИИ и аналитика' }).click();
    const aiToggle = page.locator('.pc-ppe-ai-toggle');
    await expect(aiToggle).toHaveAttribute('aria-checked', 'false');
    await aiToggle.click();
    await expect(aiToggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.pc-ppe-ai-signals article')).toHaveCount(3);
    await expect(page).toHaveURL(/ai=1/);

    await expectNoSeriousAxeViolations(page);
    await expectLayoutShiftWithinBudget(page);
    await expectNoHorizontalOverflow(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('320 CSS pixel reflow and touch targets remain within the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });

    for (const locale of ['ru', 'en', 'zh'] as const) {
      const entryResponse = await page.goto(`/platform-v7/how-it-works?lang=${locale}&entry=role`, { waitUntil: 'load' });
      expect(entryResponse?.ok(), `${locale} role entry 320px response`).toBe(true);
      await expectNoHorizontalOverflow(page);
      await expectMinimumTargets(page, '.pc-ppe-entry-option');

      const response = await page.goto(`/platform-v7/how-it-works?lang=${locale}&entry=deal`, { waitUntil: 'load' });
      expect(response?.ok(), `${locale} explorer 320px response`).toBe(true);
      await expectNoHorizontalOverflow(page);
      await expectMinimumTargets(page, '.pc-ppe-lens-list button');
      await expectMinimumTargets(page, '.pc-ppe-segmented button');
      await expectMinimumTargets(page, '.pc-ppe-stage-nav button');
      const stageLayout = await page.locator('.pc-ppe-stage-track').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      expect(stageLayout).not.toBe('none');
      const stageBounds = await page.locator('.pc-ppe-stage-track button').evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }));
      expect(stageBounds.every((box) => box.left >= -1 && box.right <= 321)).toBe(true);
    }
  });
});
