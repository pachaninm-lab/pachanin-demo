import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const middlewareSource = fs.readFileSync(path.join(process.cwd(), 'apps/web/middleware.ts'), 'utf8');
const clientGateSource = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicEntryCleanup.tsx'), 'utf8');

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
  it('keeps server and client exact public route allowlists aligned', () => {
    for (const route of publicExactRoutes) {
      expect(middlewareSource, `middleware should allow ${route}`).toContain(`'${route}'`);
      expect(clientGateSource, `client gate should allow ${route}`).toContain(`'${route}'`);
    }
  });

  it('keeps server and client public prefix allowlists aligned', () => {
    for (const route of publicPrefixRoutes) {
      expect(middlewareSource, `middleware should allow prefix ${route}`).toContain(`'${route}'`);
      expect(clientGateSource, `client gate should allow prefix ${route}`).toContain(`'${route}'`);
    }
  });

  it('does not mark operational routes as public', () => {
    const privateRoutes = [
      '/platform-v7/deals',
      '/platform-v7/lots',
      '/platform-v7/bank',
      '/platform-v7/bank/clean',
      '/platform-v7/logistics',
      '/platform-v7/control-tower',
      '/platform-v7/seller',
      '/platform-v7/buyer',
      '/platform-v7/driver/field',
      '/platform-v7/elevator',
      '/platform-v7/lab',
      '/platform-v7/disputes',
    ];

    const publicBlocks = [
      middlewareSource.slice(middlewareSource.indexOf('const PLATFORM_V7_PUBLIC_EXACT'), middlewareSource.indexOf('function isPrivateMode')),
      clientGateSource.slice(clientGateSource.indexOf('const PUBLIC_PATHS'), clientGateSource.indexOf('const cleanupCss')),
    ].join('\n');

    for (const route of privateRoutes) {
      expect(publicBlocks, `${route} must stay private`).not.toContain(`'${route}'`);
    }
  });
});
