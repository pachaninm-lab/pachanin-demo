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

async function expectLayoutShiftWithinBudget(page: Page) {
  await page.waitForTimeout(250);
  const cls = await page.evaluate(() => (
    window as Window & { __pcPublicExperienceLayoutShift?: number }
  ).__pcPublicExperienceLayoutShift || 0);
  expect(cls).toBeLessThanOrEqual(0.1);
}

async function expectMinimumTargets(page: Page, locator: string) {
  const elements = page.locator(locator);
  await expect(elements.first()).toBeVisible();
  await expect.poll(async () => {
    const targets = await elements.evaluateAll((nodes) => nodes.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
    return targets.length > 0 && targets.every((target) => target.width >= 44 && target.height >= 44);
  }, {
    timeout: 5_000,
    message: `${locator} must settle at a minimum 44×44 CSS px target size`,
  }).toBe(true);
}

test.describe('Public Product Experience V4 browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __pcPublicExperienceLayoutShift?: number }).__pcPublicExperienceLayoutShift = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
            if (!entry.hadRecentInput) {
              const target = window as Window & { __pcPublicExperienceLayoutShift?: number };
              target.__pcPublicExperienceLayoutShift = (target.__pcPublicExperienceLayoutShift || 0) + (entry.value || 0);
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch {
        // LayoutShift is unavailable in some engines; the value remains zero.
      }
    });
  });

  test('home establishes one platform story before AI, roles and proof', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Сделка под контролем');
    await expect(page.locator('#deal-example')).toBeVisible();
    await expect(page.locator('#participants')).toBeVisible();
    await expect(page.locator('#reliability')).toBeVisible();
    await expect(page.locator('.pc-ppe-final-cta')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    await expectLayoutShiftWithinBudget(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('role-first entry and Deal explorer retain explicit public demonstration boundaries', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const response = await page.goto('/platform-v7/how-it-works?lang=ru&entry=role', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-testid="platform-v7-deal-from-inside"]')).toBeVisible();
    await expect(page.locator('.pc-ppe-entry-gate')).toBeVisible();
    await expect(page.locator('.pc-ppe-entry-option').first()).toBeVisible();
    await page.locator('.pc-ppe-entry-option').first().click();
    await expect(page.locator('.pc-ppe-explorer')).toBeVisible();
    await expect(page.locator('.pc-ppe-demo-boundary')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
    await expectLayoutShiftWithinBudget(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('scenario, lens, role and stage controls preserve public-state isolation', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const response = await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('.pc-ppe-explorer')).toBeVisible();

    const scenario = page.locator('.pc-ppe-segmented button').nth(1);
    await scenario.click();
    await expect(scenario).toHaveAttribute('aria-pressed', 'true');

    const lens = page.locator('.pc-ppe-lens-list button:visible').nth(1);
    await lens.click();
    await expect(lens).toHaveAttribute('data-active', 'true');

    const role = page.locator('.pc-ppe-select-label select');
    await role.selectOption('seller');
    await expect(role).toHaveValue('seller');

    const nextStage = page.locator('.pc-ppe-stage-nav button').last();
    await nextStage.click();
    await expect(page.locator('.pc-ppe-stage-track button[aria-current="step"]')).toHaveCount(1);

    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get('entry')).toBe('deal');
    expect(currentUrl.searchParams.get('scenario')).toBeTruthy();
    expect(currentUrl.searchParams.get('lens')).toBeTruthy();
    expect(currentUrl.searchParams.get('perspective')).toBe('seller');
    await expectNoHorizontalOverflow(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('browser history restores normalized public state without authority leakage', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal&stage=terms&lens=execution&perspective=buyer', { waitUntil: 'load' });
    await expect(page.locator('.pc-ppe-explorer')).toBeVisible();

    await page.locator('.pc-ppe-lens-list button:visible').nth(1).click();
    await page.locator('.pc-ppe-select-label select').selectOption('seller');
    const changedUrl = page.url();
    expect(changedUrl).toContain('perspective=seller');

    await page.goBack({ waitUntil: 'load' });
    await expect(page.locator('.pc-ppe-explorer')).toBeVisible();
    await expect(page.locator('.pc-ppe-select-label select')).toHaveValue('buyer');
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
      await expectMinimumTargets(page, '.pc-ppe-lens-list button:visible');
      await expectMinimumTargets(page, '.pc-ppe-segmented button');
      await expectMinimumTargets(page, '.pc-ppe-stage-nav button');
    }
  });
});
