import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type PublicSeoAuthority = {
  schemaVersion: number;
  routes: Array<{ path: string; priority: number; changeFrequency: string }>;
};

const root = process.cwd();
const authority = JSON.parse(
  fs.readFileSync(path.join(root, 'apps/web/lib/platform-v7/public-seo-routes.json'), 'utf8'),
) as PublicSeoAuthority;
const paths = authority.routes.map((route) => route.path);
const middleware = fs.readFileSync(path.join(root, 'apps/web/middleware.ts'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'apps/web/app/sitemap.ts'), 'utf8');
const robots = fs.readFileSync(path.join(root, 'apps/web/app/robots.ts'), 'utf8');
const indexNow = fs.readFileSync(path.join(root, 'scripts/indexnow-submit.mjs'), 'utf8');

describe('platform-v7 public SEO route authority', () => {
  it('is unique, route-backed and contains the mandatory public landings', () => {
    expect(authority.schemaVersion).toBe(1);
    expect(new Set(paths).size).toBe(paths.length);

    for (const requiredPath of [
      '/platform-v7',
      '/platform-v7/how-it-works',
      '/platform-v7/secure-grain-deal',
      '/platform-v7/fgis-zerno',
    ]) {
      expect(paths).toContain(requiredPath);
    }

    for (const route of authority.routes) {
      const pagePath = route.path === '/platform-v7'
        ? path.join(root, 'apps/web/app/platform-v7/page.tsx')
        : path.join(root, 'apps/web/app', route.path.replace(/^\//, ''), 'page.tsx');
      expect(fs.existsSync(pagePath), `SEO route must resolve to a page: ${route.path}`).toBe(true);
      expect(route.priority).toBeGreaterThan(0);
      expect(route.priority).toBeLessThanOrEqual(1);
    }
  });

  it('drives middleware, sitemap, robots and IndexNow from the same registry', () => {
    expect(middleware).toContain("publicSeoRouteRegistry from '@/lib/platform-v7/public-seo-routes.json'");
    expect(middleware).toContain('PLATFORM_V7_INDEXABLE_EXACT.has(p)');
    expect(sitemap).toContain('publicSeoRouteRegistry.routes.map');
    expect(robots).toContain('publicSeoRouteRegistry.routes.map');
    expect(indexNow).toContain('public-seo-routes.json');
    expect(indexNow).toContain('publicSeoAuthority.routes.map');
  });

  it('never publishes protected or synthetic transaction routes', () => {
    for (const protectedPrefix of [
      '/platform-v7/buyer',
      '/platform-v7/seller',
      '/platform-v7/bank',
      '/platform-v7/deals',
      '/platform-v7/lots',
      '/platform-v7/counterparty',
      '/platform-v7/control-tower',
      '/platform-v7/disputes',
      '/platform-v7/connectors',
    ]) {
      expect(
        paths.some((candidate) => candidate === protectedPrefix || candidate.startsWith(`${protectedPrefix}/`)),
      ).toBe(false);
    }
    expect(sitemap).not.toContain('KNOWN_DEAL_IDS');
    expect(sitemap).not.toContain('KNOWN_LOT_IDS');
    expect(sitemap).not.toContain('KNOWN_INNS');
  });
});
