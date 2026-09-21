import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { width: 320, height: 700, name: '320x700' },
  { width: 375, height: 812, name: '375x812' },
  { width: 390, height: 844, name: '390x844' },
  { width: 430, height: 932, name: '430x932' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1280, height: 900, name: '1280x900' },
  { width: 1440, height: 900, name: '1440x900' },
] as const;

const locales = ['ru', 'en', 'zh'] as const;
const canonicalRoles = [
  'Продавец',
  'Покупатель',
  'Логистика',
  'Водитель',
  'Элеватор',
  'Лаборатория',
  'Сюрвейер',
  'Банк',
  'Сотрудник подключённой организации',
] as const;
const canonicalStages = [
  'Лот',
  'Торги',
  'Обязательства',
  'Доставка',
  'Приёмка / качество',
  'Документы / расчёт',
  'Закрытие / спор',
] as const;

const linkedPages = [
  { name: 'market', path: '/platform-v7/market', ready: 'main h1' },
  { name: 'how-it-works', path: '/platform-v7/how-it-works', ready: 'main h1' },
  { name: 'capabilities', path: '/platform-v7/capabilities', ready: 'main h1' },
  { name: 'gekta', path: '/platform-v7/gekta', ready: 'main h1' },
  { name: 'trust', path: '/platform-v7/trust', ready: 'main h1' },
  { name: 'about', path: '/platform-v7/about', ready: 'main h1' },
  { name: 'contact', path: '/platform-v7/contact', ready: '[data-testid="platform-v7-question-form-page"]' },
  { name: 'login', path: '/platform-v7/login', ready: 'main h1' },
  { name: 'register', path: '/platform-v7/register', ready: 'main h1' },
  { name: 'deal-flow', path: '/platform-v7/deal-flow', ready: 'main h1' },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectVisibleTargetsAtLeast(page: Page, selector: string, minimum = 44) {
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

async function expectCanonicalHeader(page: Page, width: number) {
  const header = page.locator('.pc-site-header[data-public-site-header="canonical"]');
  await expect(header).toBeVisible();
  await expect(header.locator('.pc-site-brand-mark[data-brand-mark="transparent-price-canonical"]')).toBeVisible();
  await expect(header.locator('.pc-site-brand-text strong')).toHaveText('Прозрачная Цена');
  const headerBox = await header.boundingBox();
  expect(headerBox?.height ?? 0).toBeGreaterThanOrEqual(60);
  expect(headerBox?.height ?? 100).toBeLessThanOrEqual(72);

  if (width <= 900) {
    await expect(header.locator('.pc-site-mobile-menu')).toBeVisible();
    await expectVisibleTargetsAtLeast(page, '.pc-site-mobile-menu > summary, .pc-site-locale-switch', 44);
  } else {
    await expect(header.locator('.pc-site-nav')).toBeVisible();
    const primaryNavLinks = header.locator('.pc-site-nav > a:not(.pc-cp-mobile-only)');
    await expect(primaryNavLinks).toHaveCount(5);
    await expect(header.locator('.pc-gekta-chat-button--header')).toBeVisible();
    await expectVisibleTargetsAtLeast(page, '.pc-site-locale-switch, .pc-gekta-chat-button--header, .entry-login, .pc-v6-header-cta', 44);
  }
}

async function expectHomeContract(page: Page, width: number) {
  await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
  await expect(page.locator('.pc-cp-hero h1')).toBeVisible();
  await expect(page.locator('#market')).toBeVisible();
  await expect(page.locator('#deal-path')).toBeVisible();
  await expect(page.locator('#participants')).toBeVisible();
  await expect(page.locator('#live')).toBeVisible();
  await expect(page.locator('#trust')).toBeVisible();
  await expect(page.locator('#gekta')).toBeVisible();
  await expect(page.locator('#capabilities')).toBeVisible();

  const roleSurface = page.locator('#participants .pc-cp-role-tags');
  for (const role of canonicalRoles) await expect(roleSurface.getByText(role, { exact: true })).toBeVisible();
  for (const stage of canonicalStages) await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();

  await expect(page.locator('#trust .pc-cp-trust-card')).toHaveCount(4);
  await expect(page.locator('#capabilities .pc-cp-capability')).toHaveCount(12);

  const marketStates = page.locator('#market [data-testid="canonical-market-preview"], #market [data-market-state]');
  await expect(marketStates.first()).toBeVisible();

  if (width <= 760) {
    await expect(page.locator('.pc-cp-bottom-nav')).toBeVisible();
    await expect(page.locator('.pc-cp-bottom-nav a')).toHaveCount(5);
    await expectVisibleTargetsAtLeast(page, '.pc-cp-bottom-nav a', 44);
  } else {
    await expect(page.locator('.pc-cp-bottom-nav')).toBeHidden();
  }
}

async function expectLocaleContinuity(page: Page, locale: (typeof locales)[number]) {
  expect(new URL(page.url()).searchParams.get('lang')).toBe(locale);
  const localized = page.locator(`a[href*="lang=${locale}"]`);
  expect(await localized.count()).toBeGreaterThan(0);
}

test.describe('Platform V7 canonical production responsive acceptance', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} keeps canonical public home usable and overflow-free`, async ({ page }, testInfo) => {
      const runtimeFailures: string[] = [];
      page.on('pageerror', (error) => runtimeFailures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);

      await expectCanonicalHeader(page, viewport.width);
      await expectHomeContract(page, viewport.width);
      await expectNoHorizontalOverflow(page);
      expect(runtimeFailures).toEqual([]);

      await page.screenshot({
        path: testInfo.outputPath(`canonical-home-${viewport.name}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});

test.describe('Platform V7 canonical linked pages RU EN ZH', () => {
  for (const locale of locales) {
    for (const target of linkedPages) {
      test(`${target.name} ${locale} renders without authority or layout drift`, async ({ page }, testInfo) => {
        test.setTimeout(90_000);
        const width = target.name === 'market' || target.name === 'deal-flow' ? 430 : 390;
        const height = target.name === 'market' || target.name === 'deal-flow' ? 932 : 844;
        await page.setViewportSize({ width, height });

        const response = await page.goto(`${target.path}?lang=${locale}`, { waitUntil: 'load' });
        expect(response?.ok()).toBe(true);
        await expect(page.locator(target.ready).first()).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocaleContinuity(page, locale);

        if (!['login', 'register'].includes(target.name)) await expectCanonicalHeader(page, width);
        if (target.name === 'market') {
          await expect(page.locator('[data-testid="canonical-market-results"], [data-market-state]').first()).toBeVisible();
        }
        if (target.name === 'how-it-works') {
          await expect(page.locator('.pc-cp-process-card')).toHaveCount(7);
        }
        if (target.name === 'trust') {
          await expect(page.locator('.pc-cp-trust-pillar')).toHaveCount(4);
        }
        if (target.name === 'gekta') {
          await expect(page.locator('.pc-cp-gekta-workspace')).toBeVisible();
        }
        if (target.name === 'contact') {
          await expect(page.locator('form[action="/api/platform-v7/inquiries"]')).toBeVisible();
        }
        if (target.name === 'login') {
          const body = (await page.locator('body').innerText()).toLowerCase();
          expect(body).not.toContain('выберите роль');
          expect(body).not.toContain('select role');
        }

        await page.screenshot({
          path: testInfo.outputPath(`canonical-${target.name}-${locale}-mobile.png`),
          fullPage: true,
          animations: 'disabled',
        });
      });
    }
  }
});

test('protected Deal route remains server-gated without a verified cabinet', async ({ page }) => {
  const response = await page.goto('/platform-v7/deals/nonexistent/clean', { waitUntil: 'load' });
  expect(response?.status()).toBeLessThan(500);
  expect(new URL(page.url()).pathname).toBe('/platform-v7/login');
});
