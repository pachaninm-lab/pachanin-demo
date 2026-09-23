import { expect, test } from '@playwright/test';

const cases = [
  {
    locale: 'ru',
    title: 'Документы связывают условия, исполнение и расчёт',
    layer: 'Документы партии и ЭДО',
    aboutLink: 'Документы',
  },
  {
    locale: 'en',
    title: 'Documents connect terms, execution and settlement',
    layer: 'Lot documents and electronic exchange',
    aboutLink: 'Documents',
  },
  {
    locale: 'zh',
    title: '文件连接约定条件、履约和结算',
    layer: '批次文件与电子文件交换',
    aboutLink: '文件',
  },
] as const;

test.describe('T19 docs SSR/hydration identity', () => {
  for (const item of cases) {
    test(`${item.locale}: SSR and hydrated DOM agree with client navigation`, async ({ page, baseURL }, testInfo) => {
      const route = `/platform-v7/docs?lang=${item.locale}`;
      const absolute = new URL(route, baseURL!).toString();

      const ssr = await page.request.get(absolute, { headers: { 'Cache-Control': 'no-cache' } });
      expect(ssr.status()).toBe(200);
      const html = await ssr.text();
      expect(html).toContain('data-testid="platform-v7-public-docs-page"');
      expect(html).toContain(item.title);
      expect(html).toContain(item.layer);

      const direct = await page.goto(route, { waitUntil: 'networkidle' });
      expect(direct?.status()).toBe(200);
      const docs = page.getByTestId('platform-v7-public-docs-page');
      await expect(docs).toBeVisible();
      await expect(docs.locator('h1')).toHaveText(item.title);
      await expect(docs.getByRole('heading', { name: item.layer, exact: true })).toBeVisible();

      // Compare each meaningful element separately: innerText joins adjacent links differently
      // after a client transition even when both links and their copy are identical.
      const semanticText = (root: typeof docs) => root.locator('h1, h2, h3, p, a, li').evaluateAll((elements) =>
        elements.map((element) => element.textContent?.replace(/\\s+/gu, ' ').trim()).filter(Boolean),
      );
      const directText = await semanticText(docs);
      expect(directText).toContain(item.title);
      expect(directText).toContain(item.layer);

      await page.goto(`/platform-v7/about?lang=${item.locale}`, { waitUntil: 'networkidle' });
      const docsLink = page.locator(`a[href="/platform-v7/docs?lang=${item.locale}"]`).filter({ hasText: item.aboutLink }).first();
      await expect(docsLink).toBeVisible();
      await docsLink.click();
      await expect(page).toHaveURL(new RegExp(`/platform-v7/docs\\?lang=${item.locale}$`));
      const clientDocs = page.getByTestId('platform-v7-public-docs-page');
      await expect(clientDocs).toBeVisible();
      await expect(clientDocs.locator('h1')).toHaveText(item.title);
      const clientText = await semanticText(clientDocs);
      expect(clientText).toBe(directText);

      const overflow = await page.evaluate(() => Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ));
      expect(overflow).toBeLessThanOrEqual(1);

      const sha = process.env.GITHUB_SHA || testInfo.project.name || 'local';
      await page.screenshot({
        path: testInfo.outputPath(`docs-chain-${sha}-${item.locale}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
