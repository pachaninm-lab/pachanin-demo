import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const routes = {
  deals: read('apps/web/app/platform-v7/seller/deals/page.tsx'),
  lots: read('apps/web/app/platform-v7/seller/lots/page.tsx'),
  newLot: read('apps/web/app/platform-v7/seller/lots/new/page.tsx'),
  matches: read('apps/web/app/platform-v7/seller/matches/page.tsx'),
};

describe('platform-v7 seller canonical aliases', () => {
  it('keeps every compatibility surface redirect-only and server-rendered', () => {
    for (const source of Object.values(routes)) {
      expect(source).toContain("import { redirect } from 'next/navigation'");
      expect(source).toContain('redirect(');
      expect(source).not.toContain("'use client'");
      expect(source).not.toContain('style=');
      expect(source).not.toContain('GrainWorkflowPage');
      expect(source).not.toContain('GrainExecutionPage');
    }
  });

  it('routes seller deals to the canonical participant-scoped registry', () => {
    expect(routes.deals).toContain('PLATFORM_V7_DEALS_ROUTE');
    expect(routes.deals).toContain('redirect(PLATFORM_V7_DEALS_ROUTE)');
    expect(routes.deals).not.toContain('DL-9106');
  });

  it('routes lot discovery and creation to the governed auction contour', () => {
    expect(routes.lots).toContain("redirect('/platform-v7/auction')");
    expect(routes.newLot).toContain("redirect('/platform-v7/auction/import')");
    expect(routes.lots).not.toContain('PLATFORM_V7_TRADING_SOURCE');
    expect(routes.newLot).not.toContain('SANDBOX_GRAIN_PARTIES');
  });

  it('routes fictional matching to the seller RFQ boundary', () => {
    expect(routes.matches).toContain("redirect('/platform-v7/seller/rfq')");
    expect(routes.matches).not.toContain('92%');
    expect(routes.matches).not.toContain('стандартный');
  });
});
