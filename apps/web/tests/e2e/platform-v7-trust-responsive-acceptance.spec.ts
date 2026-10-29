import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { width: 320, height: 800, name: '320x800' },
  { width: 375, height: 812, name: '375x812' },
  { width: 390, height: 844, name: '390x844' },
  { width: 430, height: 932, name: '430x932' },
  { width: 1440, height: 900, name: '1440x900' },
] as const;

const locales = ['ru', 'en', 'zh'] as const;

type Locale = (typeof locales)[number];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectVisibleTargetsAtLeast(page: Page, selector: string, minimum: number) {
  const boxes = await page.locator(selector).evaluateAll((nodes) => nodes
    .filter((node) => {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    })
    .map((node) => {
      const box = (node as HTMLElement).getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));

  expect(boxes.length).toBeGreaterThan(0);
  expect(boxes.every((box) => box.width >= minimum && box.height >= minimum), JSON.stringify(boxes, null, 2)).toBe(true);
}

function forbiddenMaturityPhrases(locale: Locale) {
  if (locale === 'ru') return ['неподтверждённый статус', 'готовность платформы', 'подключённый провайдер'];
  if (locale === 'en') return ['unconfirmed status', 'platform readiness', 'live bank', 'connected provider'];
  return ['未确认状态', '平台就绪', '在线银行', '已连接服务商'];
}

test.describe('Platform V7 Trust exact responsive acceptance', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} keeps Trust scannable in RU EN ZH`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);

      for (const locale of locales) {
        const runtimeFailures: string[] = [];
        const pageErrorHandler = (error: Error) => runtimeFailures.push(error.message);
        const consoleHandler = (message: { type(): string; text(): string }) => {
          if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
        };
        page.on('pageerror', pageErrorHandler);
        page.on('console', consoleHandler);

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(`/platform-v7/trust?lang=${locale}`, { waitUntil: 'load' });
        expect(response?.ok()).toBe(true);
        await expect(page.locator('.pc-trust-page')).toBeVisible();

        const header = page.locator('.pc-site-header');
        await expect(header).toBeVisible();
        await expect(header).toHaveAttribute('data-public-site-header', 'canonical');
        const headerHeight = await header.evaluate((node) => node.getBoundingClientRect().height);
        expect(headerHeight).toBeGreaterThanOrEqual(60);
        expect(headerHeight).toBeLessThanOrEqual(72);
        await expect(header.locator('.pc-site-brand-text strong')).toBeVisible();
        await expect(header.locator('.pc-site-brand-text strong')).toHaveText('Прозрачная Цена');
        await expectVisibleTargetsAtLeast(page, '.pc-site-brand', 44);

        const registerHref = `/platform-v7/register?lang=${locale}`;
        const loginHref = `/platform-v7/login?lang=${locale}`;
        await expect(header.locator('.pc-trust-header-register')).toHaveAttribute('href', registerHref);
        const registration = page.locator('main .pc-trust-primary');
        await expect(registration).toHaveCount(2);
        for (const action of await registration.all()) {
          await expect(action).toBeVisible();
          await expect(action).toHaveAttribute('href', registerHref);
        }
        const contact = page.locator('.pc-trust-contact-link');
        await expect(contact).toBeVisible();
        await expect(contact).toHaveAttribute('href', `/platform-v7/contact?lang=${locale}`);

        if (viewport.width <= 430) {
          await expect(header.locator('.pc-trust-header-login')).toBeHidden();
          await expectVisibleTargetsAtLeast(page, '.pc-site-mobile-menu > summary, .pc-site-locale-switch, .pc-trust-header-register', 44);

          const menuSummary = header.locator('.pc-site-mobile-menu > summary');
          await menuSummary.click();
          const mobileLogin = header.locator('.pc-site-mobile-nav .pc-trust-nav-login');
          await expect(mobileLogin).toBeVisible();
          await expect(mobileLogin).toHaveAttribute('href', loginHref);
          await expectVisibleTargetsAtLeast(page, '.pc-site-mobile-nav .pc-trust-nav-login', 44);
          await menuSummary.click();
        } else {
          const desktopLogin = header.locator('.pc-trust-header-login');
          await expect(desktopLogin).toBeVisible();
          await expect(desktopLogin).toHaveAttribute('href', loginHref);
          await expectVisibleTargetsAtLeast(page, '.pc-site-locale-switch, .pc-trust-header-login, .pc-trust-header-register', 44);
        }

        await expectVisibleTargetsAtLeast(page, 'main .pc-trust-primary, main .pc-trust-secondary, .pc-trust-bottom-nav a', 44);
        await expectNoHorizontalOverflow(page);

        const h1 = page.locator('#pc-trust-title');
        await expect(h1).toBeVisible();
        const h1Size = await h1.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize));
        expect(h1Size).toBeGreaterThanOrEqual(34);

        const mainText = (await page.locator('main').innerText()).toLowerCase();
        for (const phrase of forbiddenMaturityPhrases(locale)) expect(mainText).not.toContain(phrase.toLowerCase());
        expect(runtimeFailures).toEqual([]);

        await page.screenshot({
          path: testInfo.outputPath(`platform-v7-trust-${locale}-${viewport.name}.png`),
          fullPage: true,
          animations: 'disabled',
        });

        page.off('pageerror', pageErrorHandler);
        page.off('console', consoleHandler);
      }
    });
  }
});