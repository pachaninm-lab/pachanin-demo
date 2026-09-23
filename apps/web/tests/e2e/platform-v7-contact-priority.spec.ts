import { expect, test } from '@playwright/test';

test.describe('UX-24 contact actions precede explanations', () => {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    for (const width of [390, 1280] as const) {
      test(locale + ' ' + width + 'px: phone and inquiry precede overview cards', async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        const response = await page.goto('/platform-v7/contact?lang=' + locale, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        const layout = page.locator('.p7-contact-layout');
        await expect(layout).toBeVisible();
        const order = await layout.locator(':scope > *').evaluateAll((nodes) =>
          nodes.map((node) => node.className));
        expect(order).toEqual(['p7-contact-copy', 'p7-contact-form-card', 'p7-contact-cards']);
        const phone = layout.locator('a[href="tel:+79162778989"]');
        const form = layout.locator('form.p7-contact-form');
        const submit = form.locator('button[type="submit"]');
        await expect(phone).toBeVisible();
        await expect(form).toBeVisible();
        await expect(submit).toBeVisible();
        await expect(layout.locator('.p7-contact-info-card')).toHaveCount(3);
        const fullSelectedLabel = await form.locator('select[name="type"]').evaluate((select: HTMLSelectElement) => {
          const style = getComputedStyle(select);
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          context.font = style.font;
          return select.getBoundingClientRect().width >=
            context.measureText(select.selectedOptions[0]?.textContent ?? '').width + 55;
        });
        expect(fullSelectedLabel, locale + ' ' + width + ': selected inquiry type is not clipped').toBe(true);
        const boxes = await Promise.all([
          layout.locator('.p7-contact-copy').boundingBox(),
          layout.locator('.p7-contact-form-card').boundingBox(),
          layout.locator('.p7-contact-cards').boundingBox(),
        ]);
        const [intro, inquiry, cards] = boxes;
        expect(intro && inquiry && cards).toBeTruthy();
        if (width === 390) {
          expect(intro!.y + intro!.height).toBeLessThanOrEqual(inquiry!.y + 1);
          expect(inquiry!.y + inquiry!.height).toBeLessThanOrEqual(cards!.y + 1);
        } else {
          expect(intro!.x + intro!.width).toBeLessThanOrEqual(inquiry!.x + 1);
          expect(intro!.y + intro!.height).toBeLessThanOrEqual(cards!.y + 1);
        }
        for (const target of [phone, submit]) {
          await target.scrollIntoViewIfNeeded();
          const reachable = await target.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const hit = document.elementFromPoint(x, y);
            return rect.width >= 44 && rect.height >= 44 && hit !== null &&
              (node === hit || node.contains(hit));
          });
          expect(reachable).toBe(true);
        }
        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ));
        expect(overflow).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: testInfo.outputPath('contact-priority-' + (process.env.GITHUB_SHA || 'local') + '-' + locale + '-' + width + '.png'),
          fullPage: true, animations: 'disabled',
        });
      });
    }
  }
});
