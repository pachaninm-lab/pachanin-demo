import { expect, test } from '@playwright/test';

const crops = ['wheat','barley','corn','sunflower','soybean','rapeseed','rye','oats'] as const;
const labels = {
  ru: ['Пшеница','Ячмень','Кукуруза','Подсолнечник','Соя','Рапс','Рожь','Овёс'],
  en: ['Wheat','Barley','Corn','Sunflower','Soybean','Rapeseed','Rye','Oats'],
  zh: ['小麦','大麦','玉米','向日葵','大豆','油菜籽','黑麦','燕麦'],
} as const;

test.describe('UX-18 public crop photograph consistency', () => {
  for (const width of [390, 1280] as const) {
    test(`eight pinned crop photographs remain local and geometrically consistent at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const response = await page.goto('/platform-v7/market?lang=ru', { waitUntil: 'networkidle' });
      expect(response?.status()).toBe(200);

      const cards = page.locator('[data-testid="canonical-crop-catalogue"] [data-crop-category]');
      await expect(cards).toHaveCount(8);

      for (let index = 0; index < crops.length; index += 1) {
        const crop = crops[index]!;
        const card = cards.nth(index);
        await card.scrollIntoViewIfNeeded();
        await expect(card).toHaveAttribute('data-crop-category', crop);

        const image = card.locator('img.pc-cp-crop-photo');
        await expect(image).toBeVisible();
        await expect(image).toHaveAttribute('alt', labels.ru[index]!);

        const state = await image.evaluate((node) => {
          const img = node as HTMLImageElement;
          const rect = img.getBoundingClientRect();
          const style = getComputedStyle(img);
          return {
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            currentSrc: img.currentSrc,
            src: img.getAttribute('src'),
            srcset: img.getAttribute('srcset'),
            width: rect.width,
            height: rect.height,
            objectFit: style.objectFit,
            objectPosition: style.objectPosition,
            filter: style.filter,
          };
        });

        expect(state.complete, crop).toBe(true);
        expect(state.naturalWidth, crop).toBeGreaterThan(0);
        expect(state.naturalHeight, crop).toBeGreaterThan(0);
        // Chromium may downsample naturalWidth under device pressure; inspect the encoded resource.
        const encodedSize = await image.evaluate(async (node) => {
          const response = await fetch((node as HTMLImageElement).currentSrc);
          if (!response.ok) throw new Error(`Crop image returned ${response.status}`);
          const bitmap = await createImageBitmap(await response.blob());
          const size = { width: bitmap.width, height: bitmap.height };
          bitmap.close();
          return size;
        });
        expect([320, 640, 960], crop).toContain(encodedSize.width);
        expect(encodedSize.height, crop).toBe(encodedSize.width * 5 / 8);
        expect(state.currentSrc, crop).toContain(`/platform-v7/crops/${crop}-`);
        expect(state.currentSrc, crop).toMatch(/\.webp(?:$|\?)/u);
        expect(state.src, crop).toBe(`/platform-v7/crops/${crop}-640.webp`);
        expect(state.srcset, crop).toContain(`/platform-v7/crops/${crop}-320.webp 320w`);
        expect(state.srcset, crop).toContain(`/platform-v7/crops/${crop}-960.webp 960w`);
        expect(state.objectFit, crop).toBe('cover');
        expect(state.filter, crop).toBe('none');
        expect(state.width / state.height, crop).toBeCloseTo(8 / 5, 2);
        expect(state.width, crop).toBeGreaterThan(0);
        expect(state.height, crop).toBeGreaterThan(0);

        await card.screenshot({
          path: testInfo.outputPath(`crop-${width}-${String(index + 1).padStart(2,'0')}-${crop}.png`),
          animations: 'disabled',
        });
      }

      const positions = await cards.locator('img.pc-cp-crop-photo').evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node as HTMLElement).objectPosition),
      );
      expect(new Set(positions).size).toBe(1);

      const externalImageRequests = await page.evaluate(() =>
        Array.from(document.images)
          .map((img) => img.currentSrc)
          .filter((src) => src && !src.startsWith(location.origin) && src.includes('/crops/')),
      );
      expect(externalImageRequests).toEqual([]);

      const overflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ));
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
