import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UnprocessableEntityException } from '@nestjs/common';
import { AuctionCommandService } from './auction-command.service';
import type { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { RecordingFgisQuarantineAudit } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.test-double';
import { FGIS_LEGACY_ERROR_CODES } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';

/**
 * P0.2-1A regression guard for client self-verification of a ФГИС «Зерно» lot.
 *
 * `auction.register_verified_lot` took `sourceType` and `sourceExternalId` from
 * the request and then stamped `source_verified_at`, `status = BIDDING` and
 * `admission_status = ADMITTED`. A client could therefore assert that its own
 * lot was backed by a confirmed ФГИС party, and the platform would record that
 * assertion as verification.
 */

const REPO_ROOT = resolve(__dirname, '../../../../..');
const GUARD_MIGRATION =
  'apps/api/prisma/migrations/20260802120000_fgis_verified_lot_path_quarantine/migration.sql';

const farmer: RequestUser = {
  id: 'farmer-user',
  orgId: 'farmer-org',
  tenantId: 'tenant-one',
  role: 'FARMER',
  email: 'farmer@example.test',
  sessionId: 'session-farmer',
};

function registerInput(sourceType: string) {
  return {
    title: 'Пшеница 3 класс',
    culture: 'wheat',
    volumeTons: '500.000000',
    startPriceKopecksPerTon: '1250000',
    stepPriceKopecksPerTon: '25000',
    region: 'Тамбовская область',
    auctionEndsAt: '2027-01-15T18:00:00.000Z',
    sourceType: sourceType as 'FGIS',
    sourceExternalId: 'FGIS-PARTY-CLAIMED-BY-CLIENT',
    idempotencyKey: 'register-one',
    inventoryPositionId: 'inventory-position-one',
    inventoryExpectedVersion: '1',
    profileVersionId: 'profile-one',
    unitCode: 'TON',
    quantity: '500.000000',
    correlationId: 'correlation-register-one',
    reason: 'Publish declared stock with a canonical inventory reservation.',
  };
}

describe('auction lot registration — ФГИС source cannot be self-verified', () => {
  const withTrustedContext = jest.fn();
  const audit = new RecordingFgisQuarantineAudit();
  const service = new AuctionCommandService(
    { withTrustedContext } as unknown as RlsTransactionService,
    audit.asService(),
  );

  beforeEach(() => withTrustedContext.mockReset());

  it('refuses a client-declared FGIS source before PostgreSQL is reached', async () => {
    await expect(service.registerLot(registerInput('FGIS'), farmer)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    // No auction transaction is opened; the quarantine denial is durably audited.
    expect(withTrustedContext).not.toHaveBeenCalled();
    expect(audit.last.denialCode).toBe(FGIS_LEGACY_ERROR_CODES.VERIFIED_LOT_PATH_NOT_READY);
  });

  it('denies with the P0.2 code and does not echo the claimed external id', async () => {
    const error = await service
      .registerLot(registerInput('FGIS'), farmer)
      .catch((e: UnprocessableEntityException) => e);
    const body = (error as UnprocessableEntityException).getResponse() as Record<string, unknown>;
    expect(body.code).toBe(FGIS_LEGACY_ERROR_CODES.VERIFIED_LOT_PATH_NOT_READY);
    expect(body.stateChanged).toBe(false);
    expect(JSON.stringify(body)).not.toContain('FGIS-PARTY-CLAIMED-BY-CLIENT');
  });

  it('allows non-FGIS source claims to reach declared inventory-bound registration', async () => {
    // Every source label still needs the canonical stock binding. PostgreSQL
    // persists DECLARED and never treats the label as independent verification.
    withTrustedContext.mockResolvedValue({ result: {} });
    for (const sourceType of ['ERP', 'MANUAL_VERIFIED', 'OTHER']) {
      withTrustedContext.mockClear();
      await service.registerLot(registerInput(sourceType), farmer).catch(() => undefined);
      expect(withTrustedContext).toHaveBeenCalled();
    }
  });
});

describe('auction lot registration — row-level guard for direct SQL', () => {
  const migration = readFileSync(resolve(REPO_ROOT, GUARD_MIGRATION), 'utf8');

  it('installs a trigger so a caller bypassing the service is refused too', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION auction.fgis_verified_lot_guard()');
    expect(migration).toContain('CREATE TRIGGER auction_lots_fgis_verified_guard');
    expect(migration).toContain('ON auction.lots');
    expect(migration).toContain("NEW.source_type = 'FGIS'");
    expect(migration).toContain("MESSAGE = 'FGIS_VERIFIED_LOT_PATH_NOT_READY'");
  });

  it('fires on the columns a self-verification attempt would set', () => {
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OF source_type, source_external_id, source_verified_at',
    );
  });

  it('runs with a fixed search_path as a SECURITY DEFINER function', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = pg_catalog, public, auction');
  });

  it('is forward-only and rewrites no existing row', () => {
    expect(migration).not.toMatch(/\bDELETE\s+FROM\s+auction\./i);
    expect(migration).not.toMatch(/\bUPDATE\s+auction\.lots\s+SET/i);
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  it('maps the raised code to a structured API error', () => {
    const commandService = readFileSync(
      resolve(REPO_ROOT, 'apps/api/src/modules/auctions/auction-command.service.ts'),
      'utf8',
    );
    // Present in AUCTION_CODES so a trigger-raised failure is translated rather
    // than surfacing as an opaque AUCTION_COMMAND_FAILED.
    expect(commandService).toContain('FGIS_LEGACY_ERROR_CODES.VERIFIED_LOT_PATH_NOT_READY');
  });
});
