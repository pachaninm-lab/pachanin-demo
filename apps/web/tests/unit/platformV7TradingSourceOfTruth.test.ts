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

  it('best price equals max offer price', () => {
    const { offers } = PLATFORM_V7_TRADING_SOURCE;
    const summary = tradingSummary();
    const expectedBest = Math.max(...offers.map((o) => o.priceRubPerTon));
    expect(summary.bestPrice).toBe(expectedBest);
  });

  it('accepted offer price equals one of offers', () => {
    const { acceptedOffer, offers } = PLATFORM_V7_TRADING_SOURCE;
    expect(offers.some((o) => o.priceRubPerTon === acceptedOffer.priceRubPerTon)).toBe(true);
  });

  it('accepted offer volume equals one of offers', () => {
    const { acceptedOffer, offers } = PLATFORM_V7_TRADING_SOURCE;
    expect(offers.some((o) => o.volumeTons === acceptedOffer.volumeTons)).toBe(true);
  });

  it('accepted offer volume does not exceed available lot volume', () => {
    const { lot, acceptedOffer } = PLATFORM_V7_TRADING_SOURCE;
    expect(acceptedOffer.volumeTons).toBeLessThanOrEqual(lot.availableVolumeTons);
  });

  it('min volume is not greater than accepted offer volume', () => {
    const { lot, acceptedOffer } = PLATFORM_V7_TRADING_SOURCE;
    expect(lot.minVolumeTons).toBeLessThanOrEqual(acceptedOffer.volumeTons);
  });

  it('seller price is less than or equal to best price', () => {
    const { lot, offers } = PLATFORM_V7_TRADING_SOURCE;
    const bestPrice = Math.max(...offers.map((o) => o.priceRubPerTon));
    expect(lot.sellerPriceRubPerTon).toBeLessThanOrEqual(bestPrice);
  });

  it('every offer has required fields with valid values', () => {
    const { offers } = PLATFORM_V7_TRADING_SOURCE;
    for (const offer of offers) {
      expect(offer.buyerAlias).toBeTruthy();
      expect(offer.buyerRating).toBeTruthy();
      expect(offer.priceRubPerTon).toBeGreaterThan(0);
      expect(offer.volumeTons).toBeGreaterThan(0);
      expect(offer.basis).toBeTruthy();
      expect(offer.removalTerm).toBeTruthy();
      expect(offer.paymentReadiness).toBeTruthy();
      expect(offer.risk).toBeTruthy();
      expect(offer.status).toBeTruthy();
    }
  });

  it('no offer volume exceeds available lot volume', () => {
    const { lot, offers } = PLATFORM_V7_TRADING_SOURCE;
    for (const offer of offers) {
      expect(offer.volumeTons).toBeLessThanOrEqual(lot.availableVolumeTons);
    }
  });

  it('tradingSummary derives values only from PLATFORM_V7_TRADING_SOURCE', () => {
    const summary = tradingSummary();
    expect(summary.lotId).toBe(PLATFORM_V7_TRADING_SOURCE.lot.id);
    expect(summary.fgisPartyId).toBe(PLATFORM_V7_TRADING_SOURCE.lot.fgisPartyId);
    expect(summary.acceptedPrice).toBe(PLATFORM_V7_TRADING_SOURCE.acceptedOffer.priceRubPerTon);
    expect(summary.acceptedVolume).toBe(PLATFORM_V7_TRADING_SOURCE.acceptedOffer.volumeTons);
    expect(summary.availableVolume).toBe(PLATFORM_V7_TRADING_SOURCE.lot.availableVolumeTons);
    expect(summary.sellerPrice).toBe(PLATFORM_V7_TRADING_SOURCE.lot.sellerPriceRubPerTon);
    expect(summary.offersCount).toBe(PLATFORM_V7_TRADING_SOURCE.offers.length);
    expect(summary.bestPrice).toBe(Math.max(...PLATFORM_V7_TRADING_SOURCE.offers.map((o) => o.priceRubPerTon)));
  });
});
