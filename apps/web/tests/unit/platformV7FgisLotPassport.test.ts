import { describe, it, expect } from 'vitest';
import {
  canCreateLotPassport,
  canPublishLot,
  canAcceptOffer,
  manualLotWarning,
  SANDBOX_FGIS_PARTIES,
  SANDBOX_LOT_PASSPORTS,
  SANDBOX_MARKET_LOTS,
  FGIS_MATURITY,
  type FGISParty,
  type LotPassport,
  type Offer,
} from '@/lib/platform-v7/fgis-lot-passport';

describe('FGIS LotPassport domain', () => {
  describe('canCreateLotPassport', () => {
    it('allows verified party with verified batch', () => {
      const party: FGISParty = {
        id: 'p1',
        inn: '1234567890',
        orgName: 'Test Org',
        region: 'Тамбовская',
        status: 'verified',
        maturity: 'sandbox',
        batches: [
          {
            batchId: 'b1',
            grain: 'Пшеница 4 кл.',
            volumeTons: 100,
            harvestYear: 2025,
            region: 'Тамбовская',
            syncStatus: 'verified',
          },
        ],
      };
      expect(canCreateLotPassport(party)).toBe(true);
    });

    it('allows party with manual_mode batch', () => {
      const party: FGISParty = {
        id: 'p2',
        inn: '1234567891',
        orgName: 'Test Org 2',
        region: 'Воронежская',
        status: 'manual_mode',
        maturity: 'sandbox',
        batches: [
          {
            batchId: 'b2',
            grain: 'Ячмень',
            volumeTons: 50,
            harvestYear: 2025,
            region: 'Воронежская',
            syncStatus: 'manual_mode',
          },
        ],
      };
      expect(canCreateLotPassport(party)).toBe(true);
    });

    it('blocks a party with blocked status', () => {
      const party: FGISParty = {
        id: 'p3',
        inn: '1234567892',
        orgName: 'Blocked Org',
        region: 'Курская',
        status: 'blocked',
        maturity: 'sandbox',
        batches: [
          {
            batchId: 'b3',
            grain: 'Пшеница',
            volumeTons: 200,
            harvestYear: 2025,
            region: 'Курская',
            syncStatus: 'verified',
          },
        ],
      };
      expect(canCreateLotPassport(party)).toBe(false);
    });

    it('blocks a party with only pending_sync batches', () => {
      const party: FGISParty = {
        id: 'p4',
        inn: '1234567893',
        orgName: 'Pending Org',
        region: 'Белгородская',
        status: 'pending_sync',
        maturity: 'sandbox',
        batches: [
          {
            batchId: 'b4',
            grain: 'Кукуруза',
            volumeTons: 300,
            harvestYear: 2025,
            region: 'Белгородская',
            syncStatus: 'pending_sync',
          },
        ],
      };
      expect(canCreateLotPassport(party)).toBe(false);
    });
  });

  describe('canPublishLot', () => {
    it('allows publishing when passport is fgis_linked', () => {
      const passport: LotPassport = {
        id: 'lp1',
        fgisPartyId: 'p1',
        fgisBatchId: 'b1',
        source: 'fgis',
        status: 'fgis_linked',
        grain: 'Пшеница 4 кл.',
        volumeTons: 100,
        region: 'Тамбовская',
        harvestYear: 2025,
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(canPublishLot(passport)).toBe(true);
    });

    it('allows publishing when passport is quality_attached', () => {
      const passport: LotPassport = {
        id: 'lp2',
        fgisPartyId: 'p1',
        fgisBatchId: 'b1',
        source: 'fgis',
        status: 'quality_attached',
        grain: 'Пшеница 4 кл.',
        volumeTons: 100,
        region: 'Тамбовская',
        harvestYear: 2025,
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(canPublishLot(passport)).toBe(true);
    });

    it('blocks publishing when passport is draft', () => {
      const passport: LotPassport = {
        id: 'lp3',
        fgisPartyId: 'p1',
        fgisBatchId: 'b1',
        source: 'fgis',
        status: 'draft',
        grain: 'Пшеница 4 кл.',
        volumeTons: 100,
        region: 'Тамбовская',
        harvestYear: 2025,
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(canPublishLot(passport)).toBe(false);
    });

    it('blocks publishing when passport is reserved', () => {
      const passport: LotPassport = {
        id: 'lp4',
        fgisPartyId: 'p1',
        fgisBatchId: 'b1',
        source: 'fgis',
        status: 'reserved',
        grain: 'Пшеница 4 кл.',
        volumeTons: 100,
        region: 'Тамбовская',
        harvestYear: 2025,
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(canPublishLot(passport)).toBe(false);
    });
  });

  describe('canAcceptOffer', () => {
    it('allows acceptance when status is submitted', () => {
      const offer: Offer = {
        id: 'o1',
        type: 'rfq_response',
        seller: { id: 's1', name: 'Seller', role: 'seller' },
        grain: 'Пшеница',
        volumeTons: 100,
        pricePerTon: 12000,
        priceBasis: 'EXW',
        currency: 'RUB',
        status: 'submitted',
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
      };
      expect(canAcceptOffer(offer)).toBe(true);
    });

    it('blocks acceptance when status is accepted', () => {
      const offer: Offer = {
        id: 'o2',
        type: 'rfq_response',
        seller: { id: 's1', name: 'Seller', role: 'seller' },
        grain: 'Пшеница',
        volumeTons: 100,
        pricePerTon: 12000,
        priceBasis: 'EXW',
        currency: 'RUB',
        status: 'accepted',
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
      };
      expect(canAcceptOffer(offer)).toBe(false);
    });
  });

  describe('manualLotWarning', () => {
    it('returns warning for manual_draft source', () => {
      const passport: LotPassport = {
        id: 'lp5',
        fgisPartyId: 'p1',
        fgisBatchId: 'b1',
        source: 'manual_draft',
        status: 'fgis_linked',
        grain: 'Пшеница',
        volumeTons: 100,
        region: 'Тамбовская',
        harvestYear: 2025,
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const warning = manualLotWarning(passport);
      expect(warning).not.toBeNull();
      expect(warning).toContain('manual_draft');
    });

    it('returns null for fgis source', () => {
      const passport: LotPassport = {
        id: 'lp6',
        fgisPartyId: 'p1',
        fgisBatchId: 'b1',
        source: 'fgis',
        status: 'fgis_linked',
        grain: 'Пшеница',
        volumeTons: 100,
        region: 'Тамбовская',
        harvestYear: 2025,
        maturity: 'sandbox',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(manualLotWarning(passport)).toBeNull();
    });
  });

  describe('maturity label', () => {
    it('FGIS_MATURITY is sandbox', () => {
      expect(FGIS_MATURITY).toBe('sandbox');
    });

    it('all sandbox fixtures carry maturity: sandbox', () => {
      SANDBOX_FGIS_PARTIES.forEach((party) => {
        expect(party.maturity).toBe('sandbox');
      });
      SANDBOX_LOT_PASSPORTS.forEach((lp) => {
        expect(lp.maturity).toBe('sandbox');
      });
      SANDBOX_MARKET_LOTS.forEach((ml) => {
        expect(ml.maturity).toBe('sandbox');
      });
    });
  });

  describe('sandbox fixtures integrity', () => {
    it('SANDBOX_FGIS_PARTIES has at least 3 parties', () => {
      expect(SANDBOX_FGIS_PARTIES.length).toBeGreaterThanOrEqual(3);
    });

    it('SANDBOX_LOT_PASSPORTS each link to a FGIS party that exists', () => {
      const partyIds = new Set(SANDBOX_FGIS_PARTIES.map((p) => p.id));
      SANDBOX_LOT_PASSPORTS.forEach((lp) => {
        expect(partyIds.has(lp.fgisPartyId)).toBe(true);
      });
    });

    it('SANDBOX_MARKET_LOTS with lotPassportId each link to a passport that exists', () => {
      const lpIds = new Set(SANDBOX_LOT_PASSPORTS.map((lp) => lp.id));
      SANDBOX_MARKET_LOTS.filter((ml) => ml.lotPassportId != null).forEach((ml) => {
        expect(lpIds.has(ml.lotPassportId)).toBe(true);
      });
    });
  });
});
