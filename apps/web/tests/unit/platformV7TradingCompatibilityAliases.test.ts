import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const procurement = read('apps/web/app/platform-v7/procurement/page.tsx');
const proposals = read('apps/web/app/platform-v7/proposals/page.tsx');
const offerToDeal = read('apps/web/app/platform-v7/offer-to-deal/page.tsx');
const auctionDetail = read('apps/web/app/platform-v7/auctions/[id]/page.tsx');

describe('platform-v7 canonical trading compatibility aliases', () => {
  it('routes procurement to the governed buyer RFQ authority', () => {
    expect(procurement).toContain("redirect('/platform-v7/buyer/rfq')");
    expect(procurement).not.toContain('BuyerProcurementRuntimeV2');
    expect(procurement).not.toContain('useBuyerRuntimeStore');
  });

  it('routes fixture proposals to canonical auction bids', () => {
    expect(proposals).toContain("redirect('/platform-v7/auction/bids')");
    for (const fixture of ['OFFER-2403-1', 'OFFER-2403-2', 'OFFER-2403-3', 'Покупатель А', 'Покупатель Б']) {
      expect(proposals).not.toContain(fixture);
    }
    expect(proposals).not.toContain('CockpitHero');
    expect(proposals).not.toContain('style=');
  });

  it('routes the browser-owned offer bridge to canonical Deal basis', () => {
    expect(offerToDeal).toContain("redirect('/platform-v7/auction/deal-basis')");
    for (const forbidden of [
      'P7ExecutionActionsPanel',
      'PLATFORM_V7_TRADING_SOURCE',
      'OFFER-2403-A',
      'DL-DRAFT-2403',
      'RESERVE-DL-DRAFT-2403',
      'controlled-pilot',
      'createDraftDealFromOffer',
      'requestMoneyReserve',
    ]) expect(offerToDeal).not.toContain(forbidden);
  });

  it('preserves the dynamic auction identifier in the canonical workspace', () => {
    expect(auctionDetail).toContain('encodeURIComponent(params.id)');
    expect(auctionDetail).toContain('/platform-v7/auction?lotId=');
    expect(auctionDetail).not.toContain('AuctionDetailPage');
  });
});
