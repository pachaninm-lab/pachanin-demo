import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const offerLog = read('apps/web/app/platform-v7/offer-log/page.tsx');
const offerToDeal = read('apps/web/app/platform-v7/offer-to-deal/page.tsx');
const procurement = read('apps/web/app/platform-v7/procurement/page.tsx');
const proposals = read('apps/web/app/platform-v7/proposals/page.tsx');
const auction = read('apps/web/app/platform-v7/auction/page.tsx');
const dealBasis = read('apps/web/app/platform-v7/auction/deal-basis/page.tsx');
const buyerRfq = read('apps/web/app/platform-v7/buyer/rfq/page.tsx');
const scope = read('scripts/check-design-system-v8-pr-scope.mjs');

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 pre-deal compatibility authority', () => {
  it('routes the fixture offer log and hardcoded proposals to the PostgreSQL auction authority', () => {
    for (const legacyPage of [offerLog, proposals]) {
      expect(legacyPage).toContain("import { redirect } from 'next/navigation'");
      expect(legacyPage).toContain("redirect('/platform-v7/auction')");
      expect(legacyPage).not.toMatch(forbiddenPresentation);
    }
    for (const fixture of ['PLATFORM_V7_TRADING_SOURCE', 'OFFER-2403-1', 'Покупатель А', 'Лента событий']) {
      expect(offerLog).not.toContain(fixture);
      expect(proposals).not.toContain(fixture);
    }
    expect(auction).toContain('AuctionPostgresAuthorityWorkspace');
    expect(auction).toContain("stage='overview'");
    expect(auction).toContain('searchParams?.lotId');
  });

  it('routes the fixture offer handoff to the canonical deal-basis stage', () => {
    expect(offerToDeal).toContain("redirect('/platform-v7/auction/deal-basis')");
    for (const fixture of [
      'PLATFORM_V7_TRADING_SOURCE',
      'P7ExecutionActionsPanel',
      'OFFER-2403-A',
      'DL-DRAFT-2403',
      'controlled-pilot',
      'createDraftDealFromOffer',
    ]) {
      expect(offerToDeal).not.toContain(fixture);
    }
    expect(offerToDeal).not.toMatch(forbiddenPresentation);
    expect(dealBasis).toContain('AuctionPostgresAuthorityWorkspace');
    expect(dealBasis).toContain("stage='deal-basis'");
    expect(dealBasis).toContain('searchParams?.lotId');
  });

  it('routes the browser procurement store to the server RFQ authority boundary', () => {
    expect(procurement).toContain("redirect('/platform-v7/buyer/rfq')");
    expect(procurement).not.toContain('BuyerProcurementRuntimeV2');
    expect(procurement).not.toContain('useBuyerRuntimeStore');
    expect(procurement).not.toMatch(forbiddenPresentation);
    expect(buyerRfq).toContain('getAuthProfile');
    expect(buyerRfq).toContain('getDealsCanonical');
    expect(buyerRfq).toContain('RFQ-контур не подтверждён');
    expect(buyerRfq).toContain('does not create a procurement request');
  });

  it('keeps all four compatibility routes inside the exact migration scope', () => {
    for (const file of [
      'apps/web/app/platform-v7/offer-log/page.tsx',
      'apps/web/app/platform-v7/offer-to-deal/page.tsx',
      'apps/web/app/platform-v7/procurement/page.tsx',
      'apps/web/app/platform-v7/proposals/page.tsx',
      'apps/web/tests/unit/platformV7PreDealCompatibility.test.ts',
    ]) {
      expect(scope).toContain(`'${file}'`);
    }
  });
});
