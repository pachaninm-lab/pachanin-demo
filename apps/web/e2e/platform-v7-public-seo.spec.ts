import { expect, test } from '@playwright/test';

function normalizedPath(value: string) {
  const url = new URL(value);
  return `${url.pathname}${url.search}`;
}

test.describe('platform-v7 public SEO response contract', () => {
  test('Russian landing exposes canonical metadata and all language alternates', async ({ page }) => {
    await page.goto('/platform-v7');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page).toHaveTitle(/Прозрачная Цена — цифровой контур исполнения зерновой сделки/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /зерновой сделки/i);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(normalizedPath(String(canonical))).toBe('/platform-v7');

    const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((links) =>
      links.map((link) => ({
        lang: link.getAttribute('hreflang'),
        href: link.getAttribute('href'),
      })),
    );
    expect(alternates.map((entry) => entry.lang)).toEqual(expect.arrayContaining(['x-default', 'ru', 'en', 'zh']));
    expect(alternates.find((entry) => entry.lang === 'en')?.href).toContain('/platform-v7?lang=en');
    expect(alternates.find((entry) => entry.lang === 'zh')?.href).toContain('/platform-v7?lang=zh');

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Прозрачная Цена/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
    await expect(page.locator('script[type="application/ld+json"]')).toContainText('WebApplication');
  });

  for (const locale of ['en', 'zh'] as const) {
    test(`${locale} landing is server-localized before hydration`, async ({ page }) => {
      await page.goto(`/platform-v7?lang=${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(normalizedPath(String(canonical))).toBe(`/platform-v7?lang=${locale}`);
      await expect(page.locator('meta[name="description"]')).not.toHaveAttribute('content', '');
      await expect(page.locator('body')).not.toContainText(/MISSING_MESSAGE|IntlError|undefined/i);
    });
  }

  for (const route of [
    '/platform-v7/login',
    '/platform-v7/forgot-password',
    '/platform-v7/reset-password',
  ] as const) {
    test(`${route} is self-canonical and noindex`, async ({ page }) => {
      await page.goto(route);
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(String(robots)).toMatch(/noindex/i);
      expect(String(robots)).toMatch(/nofollow/i);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(normalizedPath(String(canonical))).toBe(route);
    });
  }

  test('manifest is linked and returns a scoped web application manifest', async ({ page, request }) => {
    await page.goto('/platform-v7');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toContain('/platform-v7/manifest.webmanifest');

    const response = await request.get(String(manifestHref));
    expect(response.ok()).toBe(true);
    const manifest = await response.json() as { start_url?: string; scope?: string; theme_color?: string };
    expect(manifest.start_url).toBe('/platform-v7');
    expect(manifest.scope).toBe('/platform-v7');
    expect(manifest.theme_color).toBe('#087a3b');
  });

  test('robots keeps the public landing crawlable', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain('Sitemap:');
    expect(body).not.toMatch(/^Disallow:\s*\/platform-v7\/?\s*$/im);
  });

  test('sitemap includes the landing and excludes authentication surfaces', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toMatch(/<loc>[^<]*\/platform-v7<\/loc>/);
    expect(body).not.toContain('/platform-v7/login');
    expect(body).not.toContain('/platform-v7/forgot-password');
    expect(body).not.toContain('/platform-v7/reset-password');
    expect(body).not.toContain('/platform-v7/mfa');
  });
});
