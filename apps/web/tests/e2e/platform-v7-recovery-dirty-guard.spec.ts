import { expect, test } from '@playwright/test';

test.describe('UX-05 recovery unsaved-entry guard', () => {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    for (const width of [320, 390, 1280] as const) {
      test(`reset form retains passwords when navigation is cancelled: ${locale} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        const url = `/platform-v7/forgot-password?lang=${locale}&token=acceptance-token`;
        const response = await page.goto(url, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await expect(page.locator('header[data-public-site-header="canonical"]')).toHaveCount(1);
        await expect(page.locator('nav.pc-cp-bottom-nav')).toHaveCount(1);
        const next = locale === 'ru' ? 'en' : locale === 'en' ? 'zh' : 'ru';
        async function localeChoice() {
          if (width <= 1100) {
            await page.locator('.pc-site-mobile-menu > summary').click();
            return page.locator(`.pc-site-mobile-nav a.pc-site-locale-option[href*="lang=${next}"]`).first();
          }
          return page.locator(`.pc-site-actions > .pc-site-locale-cluster a.pc-site-locale-option[href*="lang=${next}"]`).first();
        }
        const fields = page.locator('form.pc-recovery-card input[autocomplete="new-password"]');
        await expect(fields).toHaveCount(2);
        await fields.nth(0).fill('AcceptanceOnly#123');
        await fields.nth(1).fill('AcceptanceOnly#123');

        let prompts = 0;
        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('confirm');
          prompts += 1;
          await dialog.dismiss();
        });
        await (await localeChoice()).click();
        expect(prompts).toBe(1);
        await expect(page).toHaveURL(new RegExp(`lang=${locale}&token=acceptance-token`));
        await expect(fields.nth(0)).toHaveValue('AcceptanceOnly#123');
        await expect(fields.nth(1)).toHaveValue('AcceptanceOnly#123');

        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('confirm');
          prompts += 1;
          await dialog.dismiss();
        });
        await page.locator('.pc-site-header .pc-site-action').click();
        expect(prompts).toBe(2);
        await expect(fields.nth(0)).toHaveValue('AcceptanceOnly#123');

        const overflow = await page.evaluate(() => Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ));
        expect(overflow).toBeLessThanOrEqual(1);

        page.once('dialog', (dialog) => dialog.accept());
        await (await localeChoice()).click();
        await expect(page).toHaveURL(new RegExp(`lang=${next}&token=acceptance-token`));
        await expect(fields.nth(0)).toHaveValue('');
      });
    }
  }

  test('recovery request email is retained on cancelled locale navigation', async ({ page }) => {
    await page.goto('/platform-v7/forgot-password?lang=ru', { waitUntil: 'networkidle' });
    const email = page.locator('form.pc-recovery-card input[type="email"]');
    await email.fill('acceptance@example.invalid');
    const otherLocale = page.locator('.pc-site-header a.pc-site-locale-option[href*="lang=en"]').first();
    await expect(otherLocale).toBeVisible();
    page.once('dialog', (dialog) => dialog.dismiss());
    await otherLocale.click();
    await expect(email).toHaveValue('acceptance@example.invalid');
    await expect(page).toHaveURL(/forgot-password\?lang=ru/);
  });
});
