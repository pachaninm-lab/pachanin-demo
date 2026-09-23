import { expect, test } from '@playwright/test';

const locales = {
  ru: { crop: 'Культура', jump: 'К предложениям' },
  en: { crop: 'Crop', jump: 'Go to offers' },
  zh: { crop: '作物', jump: '查看供求信息' },
} as const;

test.describe('public market result navigation UX-10 UX-17', () => {
  test.setTimeout(150_000);

  for (const [lang, copy] of Object.entries(locales)) {
    for (const width of [390, 1280]) {
      test(`${lang} at ${width}px: category, Apply, chip, Reset, Back and Forward`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 850 });
        const response = await page.goto(`/platform-v7/market?lang=${lang}`, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        const offers = page.locator('#offers');
        const cropCards = page.locator('[data-testid="canonical-crop-catalogue"] [data-crop-category]');
        await expect(cropCards).toHaveCount(8);
        await expect(page.locator('#offers select[name="crop"] option')).toHaveCount(9);

        await page.getByRole('link', { name: copy.jump }).click();
        await expect(page).toHaveURL((url) => url.hash === '#offers');
        await expect(offers).toBeInViewport();
        await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('offers');

        await page.locator('[data-crop-category="wheat"] h3 a').click();
        await expect(page).toHaveURL((url) => url.searchParams.get('crop') === 'wheat' && url.hash === '#offers');
        await expect(offers.locator('select[name="crop"]')).toHaveValue('wheat');
        await expect(offers).toBeInViewport();

        await offers.locator('input[name="q"]').fill('grain');
        await offers.locator('input[name="region"]').fill('Tambov');
        await offers.locator('select[name="sort"]').selectOption('price-asc');
        await offers.locator('button[type="submit"]').click();
        await expect(page).toHaveURL((url) => url.searchParams.get('lang') === lang &&
          url.searchParams.get('crop') === 'wheat' && url.searchParams.get('q') === 'grain' &&
          url.searchParams.get('region') === 'Tambov' && url.searchParams.get('sort') === 'price-asc' &&
          url.hash === '#offers');
        await expect(offers).toBeInViewport();
        const applied = page.url();

        await offers.locator('.pc-cp-market-active-filters>a').filter({ hasText: copy.crop }).click();
        await expect(page).toHaveURL((url) => !url.searchParams.has('crop') &&
          url.searchParams.get('q') === 'grain' && url.searchParams.get('region') === 'Tambov' &&
          url.searchParams.get('sort') === 'price-asc' && url.hash === '#offers');
        const removed = page.url();
        await expect(offers).toBeInViewport();

        await offers.locator('.pc-cp-market-filter-actions a').click();
        await expect(page).toHaveURL((url) => url.searchParams.get('lang') === lang &&
          !url.searchParams.has('crop') && !url.searchParams.has('q') &&
          !url.searchParams.has('region') && !url.searchParams.has('sort') && url.hash === '#offers');
        await expect(offers).toBeInViewport();

        await page.goBack();
        await expect(page).toHaveURL(removed);
        await expect(offers.locator('input[name="q"]')).toHaveValue('grain');
        await page.goBack();
        await expect(page).toHaveURL(applied);
        await expect(offers.locator('select[name="crop"]')).toHaveValue('wheat');
        await page.goForward();
        await expect(page).toHaveURL(removed);
        await expect(offers).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: testInfo.outputPath(`market-results-${lang}-${width}.png`), animations: 'disabled' });
      });
    }
  }
});
