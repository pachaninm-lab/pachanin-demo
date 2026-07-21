import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signCabinetSession } from '../../lib/platform-v7/verified-session';

type CabinetRole =
  | 'operator'
  | 'buyer'
  | 'seller'
  | 'logistics'
  | 'driver'
  | 'surveyor'
  | 'elevator'
  | 'lab'
  | 'bank'
  | 'arbitrator'
  | 'compliance'
  | 'executive';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const ACCEPTANCE_SECRET = process.env.PC_ACCEPTANCE_JWT_SECRET || 'pc-design-system-v8-acceptance-secret-2026';
const ROLE_ROUTES: ReadonlyArray<readonly [CabinetRole, string]> = [
  ['operator', '/platform-v7/operator'],
  ['buyer', '/platform-v7/buyer'],
  ['seller', '/platform-v7/seller'],
  ['logistics', '/platform-v7/logistics'],
  ['driver', '/platform-v7/driver'],
  ['surveyor', '/platform-v7/surveyor'],
  ['elevator', '/platform-v7/elevator'],
  ['lab', '/platform-v7/lab'],
  ['bank', '/platform-v7/bank'],
  ['arbitrator', '/platform-v7/arbitrator'],
  ['compliance', '/platform-v7/compliance'],
  ['executive', '/platform-v7/executive'],
];

function installLayoutShiftObserver(page: Page) {
  return page.addInitScript(() => {
    (window as Window & { __pcV8LayoutShift?: number }).__pcV8LayoutShift = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
          if (!entry.hadRecentInput) {
            const target = window as Window & { __pcV8LayoutShift?: number };
            target.__pcV8LayoutShift = (target.__pcV8LayoutShift || 0) + (entry.value || 0);
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // LayoutShift is unavailable in some engines; the value remains zero.
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

async function setCabinetRole(page: Page, role: CabinetRole) {
  const token = await signCabinetSession(role, ACCEPTANCE_SECRET, {
    nowSeconds: Math.floor(Date.now() / 1000),
    ttlSeconds: 60 * 60,
  });
  expect(token, `signed cabinet token for ${role}`).toBeTruthy();

  // Destroy the previous cabinet document before rotating the signed HttpOnly
  // session. Otherwise its background RSC prefetch can continue under the next
  // role and WebKit correctly reports the server's RBAC denial as a page error.
  await page.goto('about:blank', { waitUntil: 'load' });
  await page.context().clearCookies();
  await page.context().addCookies([{
    name: 'pc_v7_cabinet',
    value: token as string,
    url: BASE_URL,
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  }]);
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

async function expectKeyboardEntry(page: Page) {
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const allowed = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return {
        tag: element?.tagName || '',
        name: element?.getAttribute('aria-label') || element?.getAttribute('title') || element?.textContent?.trim() || '',
      };
    });
    if (allowed.includes(active.tag) && active.name.length > 0) return;
  }

  const finalTag = await page.evaluate(() => document.activeElement?.tagName || '');
  expect(allowed, `keyboard focus remained on ${finalTag || 'unknown element'}`).toContain(finalTag);
}

async function expectLayoutShiftWithinBudget(page: Page) {
  await page.waitForTimeout(250);
  const cls = await page.evaluate(() => (window as Window & { __pcV8LayoutShift?: number }).__pcV8LayoutShift || 0);
  expect(cls).toBeLessThanOrEqual(0.1);
}

test.describe('Design System v8 final browser acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await installLayoutShiftObserver(page);
  });

  test('public entry is stable, localized, keyboard-usable and accessible', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);

    for (const locale of ['ru', 'en', 'zh'] as const) {
      const response = await page.goto(`/platform-v7?lang=${locale}`, { waitUntil: 'load' });
      expect(response?.ok(), `${locale} public response`).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
      await expectNoHorizontalOverflow(page);
      await expectKeyboardEntry(page);
    }

    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    await expectNoSeriousAxeViolations(page);
    await expectLayoutShiftWithinBudget(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('login preserves accessibility, focus and responsive layout', async ({ page }) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const response = await page.goto('/platform-v7/login?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectKeyboardEntry(page);
    await expectNoSeriousAxeViolations(page);
    await expectLayoutShiftWithinBudget(page);
    expect(runtimeFailures).toEqual([]);
  });

  test('forced colors and reduced motion remain explicit and usable', async ({ page }, testInfo) => {
    const chromiumProject = /chromium/i.test(testInfo.project.name);
    await page.emulateMedia(chromiumProject
      ? { forcedColors: 'active', reducedMotion: 'reduce' }
      : { reducedMotion: 'reduce' });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
    const media = await page.evaluate(() => ({
      forced: matchMedia('(forced-colors: active)').matches,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }));
    expect(media.reduced).toBe(true);
    if (chromiumProject) expect(media.forced).toBe(true);
    await expectNoHorizontalOverflow(page);
    await expectKeyboardEntry(page);
  });

  test('all twelve server-verified role shells keep fixed header and cabinet navigation', async ({ page }, testInfo) => {
    const runtimeFailures = collectRuntimeFailures(page);
    const mobileProject = /android|iphone/i.test(testInfo.project.name);

    for (const [role, route] of ROLE_ROUTES) {
      await setCabinetRole(page, role);
      const response = await page.goto(route, { waitUntil: 'load' });
      expect(response?.ok(), `${role} response`).toBe(true);
      await expect(page).not.toHaveURL(/\/platform-v7\/login/);

      const shell = page.locator('.pc-shell-root-v4');
      const header = shell.locator(':scope > header');
      const main = page.locator('main#main-content');
      const bottomNav = page.getByRole('navigation', { name: 'Основные действия кабинета' });

      await expect(shell).toBeVisible();
      await expect(header).toBeVisible();
      await expect(main).toBeVisible();
      await expect(bottomNav).toBeVisible();

      const navCount = await bottomNav.locator('a').count();
      expect(navCount, `${role} bottom navigation items`).toBeGreaterThan(0);
      expect(navCount, `${role} bottom navigation cap`).toBeLessThanOrEqual(5);

      const geometry = await page.evaluate(() => {
        const headerElement = document.querySelector('.pc-shell-root-v4 > header') as HTMLElement | null;
        const mainElement = document.querySelector('main#main-content') as HTMLElement | null;
        const navElement = document.querySelector('nav[aria-label="Основные действия кабинета"]') as HTMLElement | null;
        if (!headerElement || !mainElement || !navElement) return null;
        const headerBox = headerElement.getBoundingClientRect();
        const mainBox = mainElement.getBoundingClientRect();
        const navBox = navElement.getBoundingClientRect();
        const mainStyle = getComputedStyle(mainElement);
        const mainPaddingTop = Number.parseFloat(mainStyle.paddingTop) || 0;
        return {
          headerPosition: getComputedStyle(headerElement).position,
          headerTop: headerBox.top,
          headerBottom: headerBox.bottom,
          mainContentTop: mainBox.top + mainPaddingTop,
          navPosition: getComputedStyle(navElement).position,
          navBottom: window.innerHeight - navBox.bottom,
        };
      });

      expect(geometry, `${role} shell geometry`).not.toBeNull();
      expect(geometry?.headerPosition).toBe('fixed');
      expect(Math.abs(geometry?.headerTop || 0)).toBeLessThanOrEqual(1);
      expect(geometry?.mainContentTop || 0).toBeGreaterThanOrEqual((geometry?.headerBottom || 0) - 2);
      expect(geometry?.navPosition).toBe('fixed');
      expect(Math.abs(geometry?.navBottom || 0)).toBeLessThanOrEqual(1);
      await expectNoHorizontalOverflow(page);

      if (mobileProject) {
        const targets = await bottomNav.locator('a').evaluateAll((elements) => elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { width: box.width, height: box.height };
        }));
        expect(targets.every((target) => target.width >= 42 && target.height >= 42), `${role} mobile target size`).toBe(true);
      }

      if (role === 'operator') {
        await expectNoSeriousAxeViolations(page);
        await expectLayoutShiftWithinBudget(page);
      }
    }

    expect(runtimeFailures).toEqual([]);
  });
});
