import { PLATFORM_V7_TRADING_SOURCE, tradingSummary } from '@/lib/platform-v7/trading-source-of-truth';

describe('platform-v7 trading source of truth', () => {
  it('keeps accepted offer aligned with visible offers', () => {
    const { acceptedOffer, offers } = PLATFORM_V7_TRADING_SOURCE;
    expect(offers.some((offer) => offer.buyerAlias === acceptedOffer.buyerAlias && offer.priceRubPerTon === acceptedOffer.priceRubPerTon && offer.volumeTons === acceptedOffer.volumeTons)).toBe(true);
  });

  it('does not allow accepted volume to exceed available lot volume', () => {
    const { lot, acceptedOffer } = PLATFORM_V7_TRADING_SOURCE;
    expect(acceptedOffer.volumeTons).toBeLessThanOrEqual(lot.availableVolumeTons);
  });

  it('keeps summary values derived from the same source', () => {
    const summary = tradingSummary();
    expect(summary.lotId).toBe(PLATFORM_V7_TRADING_SOURCE.lot.id);
    expect(summary.fgisPartyId).toBe(PLATFORM_V7_TRADING_SOURCE.lot.fgisPartyId);
    expect(summary.acceptedPrice).toBe(PLATFORM_V7_TRADING_SOURCE.acceptedOffer.priceRubPerTon);
    expect(summary.acceptedVolume).toBe(PLATFORM_V7_TRADING_SOURCE.acceptedOffer.volumeTons);
    expect(summary.offersCount).toBe(PLATFORM_V7_TRADING_SOURCE.offers.length);
  });
});
