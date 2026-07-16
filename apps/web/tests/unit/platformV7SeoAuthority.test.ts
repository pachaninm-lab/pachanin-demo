import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_PRIVATE_ROBOTS_PREFIXES,
  PLATFORM_V7_PUBLIC_SEO_PATHS,
  PLATFORM_V7_PUBLIC_SEO_ROUTES,
} from '../../lib/platform-v7/public-seo-routes';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 canonical SEO authority', () => {
  it('keeps the required public pages indexable and protected workspaces excluded', () => {
    expect(PLATFORM_V7_PUBLIC_SEO_PATHS).toContain('/platform-v7');
    expect(PLATFORM_V7_PUBLIC_SEO_PATHS).toContain('/platform-v7/secure-grain-deal');
    expect(PLATFORM_V7_PUBLIC_SEO_PATHS).toContain('/platform-v7/fgis-zerno');
    expect(new Set(PLATFORM_V7_PUBLIC_SEO_PATHS).size).toBe(PLATFORM_V7_PUBLIC_SEO_PATHS.length);

    for (const privatePrefix of PLATFORM_V7_PRIVATE_ROBOTS_PREFIXES) {
      expect(PLATFORM_V7_PUBLIC_SEO_PATHS.some((route) => route === privatePrefix || route.startsWith(`${privatePrefix}/`))).toBe(false);
    }
  });

  it('uses the same authority in middleware, robots, sitemap and live health', () => {
    for (const file of [
      'apps/web/middleware.ts',
      'apps/web/app/robots.ts',
      'apps/web/app/sitemap.ts',
      'apps/web/app/platform-v7/role-preview/seo-health/route.ts',
    ]) {
      expect(read(file), `${file} must import canonical SEO authority`).toContain('public-seo-routes');
    }

    const middleware = read('apps/web/middleware.ts');
    expect(middleware).toContain('PLATFORM_V7_INDEXABLE_EXACT.has(p)');
    expect(middleware).toContain('!privateModeEnabled');
  });

  it('publishes only public SEO routes in sitemap and verifies the exact deployed commit', () => {
    const sitemap = read('apps/web/app/sitemap.ts');
    expect(sitemap).toContain('PLATFORM_V7_PUBLIC_SEO_ROUTES.map');
    expect(sitemap).not.toContain('KNOWN_DEAL_IDS');
    expect(sitemap).not.toContain('KNOWN_LOT_IDS');
    expect(sitemap).not.toContain('KNOWN_INNS');

    for (const route of PLATFORM_V7_PUBLIC_SEO_ROUTES) {
      expect(route.path.startsWith('/platform-v7')).toBe(true);
      expect(route.priority).toBeGreaterThan(0);
      expect(route.priority).toBeLessThanOrEqual(1);
    }

    const health = read('apps/web/app/platform-v7/role-preview/seo-health/route.ts');
    const workflow = read('.github/workflows/seo-live-smoke.yml');
    const netlify = read('netlify.toml');
    expect(health).toContain('NEXT_PUBLIC_BUILD_COMMIT_REF');
    expect(workflow).toContain('EXPECTED_SHA="$GITHUB_SHA"');
    expect(workflow).toContain('observed_sha');
    expect(netlify).toContain('NEXT_PUBLIC_BUILD_COMMIT_REF=${COMMIT_REF:-unknown}');
  });
});
