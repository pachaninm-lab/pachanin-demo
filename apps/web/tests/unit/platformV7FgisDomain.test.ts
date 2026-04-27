import { describe, expect, it } from 'vitest';
import {
  FGIS_MATURITY,
  SANDBOX_FGIS_PARTIES,
  SANDBOX_LOT_PASSPORTS,
  SANDBOX_MARKET_LOTS,
  SANDBOX_OFFERS,
  canAcceptOffer,
  canCreateLotPassport,
  canPublishLot,
} from '@/lib/platform-v7/fgis-lot-passport';

describe('platform-v7 FGIS domain smoke contract', () => {
  it('keeps all seeded data sandbox-only', () => {
    expect(FGIS_MATURITY).toBe('sandbox');
    expect(SANDBOX_FGIS_PARTIES.every((item) => item.maturity === 'sandbox')).toBe(true);
    expect(SANDBOX_LOT_PASSPORTS.every((item) => item.maturity === 'sandbox')).toBe(true);
    expect(SANDBOX_MARKET_LOTS.every((item) => item.maturity === 'sandbox')).toBe(true);
  });

  it('keeps seeded references internally consistent', () => {
    const partyIds = new Set(SANDBOX_FGIS_PARTIES.map((item) => item.id));
    const passportIds = new Set(SANDBOX_LOT_PASSPORTS.map((item) => item.id));

    expect(SANDBOX_LOT_PASSPORTS.every((item) => partyIds.has(item.fgisPartyId))).toBe(true);
    expect(SANDBOX_MARKET_LOTS.filter((item) => item.lotPassportId).every((item) => passportIds.has(item.lotPassportId!))).toBe(true);
  });

  it('evaluates seeded guard decisions', () => {
    expect(canCreateLotPassport(SANDBOX_FGIS_PARTIES[0])).toBe(true);
    expect(canCreateLotPassport(SANDBOX_FGIS_PARTIES[1])).toBe(false);
    expect(canPublishLot(SANDBOX_LOT_PASSPORTS[0])).toBe(false);
    expect(canPublishLot(SANDBOX_LOT_PASSPORTS[1])).toBe(true);
    expect(canAcceptOffer(SANDBOX_OFFERS[0])).toBe(true);
  });
});
