import { expect, test, type Page, type TestInfo } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/platform-v7',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
] as const;

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

const LANGUAGE_SEQUENCE = ['ru', 'en', 'zh', 'ru'] as const;

function isChromiumProject(testInfo: TestInfo) {
  return /chromium|edge/i.test(testInfo.project.name);
}

function intersects(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

async function assertNoBlankScreen(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  await expect.poll(async () => (await page.locator('body').innerText()).trim().length).toBeGreaterThan(40);
  await expect(page.locator('body')).not.toHaveCSS('opacity', '0');
  await expect(page.locator('body')).not.toHaveCSS('visibility', 'hidden');
}

async function installVitalsObserver(page: Page) {
  await page.addInitScript(() => {
    const state = { lcp: 0, cls: 0, inp: 0 };
    Object.defineProperty(window, '__pcPublicVitals', { value: state, configurable: true });

    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries.at(-1);
        if (last) state.lcp = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
          if (!entry.hadRecentInput) state.cls += entry.value || 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { duration?: number; interactionId?: number }>) {
          if ((entry.interactionId || 0) > 0) state.inp = Math.max(state.inp, entry.duration || 0);
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    } catch {}
  });
}

async function readVitals(page: Page) {
  return page.evaluate(() => {
    const value = (window as Window & { __pcPublicVitals?: { lcp: number; cls: number; inp: number } }).__pcPublicVitals;
    return value || { lcp: 0, cls: 0, inp: 0 };
  });
}

test.describe('public entry — cross-browser critical path', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} cold opens without a blank screen`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status() || 0).toBeLessThan(500);
      await assertNoBlankScreen(page);
      expect(pageErrors).toEqual([]);
    });
  }

  test('public landing exposes exactly two hero actions and no role selector', async ({ page }) => {
    await page.goto('/platform-v7');
    const hero = page.locator('main section').first();
    await expect(hero.locator('a[href="/platform-v7/register"]')).toBeVisible();
    await expect(hero.locator('a[href="/platform-v7/deal-flow"]')).toBeVisible();
    await expect(hero.locator('a')).toHaveCount(2);
    await expect(page.locator('a[href*="?role="]')).toHaveCount(0);
    await expect(page.locator('select[name*="role" i], [data-testid*="role-picker" i]')).toHaveCount(0);
  });

  test('role query parameters never create a role picker or client authority', async ({ page }) => {
    await page.goto('/platform-v7/login?role=buyer');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('select[name*="role" i], [data-testid*="role-picker" i]')).toHaveCount(0);
    await expect(page.getByText(/выберите.*роль|choose.*role|选择.*角色/i)).toHaveCount(0);
  });

  test('RU → EN → ZH → RU is declarative and stable', async ({ page }) => {
    await page.goto('/platform-v7');
    await expect(page.locator('html')).toHaveAttribute('lang', LANGUAGE_SEQUENCE[0]);

    const switcher = page.locator('header button').first();
    for (const expected of LANGUAGE_SEQUENCE.slice(1)) {
      await switcher.click();
      await expect(page.locator('html')).toHaveAttribute('lang', expected);
      await assertNoBlankScreen(page);
      await expect(page.locator('body')).not.toContainText(/MISSING_MESSAGE|IntlError|undefined/i);
    }
  });

  test('support trigger does not overlap hero CTAs', async ({ page }) => {
    await page.goto('/platform-v7');
    const primary = page.locator('a[href="/platform-v7/register"]').first();
    const secondary = page.locator('a[href="/platform-v7/deal-flow"]').first();
    const support = page.locator('button[aria-controls="public-support-dialog"]');

    const [primaryBox, secondaryBox, supportBox] = await Promise.all([
      primary.boundingBox(),
      secondary.boundingBox(),
      support.boundingBox(),
    ]);
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(supportBox).not.toBeNull();
    expect(intersects(primaryBox!, supportBox!)).toBe(false);
    expect(intersects(secondaryBox!, supportBox!)).toBe(false);
  });

  test('keyboard flow reaches controls and support can be closed with Escape', async ({ page }) => {
    await page.goto('/platform-v7/login');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).not.toHaveJSProperty('tagName', 'BODY');

    const support = page.locator('button[aria-controls="public-support-dialog"]');
    await support.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#public-support-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#public-support-dialog')).toHaveCount(0);
    await expect(support).toBeFocused();
  });

  test('login prevents duplicate parallel requests and exposes a stable progress state', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/auth/login', async (route) => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'INVALID_CREDENTIALS' }) });
    });

    await page.goto('/platform-v7/login');
    await page.locator('input[type="email"]').fill('qa@example.com');
    await page.locator('input[type="password"]').fill('not-a-real-password');
    const submit = page.locator('form button[type="submit"]');
    await submit.dblclick({ delay: 10 });
    await expect(submit).toBeDisabled();
    await expect(page.locator('[role="alert"]')).toBeVisible();
    expect(requests).toBe(1);
  });

  test('network failure returns focusable error state and preserves email', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.abort('internetdisconnected'));
    await page.goto('/platform-v7/login');
    const email = page.locator('input[type="email"]');
    await email.fill('qa@example.com');
    await page.locator('input[type="password"]').fill('not-a-real-password');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(email).toHaveValue('qa@example.com');
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
  });

  test('forgot-password response is universal and cooldown is visible', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) => route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ accepted: true, cooldownSeconds: 60 }),
    }));
    await page.goto('/platform-v7/forgot-password');
    await page.locator('input[type="email"]').fill('unknown@example.com');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[role="status"]')).toBeVisible();
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
    await expect(page.locator('body')).not.toContainText(/account exists|аккаунт существует|账户存在于系统/i);
  });

  test('back, reload and BFCache-style navigation do not produce a blank screen', async ({ page }) => {
    await page.goto('/platform-v7');
    await page.locator('a[href="/platform-v7/login"]').click();
    await assertNoBlankScreen(page);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await assertNoBlankScreen(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertNoBlankScreen(page);
  });
});

test.describe('public entry — viewport and layout matrix', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}px has no horizontal overflow or broken H1`, async ({ page }, testInfo) => {
      test.skip(!/desktop-chromium/i.test(testInfo.project.name), 'Viewport matrix runs once on Chromium; browser projects cover the critical path.');
      await page.setViewportSize(viewport);
      await page.goto('/platform-v7');
      await assertNoBlankScreen(page);

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible();
      const box = await h1.boundingBox();
      expect(box?.width || 0).toBeGreaterThan(180);
      expect(box?.height || 0).toBeLessThan(viewport.height * 0.55);
    });
  }
});

test.describe('public entry — accessibility and performance evidence', () => {
  test('axe has no critical or serious violations on landing, login and recovery', async ({ page }) => {
    const moduleName = '@axe-core/playwright';
    let AxeBuilder: undefined | (new (options: { page: Page }) => { analyze: () => Promise<{ violations: Array<{ impact: string | null; id: string }> }> });
    try {
      const module = await import(moduleName);
      AxeBuilder = module.default as typeof AxeBuilder;
    } catch {
      test.skip(true, '@axe-core/playwright is not installed in this checkout. This is not an accessibility pass.');
      return;
    }

    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      const results = await new AxeBuilder!({ page }).analyze();
      const blocking = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
      expect(blocking, `${route}: ${blocking.map((item) => item.id).join(', ')}`).toEqual([]);
    }
  });

  test('throttled Chromium meets LCP, CLS and observed interaction budgets', async ({ page }, testInfo) => {
    test.skip(!isChromiumProject(testInfo), 'CDP throttling is Chromium-only.');
    await installVitalsObserver(page);

    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1_600 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      connectionType: 'cellular3g',
    });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.goto('/platform-v7', { waitUntil: 'networkidle' });
    const switcher = page.locator('header button').first();
    await switcher.click();
    await page.waitForTimeout(500);
    const vitals = await readVitals(page);

    expect(vitals.lcp || 0).toBeGreaterThan(0);
    expect(vitals.lcp).toBeLessThanOrEqual(2_500);
    expect(vitals.cls).toBeLessThanOrEqual(0.1);
    if (vitals.inp > 0) expect(vitals.inp).toBeLessThanOrEqual(200);
  });

  test('visual baseline contract', async ({ page }, testInfo) => {
    test.skip(process.env.PLAYWRIGHT_VISUAL_BASELINES !== '1', 'Baselines must be generated and approved explicitly; absence is not a visual-regression pass.');
    await page.goto('/platform-v7');
    await expect(page).toHaveScreenshot(`public-entry-${testInfo.project.name}.png`, { fullPage: true, animations: 'disabled' });
  });
});
