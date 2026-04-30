import {
  FGIS_MATURITY,
  SANDBOX_FGIS_PARTIES,
  SANDBOX_LOT_PASSPORTS,
  SANDBOX_MARKET_LOTS,
  SANDBOX_OFFERS,
  SANDBOX_RFQS,
  canAcceptOffer,
  canCreateLotPassport,
  canPublishLot,
  manualLotWarning,
  type FGISParty,
  type LotPassport,
  type Offer,
} from '@/lib/platform-v7/fgis-lot-passport';

describe('platform-v7 fgis lot passport domain', () => {
  it('keeps maturity sandbox-only', () => {
    expect(FGIS_MATURITY).toBe('sandbox');
    expect(SANDBOX_FGIS_PARTIES.every((party) => party.maturity === 'sandbox')).toBe(true);
    expect(SANDBOX_LOT_PASSPORTS.every((passport) => passport.maturity === 'sandbox')).toBe(true);
    expect(SANDBOX_MARKET_LOTS.every((lot) => lot.maturity === 'sandbox')).toBe(true);
    expect(SANDBOX_RFQS.every((rfq) => rfq.maturity === 'sandbox')).toBe(true);
    expect(SANDBOX_OFFERS.every((offer) => offer.maturity === 'sandbox')).toBe(true);
  });

  it('allows lot passport creation only for usable fgis parties', () => {
    expect(canCreateLotPassport(SANDBOX_FGIS_PARTIES[0])).toBe(true);
    expect(canCreateLotPassport(SANDBOX_FGIS_PARTIES[1])).toBe(false);
    expect(canCreateLotPassport(SANDBOX_FGIS_PARTIES[2])).toBe(false);
  });

  it('blocks lot passport creation for blocked parties', () => {
    const party: FGISParty = {
      ...SANDBOX_FGIS_PARTIES[0],
      status: 'blocked',
    };
    expect(canCreateLotPassport(party)).toBe(false);
  });

  it('allows publication only after fgis link or quality attachment', () => {
    const linked: LotPassport = { ...SANDBOX_LOT_PASSPORTS[0], status: 'fgis_linked' };
    const qualityAttached: LotPassport = { ...SANDBOX_LOT_PASSPORTS[0], status: 'quality_attached' };
    const draft: LotPassport = { ...SANDBOX_LOT_PASSPORTS[0], status: 'draft' };

    expect(canPublishLot(linked)).toBe(true);
    expect(canPublishLot(qualityAttached)).toBe(true);
    expect(canPublishLot(draft)).toBe(false);
  });

  it('allows accepting submitted and under-review offers only', () => {
    const submitted: Offer = { ...SANDBOX_OFFERS[0], status: 'submitted' };
    const underReview: Offer = { ...SANDBOX_OFFERS[0], status: 'under_review' };
    const accepted: Offer = { ...SANDBOX_OFFERS[0], status: 'accepted' };

    expect(canAcceptOffer(submitted)).toBe(true);
    expect(canAcceptOffer(underReview)).toBe(true);
    expect(canAcceptOffer(accepted)).toBe(false);
  });

  it('warns for manual lot passports but not fgis/rfq sourced passports', () => {
    const fgisPassport = SANDBOX_LOT_PASSPORTS[0];
    const manualPassport: LotPassport = { ...fgisPassport, source: 'manual_draft' };
    const rfqPassport: LotPassport = { ...fgisPassport, source: 'rfq_response' };

    expect(manualLotWarning(fgisPassport)).toBeNull();
    expect(manualLotWarning(rfqPassport)).toBeNull();
    expect(manualLotWarning(manualPassport)).toContain('manual_draft');
  });

  it('keeps market lot and rfq fixtures linked to sandbox business flow', () => {
    expect(SANDBOX_MARKET_LOTS.length).toBeGreaterThanOrEqual(3);
    expect(SANDBOX_RFQS.length).toBeGreaterThanOrEqual(1);
    expect(SANDBOX_OFFERS.some((offer) => offer.rfqId === SANDBOX_RFQS[0].id)).toBe(true);
  });
});
