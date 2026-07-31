import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { width: 390, height: 844, name: '390x844' },
  { width: 430, height: 932, name: '430x932' },
] as const;

const currentPublicAnchorIds = [
  'difference',
  'functions',
  'deal-path',
  'live',
  'participants',
  'tai',
  'faq',
  'connect-organization',
] as const;

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

  expect(boxes.length, `${selector} should expose visible controls`).toBeGreaterThan(0);
  expect(boxes.every((box) => box.width >= minimum && box.height >= minimum), JSON.stringify(boxes, null, 2)).toBe(true);
}

async function expectCurrentAnchorsBelowStickyHeader(page: Page) {
  const selector = currentPublicAnchorIds.map((id) => `#${id}`).join(', ');
  const headerHeight = await page.locator('.pc-site-header').evaluate((node) => node.getBoundingClientRect().height);
  const anchors = await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => {
    const element = node as HTMLElement;
    return {
      id: element.id,
      scrollMarginTop: Number.parseFloat(window.getComputedStyle(element).scrollMarginTop),
    };
  }));

  expect(anchors.map((anchor) => anchor.id).sort()).toEqual([...currentPublicAnchorIds].sort());
  expect(
    anchors.every((anchor) => Number.isFinite(anchor.scrollMarginTop) && anchor.scrollMarginTop >= headerHeight),
    JSON.stringify(anchors, null, 2),
  ).toBe(true);

  await page.evaluate(() => {
    history.replaceState(null, '', `${location.pathname}${location.search}#live`);
    document.getElementById('live')?.scrollIntoView();
  });
  await page.waitForTimeout(100);

  const livePosition = await page.evaluate(() => {
    const header = document.querySelector('.pc-site-header');
    const target = document.getElementById('live');
    return {
      headerBottom: header?.getBoundingClientRect().bottom ?? 0,
      targetTop: target?.getBoundingClientRect().top ?? -1,
    };
  });
  expect(livePosition.targetTop, 'live anchor must not be hidden under the sticky header').toBeGreaterThanOrEqual(livePosition.headerBottom - 1);
}

test.describe('Platform V7 exact production mobile acceptance', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} keeps the public Deal workspace compact, accessible and anchored`, async ({ page }, testInfo) => {
      const runtimeFailures: string[] = [];
      page.on('pageerror', (error) => runtimeFailures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('[data-testid="platform-v7-root-execution-cockpit"]')).toBeVisible();
      await expect(page.locator('#connect-organization form')).toHaveAttribute('data-ready', 'true');

      const header = page.locator('.pc-site-header');
      await expect(header).toBeVisible();
      const headerHeight = await header.evaluate((node) => node.getBoundingClientRect().height);
      expect(headerHeight).toBeGreaterThanOrEqual(47);
      expect(headerHeight).toBeLessThanOrEqual(49);

      await expectVisibleTargetsAtLeast(page, '.pc-site-mobile-menu > summary, .pc-site-locale-switch, .entry-login', 44);
      await expectNoHorizontalOverflow(page);

      const headings = await page.locator('.pc-v6-section-head h2, .pc-v6-final h2, #connect-organization h2').evaluateAll((nodes) => nodes
        .filter((node) => {
          const box = (node as HTMLElement).getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        })
        .map((node) => {
          const style = window.getComputedStyle(node);
          const fontSize = Number.parseFloat(style.fontSize);
          const lineHeight = Number.parseFloat(style.lineHeight);
          return { fontSize, ratio: lineHeight / fontSize };
        }));
      expect(headings.length).toBeGreaterThan(0);
      expect(headings.every((heading) => heading.fontSize >= 32 && heading.fontSize <= 38), JSON.stringify(headings, null, 2)).toBe(true);
      expect(headings.every((heading) => heading.ratio <= 1.11), JSON.stringify(headings, null, 2)).toBe(true);

      await expect(page.getByRole('region', { name: 'Рабочее пространство Сделки' })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Этапы исполнения Сделки' })).toBeVisible();
      await expect(page.getByRole('tablist', { name: 'Что видит каждый участник' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Банк' })).toBeVisible();
      await expect(page.locator('#maturity, #integrations, #role-entry')).toHaveCount(0);

      const formControlHeights = await page.locator('#connect-organization input:not([type="checkbox"]):not([tabindex="-1"]):visible, #connect-organization select:visible, #connect-organization button:visible').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).getBoundingClientRect().height));
      expect(formControlHeights.length).toBeGreaterThan(0);
      expect(formControlHeights.every((height) => height >= 52 && height <= 56), JSON.stringify(formControlHeights, null, 2)).toBe(true);

      await expectCurrentAnchorsBelowStickyHeader(page);
      await expectNoHorizontalOverflow(page);
      expect(runtimeFailures).toEqual([]);

      await page.evaluate(() => {
        history.replaceState(null, '', `${location.pathname}${location.search}`);
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: testInfo.outputPath(`platform-v7-production-${viewport.name}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
