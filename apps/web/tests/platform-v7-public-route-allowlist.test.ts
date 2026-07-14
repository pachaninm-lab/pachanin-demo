import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const middlewareSource = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');
const layoutSource = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');

const publicExactRoutes = [
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
] as const;

const publicPrefixRoutes = ['/platform-v7/role-preview'] as const;

describe('platform-v7 public route allowlist logic', () => {
  it('keeps middleware and server layout exact public allowlists aligned', () => {
    for (const route of publicExactRoutes) {
      expect(middlewareSource, `middleware should allow ${route}`).toContain(`'${route}'`);
      expect(layoutSource, `server layout should allow ${route}`).toContain(`'${route}'`);
    }
  });

  it('keeps middleware and server layout public prefix allowlists aligned', () => {
    for (const route of publicPrefixRoutes) {
      expect(middlewareSource, `middleware should allow prefix ${route}`).toContain(`'${route}'`);
      expect(layoutSource, `server layout should allow prefix ${route}`).toContain(`'${route}'`);
    }
  });

  it('does not mark operational routes as public', () => {
    const privateRoutes = [
      '/platform-v7/deals', '/platform-v7/lots', '/platform-v7/bank', '/platform-v7/bank/clean',
      '/platform-v7/logistics', '/platform-v7/control-tower', '/platform-v7/seller', '/platform-v7/buyer',
      '/platform-v7/driver/field', '/platform-v7/elevator', '/platform-v7/lab', '/platform-v7/disputes',
    ];

    const middlewareBlock = middlewareSource.slice(
      middlewareSource.indexOf('const PLATFORM_V7_PUBLIC_EXACT'),
      middlewareSource.indexOf('function isPrivateMode'),
    );
    const layoutBlock = layoutSource.slice(
      layoutSource.indexOf('const PUBLIC_EXACT_PATHS'),
      layoutSource.indexOf('type ShellLocale'),
    );
    const publicBlocks = `${middlewareBlock}\n${layoutBlock}`;

    for (const route of privateRoutes) {
      expect(publicBlocks, `${route} must stay private`).not.toContain(`'${route}'`);
    }
  });

  it('has no client-side public-route cleanup authority', () => {
    expect(layoutSource).not.toContain('PublicEntryCleanup');
    expect(layoutSource).not.toContain('PlatformV7TemplateGuards');
    expect(layoutSource).not.toContain('usePathname');
  });
});
