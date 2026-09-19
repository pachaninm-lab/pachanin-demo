import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/seller/rfq/page.tsx');
const offers = read('apps/web/app/platform-v7/seller/offers/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 seller RFQ authority', () => {
  it('uses the governed v8 cockpit and server-confirmed context', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('getAuthProfile');
    expect(page).toContain('getDealsCanonical');
    expect(page).toContain('profile.available');
    expect(page).toContain('profile.orgId');
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('removes fixture matching, browser offers and fictional Deal-draft transitions', () => {
    for (const forbidden of [
      "'use client'",
      'GrainWorkflowPage',
      "value: '85%+'",
      "href: '/platform-v7/deal-drafts/DD-OFFER-1'",
      'P7ExecutionActionsPanel',
      'PLATFORM_V7_TRADING_SOURCE',
      'demoOffers',
      "mode: 'controlled-pilot'",
      "entityId: 'OFFER-SELLER-2403'",
    ]) {
      expect(page).not.toContain(forbidden);
      expect(offers).not.toContain(forbidden);
    }
  });

  it('states the seller RFQ authority boundary in RU EN and ZH', () => {
    expect(page).toContain('Браузер не рассчитывает совпадение');
    expect(page).toContain('The browser does not calculate matching');
    expect(page).toContain('浏览器不会计算匹配');
    expect(page).toContain('seller membership');
    expect(page).toContain('optimistic concurrency');
    expect(page).toContain('audit и outbox');
  });

  it('routes legacy seller offers into the governed RFQ boundary', () => {
    expect(offers).toContain("import { redirect } from 'next/navigation'");
    expect(offers).toContain("redirect('/platform-v7/seller/rfq')");
    expect(offers).not.toContain('style=');
  });

  it('registers the RFQ route in minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/seller/rfq'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/seller/rfq/page.tsx');
  });
});
