import { BadRequestException, GoneException, ServiceUnavailableException } from '@nestjs/common';
import { LotsService } from './lots.service';
import type { CreateLotDto } from './dto/create-lot.dto';
import { FGIS_LEGACY_ERROR_CODES } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';
import { RecordingFgisQuarantineAudit } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.test-double';
import type { RequestUser } from '../../common/types/request-user';

/**
 * P0.2-1A regression guard for the legacy in-memory lot contour.
 *
 * The store has no PostgreSQL authority, no reservation, no durable object
 * authorization and no concurrency control, so nothing it publishes can be
 * trusted as an offer of real grain. In production the whole surface is closed.
 */
describe('LotsService — legacy in-memory contour', () => {
  const savedNodeEnv = process.env.NODE_ENV;
  let audit: RecordingFgisQuarantineAudit;
  let service: LotsService;

  beforeEach(() => {
    audit = new RecordingFgisQuarantineAudit();
  });

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
  });

  function build(): LotsService {
    return new LotsService(audit.asService());
  }

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

  const seller: RequestUser = {
    id: 'user-1',
    orgId: 'org-1',
    tenantId: 'tenant-one',
    role: 'FARMER',
    email: 'farmer@example.test',
    sessionId: 'session-1',
  };

  async function denialOf(run: () => Promise<unknown>): Promise<GoneException> {
    try {
      await run();
    } catch (error) {
      return error as GoneException;
    }
    throw new Error('the retired contour must not resolve');
  }

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      service = build();
    });

    it('seeds no demo fixtures at all', async () => {
      // Denied rather than empty: an empty list would still be a claim about
      // lots, and this contour has no authority to make one.
      await expect(service.list(seller)).rejects.toBeInstanceOf(GoneException);
      expect(audit.last.route).toBe('GET /lots');
    });

    it('denies every entry point of the contour', async () => {
      const routes: Array<[string, () => Promise<unknown>]> = [
        ['GET /lots', () => service.list(seller)],
        ['GET /lots/report', () => service.listReport(seller)],
        ['GET /lots/:id/report', () => service.getReport('LOT-001', seller)],
        ['POST /lots', () => service.create(newLotDto(), seller)],
        ['PATCH /lots/:id/submit', () => service.submit('LOT-001', seller)],
        ['PATCH /lots/:id/publish', () => service.publish('LOT-001', seller)],
      ];

      for (const [route, run] of routes) {
        const error = await denialOf(run);
        expect(error).toBeInstanceOf(GoneException);
        const body = error.getResponse() as Record<string, unknown>;
        expect(body.code).toBe(FGIS_LEGACY_ERROR_CODES.LEGACY_LOT_CONTOUR_RETIRED);
        expect(body.stateChanged).toBe(false);
        expect(body.correlationCode).toMatch(/^FGIS-[0-9A-F]{8}$/);
        expect(audit.last.route).toBe(route);
      }
      expect(audit.facts).toHaveLength(routes.length);
    });

    it('writes no draft into process memory', async () => {
      await denialOf(() => service.create(newLotDto(), seller));
      // A second reader must not observe anything from the refused create.
      const error = await denialOf(() => service.list(seller));
      expect(error).toBeInstanceOf(GoneException);
      expect((service as unknown as { store: unknown[] }).store).toHaveLength(0);
    });

    it('does not disclose whether a lot id exists', async () => {
      const known = await denialOf(() => service.getReport('LOT-001', seller));
      const unknown = await denialOf(() => service.getReport('LOT-DOES-NOT-EXIST', seller));
      // Same code and same status either way — the guard runs before the lookup,
      // so the denial cannot be used to probe for ids.
      expect((known.getResponse() as { code: string }).code).toBe(
        (unknown.getResponse() as { code: string }).code,
      );
      expect(known.getStatus()).toBe(unknown.getStatus());
    });

    it('attributes the denial to the resolved session', async () => {
      await denialOf(() => service.publish('LOT-001', seller));
      expect(audit.last).toMatchObject({
        tenantId: 'tenant-one',
        organizationId: 'org-1',
        actorUserId: 'user-1',
        sessionId: 'session-1',
      });
    });

    it('fails closed when the audit authority is unavailable', async () => {
      audit.unavailable = true;
      await expect(service.create(newLotDto(), seller)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect((service as unknown as { store: unknown[] }).store).toHaveLength(0);
    });
  });

  describe('with an unrecognised NODE_ENV', () => {
    it('keeps the strict contour rather than reopening the legacy surface', async () => {
      process.env.NODE_ENV = 'staging-preview';
      service = build();
      await expect(service.list(seller)).rejects.toBeInstanceOf(GoneException);
    });

    it('keeps the strict contour when NODE_ENV is unset', async () => {
      delete process.env.NODE_ENV;
      service = build();
      await expect(service.list(seller)).rejects.toBeInstanceOf(GoneException);
    });
  });

  describe('under the explicit test-only binding', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      service = build();
    });

    it('keeps the demo flow working for local development and tests', async () => {
      expect((await service.list(undefined)).length).toBeGreaterThan(0);

      const lot = await service.create(newLotDto(), seller);
      expect((await service.submit(lot.id, seller)).status).toBe('OPEN');
      expect((await service.publish(lot.id, seller)).status).toBe('BIDDING');
      expect(audit.facts).toHaveLength(0);
    });

    it('marks a captured draft as unverified', async () => {
      const lot = await service.create(newLotDto(), seller);
      expect(lot.sourceVerification).toBe('UNVERIFIED_MANUAL_DRAFT');
    });

    it('refuses a draft that has no real owner instead of inventing demo-org', async () => {
      // The old code fell back to `demo-org` / `demo-user`, which made the
      // store unattributable and let an unowned lot exist.
      await expect(
        service.create(newLotDto(), { role: 'FARMER' } as Partial<RequestUser>),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create(newLotDto(), null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('scopes a farmer list to their own organization without a session fallback', async () => {
      const lot = await service.create(newLotDto(), seller);
      const otherOrg = await service.list({
        ...seller,
        id: 'user-2',
        orgId: 'org-2',
      } as RequestUser);
      expect(otherOrg.map((entry) => entry.id)).not.toContain(lot.id);
    });
  });
});
