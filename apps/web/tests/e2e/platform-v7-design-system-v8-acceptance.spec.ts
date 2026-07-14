import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

type Role = 'operator' | 'buyer' | 'seller' | 'logistics' | 'driver' | 'surveyor' | 'elevator' | 'lab' | 'bank' | 'arbitrator' | 'compliance' | 'executive';

const ACTIVE_ROLE_KEY = 'pc-v7-active-role';
const ROLE_PASSWORD = process.env.PC_CABINET_ROLE_PASSWORD || '';
const ROLE_ROUTES: ReadonlyArray<{ role: Role; route: string }> = [
  { role: 'operator', route: '/platform-v7/control-tower' },
  { role: 'buyer', route: '/platform-v7/buyer' },
  { role: 'seller', route: '/platform-v7/seller' },
  { role: 'logistics', route: '/platform-v7/logistics' },
  { role: 'driver', route: '/platform-v7/driver' },
  { role: 'surveyor', route: '/platform-v7/surveyor' },
  { role: 'elevator', route: '/platform-v7/elevator' },
  { role: 'lab', route: '/platform-v7/lab' },
  { role: 'bank', route: '/platform-v7/bank' },
  { role: 'arbitrator', route: '/platform-v7/arbitrator' },
  { role: 'compliance', route: '/platform-v7/compliance' },
  { role: 'executive', route: '/platform-v7/executive' },
];
const MOBILE_PROJECTS = new Set(['chromium-android', 'webkit-iphone']);
const DESKTOP_PROJECTS = new Set(['chromium-desktop', 'webkit-desktop']);

type BrowserSignals = { hydration: string[] };

async function installDeterministicApi(page: Page): Promise<void> {
  await page.route('**/api/proxy/deals/accessible**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [], nextCursor: null, total: 0 }),
  }));
  await page.route('**/api/proxy/notifications**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }));
}

async function installBrowserSignals(page: Page): Promise<BrowserSignals> {
  const signals: BrowserSignals = { hydration: [] };
  const hydrationPattern = /hydration|hydrating|text content did not match|server html/i;
  page.on('console', (message) => {
    const text = message.text();
    if ((message.type() === 'error' || message.type() === 'warning') && hydrationPattern.test(text)) signals.hydration.push(text);
  });
  page.on('pageerror', (error) => {
    if (hydrationPattern.test(error.message)) signals.hydration.push(error.message);
  });
  await page.addInitScript(() => {
    const state = window as Window & { __dsV8Cls?: number };
    state.__dsV8Cls = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput && typeof shift.value === 'number') state.__dsV8Cls = (state.__dsV8Cls || 0) + shift.value;
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // LayoutShift is not exposed by every WebKit build.
    }
  });
  return signals;
}

async function loginAs(page: Page, role: Role): Promise<void> {
  expect(ROLE_PASSWORD, 'PC_CABINET_ROLE_PASSWORD must be configured').not.toBe('');
  await page.addInitScript(({ key, value }) => window.sessionStorage.setItem(key, value), { key: ACTIVE_ROLE_KEY, value: role });
  const response = await page.request.post('/api/auth/login', {
    data: { email: `${role}.test@procent-agro.test`, password: ROLE_PASSWORD },
  });
  const body = await response.text();
  expect(response.ok(), `controlled login failed for ${role}: ${response.status()} ${body}`).toBe(true);
}

async function assertShellIntegrity(page: Page, route: string, testInfo: TestInfo, signals: BrowserSignals): Promise<void> {
  const response = await page.goto(`${route}?lang=ru`, { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?|$)`));

  const root = page.locator('.pc-shell-root-v4');
  const header = root.locator('header').first();
  await expect(root).toBeVisible();
  await expect(header).toBeVisible();
  await expect(page.locator('#main-content')).toBeVisible();
  expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');

  await page.waitForTimeout(700);
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    cls: (window as Window & { __dsV8Cls?: number }).__dsV8Cls || 0,
  }));
  expect(dimensions.scrollWidth, `${route} overflows in ${testInfo.project.name}`).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
  expect(dimensions.cls, `${route} CLS in ${testInfo.project.name}`).toBeLessThanOrEqual(0.1);
  expect(signals.hydration, `${route} hydration mismatch`).toEqual([]);

  if (MOBILE_PROJECTS.has(testInfo.project.name)) {
    const bottomNavigation = page.locator("nav.pc-v4-bottomnav[aria-label='Навигация кабинета']");
    await expect(bottomNavigation).toBeVisible();
    const links = bottomNavigation.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
    for (let index = 0; index < count; index += 1) {
      const box = await links.nth(index).boundingBox();
      expect(box).not.toBeNull();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
    }
  }
}

test.describe('Design System v8 protected role shell matrix', () => {
  for (const { role, route } of ROLE_ROUTES) {
    test(`${role} · fixed shell · mobile navigation · hydration · CLS`, async ({ page }, testInfo) => {
      await installDeterministicApi(page);
      const signals = await installBrowserSignals(page);
      await loginAs(page, role);
      await assertShellIntegrity(page, route, testInfo, signals);
    });
  }
});

test.describe('Design System v8 keyboard and accessibility acceptance', () => {
  test('keyboard opens the canonical drawer with visible focus', async ({ page }, testInfo) => {
    test.skip(!DESKTOP_PROJECTS.has(testInfo.project.name), 'desktop keyboard contract');
    await installDeterministicApi(page);
    await installBrowserSignals(page);
    await loginAs(page, 'operator');
    await page.goto('/platform-v7/control-tower?lang=ru', { waitUntil: 'domcontentloaded' });
    const menuButton = page.getByRole('button', { name: 'Открыть меню' });
    await menuButton.focus();
    expect(await menuButton.evaluate((element) => document.activeElement === element)).toBe(true);
    const focusStyle = await menuButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe('none');
    expect(focusStyle.outlineWidth).not.toBe('0px');
    await menuButton.press('Enter');
    const drawer = page.locator('aside[data-open="true"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('navigation')).toBeVisible();
  });

  test('Axe has no serious or critical violations on a governed protected surface', async ({ page }) => {
    await installDeterministicApi(page);
    await installBrowserSignals(page);
    await loginAs(page, 'operator');
    await page.goto('/platform-v7/notifications?lang=ru', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Уведомления', level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = result.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});

test.describe('Design System v8 RU EN ZH acceptance', () => {
  const languages = [
    { code: 'ru', html: 'ru', title: 'Уведомления', control: 'Только непрочитанные', absent: 'Unread only' },
    { code: 'en', html: 'en', title: 'Notifications', control: 'Unread only', absent: 'Только непрочитанные' },
    { code: 'zh', html: 'zh-CN', title: '通知', control: '仅显示未读', absent: 'Только непрочитанные' },
  ] as const;
  for (const language of languages) {
    test(`${language.code} has localized controls and document language`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'deterministic locale browser');
      await installDeterministicApi(page);
      await installBrowserSignals(page);
      await loginAs(page, 'operator');
      await page.goto(`/platform-v7/notifications?lang=${language.code}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: language.title, level: 1 })).toBeVisible();
      await expect(page.getByText(language.control, { exact: true })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', language.html);
      await expect(page.getByText(language.absent, { exact: true })).toHaveCount(0);
    });
  }
});

test.describe('Design System v8 media and routing boundaries', () => {
  test('forced colors preserves shell visibility and layout', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Chromium forced-colors emulation');
    await page.emulateMedia({ forcedColors: 'active' });
    await installDeterministicApi(page);
    await installBrowserSignals(page);
    await loginAs(page, 'operator');
    await page.goto('/platform-v7/notifications?lang=ru', { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
    const header = page.locator('.pc-shell-root-v4 header').first();
    await expect(header).toBeVisible();
    expect(await header.evaluate((element) => getComputedStyle(element).borderBottomStyle)).not.toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
  });

  test('reduced motion disables the drawer transition', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Chromium reduced-motion emulation');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installDeterministicApi(page);
    await installBrowserSignals(page);
    await loginAs(page, 'operator');
    await page.goto('/platform-v7/control-tower?lang=ru', { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const duration = await page.locator('.pc-shell-root-v4 aside').first().evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(['0s', '0ms']).toContain(duration);
  });

  test('unknown Platform V7 route is a 404 before auth shell', async ({ page }) => {
    const response = await page.goto('/platform-v7/definitely-not-a-real-route', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
    await expect(page.locator('.pc-shell-root-v4')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/platform-v7\/login/);
  });
});
