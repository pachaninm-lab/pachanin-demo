import { GoneException } from '@nestjs/common';
import { LotsService } from './lots.service';
import type { CreateLotDto } from './dto/create-lot.dto';
import { FGIS_LEGACY_ERROR_CODES } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';

/**
 * P0.2-1A regression guard for the in-memory lot path.
 *
 * The store has no PostgreSQL authority, no reservation and no concurrency
 * control, so nothing it publishes can be trusted as an offer of real grain.
 */
describe('LotsService — in-memory grain lot quarantine', () => {
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
  });

  function newLotDto(): CreateLotDto {
    return {
      title: 'Пшеница 3 класс',
      culture: 'wheat',
      volumeTons: 500,
      startPrice: 12500,
      stepPrice: 250,
      region: 'Тамбовская область',
      auctionEndsAt: '2027-01-15T18:00:00Z',
    } as CreateLotDto;
  }

  const seller = { id: 'user-1', sub: 'user-1', orgId: 'org-1', role: 'FARMER' };

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('seeds no demo fixtures into the seller projection', () => {
      const service = new LotsService();
      expect(service.list(seller)).toEqual([]);
      expect(service.list({ role: 'BUYER' })).toEqual([]);
      // The three fixture ids must not be reachable at all.
      expect(service.list(undefined)).toHaveLength(0);
    });

    it('refuses to make a captured draft tradable', () => {
      const service = new LotsService();
      const lot = service.create(newLotDto(), seller);
      expect(lot.status).toBe('DRAFT');

      expect(() => service.submit(lot.id, seller)).toThrow(GoneException);
      expect(() => service.publish(lot.id, seller)).toThrow(GoneException);
      // Refused means unchanged, not partially applied.
      expect(service.list(seller)[0].status).toBe('DRAFT');
    });

    it('denies with the P0.2 code and changes no state', () => {
      const service = new LotsService();
      const lot = service.create(newLotDto(), seller);
      let thrown: GoneException | undefined;
      try {
        service.submit(lot.id, seller);
      } catch (error) {
        thrown = error as GoneException;
      }
      const body = thrown!.getResponse() as Record<string, unknown>;
      expect(body.code).toBe(FGIS_LEGACY_ERROR_CODES.VERIFIED_LOT_PATH_NOT_READY);
      expect(body.stateChanged).toBe(false);
      expect(body.correlationCode).toMatch(/^FGIS-[0-9A-F]{8}$/);
    });

    it('marks a captured draft as unverified so no reader mistakes it for confirmed grain', () => {
      const service = new LotsService();
      const lot = service.create(newLotDto(), seller);
      expect(lot.sourceVerification).toBe('UNVERIFIED_MANUAL_DRAFT');
    });

    it('does not reveal lot status through the denial', () => {
      // The guard runs before the status precondition, so probing submit on a
      // lot in any status returns the same denial rather than a BadRequest that
      // discloses the current state.
      const service = new LotsService();
      const lot = service.create(newLotDto(), seller);
      const first = (() => {
        try { service.submit(lot.id, seller); } catch (e) { return e as GoneException; }
      })()!;
      const second = (() => {
        try { service.publish(lot.id, seller); } catch (e) { return e as GoneException; }
      })()!;
      expect((first.getResponse() as { code: string }).code).toBe(
        (second.getResponse() as { code: string }).code,
      );
    });
  });

  describe('outside production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('keeps the existing demo flow working for local development and tests', () => {
      const service = new LotsService();
      expect(service.list(undefined).length).toBeGreaterThan(0);

      const lot = service.create(newLotDto(), seller);
      expect(service.submit(lot.id, seller).status).toBe('OPEN');
      expect(service.publish(lot.id, seller).status).toBe('BIDDING');
    });
  });
});
