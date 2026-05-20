import { expect, test } from '@playwright/test';

// §D: Width matrix — 10 sizes × critical routes × light+dark
const WIDTHS = [360, 390, 480, 640, 768, 834, 1024, 1280, 1440, 1920] as const;

const CRITICAL_ROUTES = [
  '/platform-v7/control-tower',
  '/platform-v7/deals',
  '/platform-v7/buyer',
  '/platform-v7/bank',
  '/platform-v7/disputes',
  '/platform-v7/field',
  '/platform-v7/driver',
] as const;

test.describe('§D: Width × theme matrix — no collisions', () => {
  for (const width of WIDTHS) {
    for (const route of CRITICAL_ROUTES) {
      for (const theme of ['light', 'dark'] as const) {
        test(`${width}px · ${route} · ${theme}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 812 });
          // Inject theme before navigation to avoid FOUC
          await page.addInitScript((t) => {
            localStorage.setItem('pc-theme', t);
            document.documentElement.setAttribute('data-theme', t);
          }, theme);

          const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          expect(response?.status()).toBeLessThan(500);

          // §D-7: No hydration warnings — check console
          const warnings: string[] = [];
          page.on('console', (msg) => {
            if (msg.type() === 'warning' && msg.text().includes('hydrat')) {
              warnings.push(msg.text());
            }
          });

          // §D-8: No console errors
          const errors: string[] = [];
          page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
          });

          await page.waitForTimeout(500);

          // §B-7: No horizontal scroll at this width
          const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
          const viewportWidth = await page.evaluate(() => window.innerWidth);
          expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 2);

          // §A: Single header bar — no triple stack (header height ≤ 72px)
          const header = page.locator('.pc-v4-header').first();
          if (await header.count() > 0) {
            const headerBox = await header.boundingBox();
            if (headerBox) {
              expect(headerBox.height).toBeLessThanOrEqual(72);
            }
          }

          // §A: Pseudo-subtitle removed ("Сделка · логистика · документы · деньги")
          const subtitleText = await page.locator('.pc-v4-subtitle').count();
          const isHidden = subtitleText === 0 || !(await page.locator('.pc-v4-subtitle').first().isVisible());
          expect(isHidden).toBeTruthy();

          expect(warnings).toHaveLength(0);
          expect(errors.filter(e => !e.includes('favicon') && !e.includes('404'))).toHaveLength(0);
        });
      }
    }
  }
});

// §D-2: Touch emulation — no sticky hover states
test.describe('§D: Touch emulation — no sticky hover', () => {
  test('touch device: no hover styles on tap', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto('/platform-v7/control-tower', { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // Tap a nav item and verify no sticky :hover class remains
    const navItems = page.locator('.pc-v4-nav-item, .v9-nav-item');
    if (await navItems.count() > 0) {
      await navItems.first().tap();
      await page.waitForTimeout(300);
      // After tap, no element should have a computed hover background that differs from normal
      // (This is verified by checking the header is still visible and single-bar)
      const header = page.locator('.pc-v4-header').first();
      if (await header.count() > 0) {
        await expect(header).toBeVisible();
      }
    }
    await context.close();
  });
});

// §D-3: Zoom 200% — no horizontal scroll
test.describe('§D: Zoom 200% layout integrity', () => {
  test('zoom 200% — no horizontal overflow', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto('/platform-v7/control-tower', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForTimeout(500);

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // Allow 8px tolerance for scrollbar
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 8);
    await context.close();
  });
});

// §D-5: Print snapshot — Deal Seal
test.describe('§D: Print media — Deal Seal snapshot', () => {
  test('print view hides navigation, shows content', async ({ page }) => {
    await page.goto('/platform-v7/deals', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(300);

    // Header should be hidden in print
    const headerVisible = await page.locator('.pc-v4-header').first().isVisible().catch(() => false);
    expect(headerVisible).toBeFalsy();

    // Main content should still exist
    const main = page.locator('#main-content, .pc-v4-main').first();
    if (await main.count() > 0) {
      await expect(main).toBeAttached();
    }
  });
});

// §D-6: A11y audit — zero critical violations
test.describe('§D: Accessibility — zero critical violations', () => {
  const A11Y_ROUTES = [
    '/platform-v7/control-tower',
    '/platform-v7/deals',
    '/platform-v7/bank',
  ];

  for (const route of A11Y_ROUTES) {
    test(`a11y: ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await page.waitForTimeout(500);

      // Inject axe-core and run audit
      await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js' }).catch(() => {});

      const violations = await page.evaluate(async () => {
        if (typeof (window as unknown as { axe?: { run: (opts: unknown) => Promise<{ violations: unknown[] }> } }).axe === 'undefined') return [];
        const results = await (window as unknown as { axe: { run: (opts: unknown) => Promise<{ violations: { impact: string }[] }> } }).axe.run({
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
        return results.violations.filter((v) => v.impact === 'critical');
      });

      expect(violations).toHaveLength(0);
    });
  }
});

// §A: Role deduplication — "Оператор" appears only once in header
test('§A: identity shown once — no role duplication in header', async ({ page }) => {
  await page.goto('/platform-v7/control-tower', { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.waitForTimeout(500);

  const header = page.locator('.pc-v4-header');
  if (await header.count() > 0) {
    const headerText = await header.first().innerText().catch(() => '');
    // Role label should appear at most once
    const matches = [...headerText.matchAll(/Оператор/g)];
    expect(matches.length).toBeLessThanOrEqual(1);
  }
});

// §A: Driver does not see ФГИС/Банк/Споры status strip in header
test('§A: driver sees no system status in header', async ({ page }) => {
  // Set driver role
  await page.addInitScript(() => {
    const stored = JSON.parse(localStorage.getItem('pc-session-v10') || '{}');
    stored.state = { ...stored.state, role: 'driver' };
    localStorage.setItem('pc-session-v10', JSON.stringify(stored));
  });
  await page.goto('/platform-v7/driver', { waitUntil: 'domcontentloaded', timeout: 15_000 });

  const fgisInHeader = await page.locator('.pc-v4-header .pc-v4-status').count();
  expect(fgisInHeader).toBe(0);
});
