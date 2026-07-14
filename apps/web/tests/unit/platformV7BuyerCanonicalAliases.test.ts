import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const routes = {
  deals: read('apps/web/app/platform-v7/buyer/deals/page.tsx'),
  lots: read('apps/web/app/platform-v7/buyer/lots/page.tsx'),
  offers: read('apps/web/app/platform-v7/buyer/offers/page.tsx'),
  lot: read('apps/web/app/platform-v7/buyer-lot/page.tsx'),
};

describe('platform-v7 buyer canonical aliases', () => {
  it('redirects duplicate buyer surfaces on the server', () => {
    for (const source of Object.values(routes)) {
      expect(source).toContain("import { redirect } from 'next/navigation'");
      expect(source).toContain('redirect(');
      expect(source).not.toContain("'use client'");
      expect(source).not.toContain('style=');
    }
  });

  it('routes deals to the canonical Deal registry', () => {
    expect(routes.deals).toContain('PLATFORM_V7_DEALS_ROUTE');
    expect(routes.deals).toContain('redirect(PLATFORM_V7_DEALS_ROUTE)');
    expect(routes.deals).not.toContain('DL-9106');
    expect(routes.deals).not.toContain('GrainWorkflowPage');
  });

  it('routes lot discovery and the obsolete single-lot surface to the governed auction', () => {
    expect(routes.lots).toContain("redirect('/platform-v7/auction')");
    expect(routes.lot).toContain("redirect('/platform-v7/auction')");
    for (const source of [routes.lots, routes.lot]) {
      expect(source).not.toContain('PLATFORM_V7_TRADING_SOURCE');
      expect(source).not.toContain('P7ExecutionActionsPanel');
      expect(source).not.toContain('OFFER-2403');
      expect(source).not.toContain('GrainWorkflowPage');
    }
  });

  it('routes received offers to the governed RFQ authority boundary', () => {
    expect(routes.offers).toContain('PLATFORM_V7_BUYER_RFQ_ROUTE');
    expect(routes.offers).toContain('redirect(PLATFORM_V7_BUYER_RFQ_ROUTE)');
    expect(routes.offers).not.toContain('DD-OFFER-1');
    expect(routes.offers).not.toContain('offer-log');
    expect(routes.offers).not.toContain('GrainWorkflowPage');
  });
});
