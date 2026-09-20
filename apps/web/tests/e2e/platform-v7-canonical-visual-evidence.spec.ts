import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const targets = [
  { name: '01-home-desktop', path: '/platform-v7?lang=ru', width: 1055, height: 1491, ready: '[data-testid="platform-v7-root-execution-cockpit"]' },
  { name: '02-home-mobile', path: '/platform-v7?lang=ru', width: 430, height: 932, ready: '[data-testid="platform-v7-root-execution-cockpit"]' },
  { name: '03-market-desktop', path: '/platform-v7/market?lang=ru', width: 1448, height: 1086, ready: 'main h1' },
  { name: '06-market-mobile', path: '/platform-v7/market?lang=ru', width: 430, height: 932, ready: 'main h1' },
  { name: '05-deal-desktop', path: '/platform-v7/deal-flow?lang=ru', width: 1448, height: 1086, ready: 'main h1' },
  { name: '06-deal-mobile', path: '/platform-v7/deal-flow?lang=ru', width: 430, height: 932, ready: 'main h1' },
  { name: '07-how-it-works-desktop', path: '/platform-v7/how-it-works?lang=ru', width: 1448, height: 1086, ready: 'main h1' },
  { name: '08-trust-desktop', path: '/platform-v7/trust?lang=ru', width: 1448, height: 1086, ready: 'main h1' },
  { name: '09-gekta-desktop', path: '/platform-v7/ai-in-action?lang=ru', width: 1672, height: 941, ready: 'main h1' },
] as const;

test.describe('canonical visual authority evidence', () => {
  test.setTimeout(180_000);

  for (const target of targets) {
    test(`${target.name} visual evidence`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: target.width, height: target.height });
      const runtimeFailures: string[] = [];
      page.on('pageerror', (error) => runtimeFailures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
      });

      const response = await page.goto(target.path, { waitUntil: 'networkidle' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator(target.ready).first()).toBeVisible();

      const overflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ));
      expect(overflow).toBeLessThanOrEqual(1);

      const serious = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const blocking = serious.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      expect(runtimeFailures).toEqual([]);

      await page.screenshot({
        path: testInfo.outputPath(`${target.name}.png`),
        fullPage: false,
        animations: 'disabled',
      });
    });
  }
});
