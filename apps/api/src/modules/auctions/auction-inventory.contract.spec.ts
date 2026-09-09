import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role } from '../../common/types/request-user';
import { AuctionAuthorityService } from './auction-authority.service';
import { AuctionCommandService } from './auction-command.service';
import { AuctionsController } from './auctions.controller';
import { validateAuctionInventoryRegistration, type RegisterAuctionLotInput } from './auction-inventory.contract';
import { RegisterAuctionInventoryLotDto } from './dto/auction-inventory.dto';

const registration: RegisterAuctionLotInput = {
  title: 'Declared wheat', culture: 'TEST.WHEAT', volumeTons: '10.000000',
  startPriceKopecksPerTon: '1250000', stepPriceKopecksPerTon: '25000', region: 'test-region',
  auctionEndsAt: '2027-01-15T18:00:00.000Z', sourceType: 'OTHER', sourceExternalId: 'own-stock-one',
  idempotencyKey: 'register-one', inventoryPositionId: 'position-one', inventoryExpectedVersion: '1',
  profileVersionId: 'profile-one', unitCode: 'TON', quantity: '10.000000',
  correlationId: 'correlation-one', reason: 'Publish stock using its canonical reservation.',
};
const authorityFields = ['tenantId', 'organizationId', 'sellerOrgId', 'verified', 'sourceVerifiedAt', 'confirmedQuantity', 'tradePermission', 'policyId', 'ownership', 'isOrgAdmin', 'commandId', 'reservationId'];
const user = { id: 'farmer-one', email: 'farmer@example.invalid', role: Role.FARMER, orgId: 'org-one', tenantId: 'tenant-one', sessionId: 'session-one', membershipId: 'membership-one', isOrgAdmin: true };

describe('Auction inventory registration contract', () => {
  it('retains exact strings and optional DTO fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
    const dto = await pipe.transform(registration, { type: 'body', metatype: RegisterAuctionInventoryLotDto });
    expect(() => validateAuctionInventoryRegistration(dto)).not.toThrow();
  });

  it.each(authorityFields)('rejects supplied authority field %s', (field) => {
    expect(() => validateAuctionInventoryRegistration({ ...registration, [field]: 'forged' })).toThrow();
  });

  it.each([
    { inventoryPositionId: undefined }, { profileVersionId: undefined }, { inventoryExpectedVersion: 1 },
    { quantity: 10 }, { quantity: '1.0000001' }, { reason: 'short' }, { autoExtendEnabled: 'true' },
    { correlationId: 'bad correlation' },
  ])('rejects incomplete or non-exact stock binding %j', (change) => {
    expect(() => validateAuctionInventoryRegistration({ ...registration, ...change })).toThrow();
  });
});

describe('Auction inventory HTTP boundary with application validation settings', () => {
  let app: INestApplication;
  const result = { lotId: 'lot-one', bindingState: 'INVENTORY_BOUND', verificationStatus: 'DECLARED', tradePermission: 'PUBLIC_ALLOWED', independentVerification: null, binding: { id: 'binding-one', positionId: 'position-one', reservationId: 'reservation-one', quantityAtoms: '10000000' } };
  const registerLot = jest.fn().mockResolvedValue(result);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuctionsController],
      providers: [
        { provide: AuctionAuthorityService, useValue: {} },
        { provide: AuctionCommandService, useValue: { registerLot } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: { user?: typeof user }, _res: unknown, next: () => void) => { req.user = user; next(); });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });
  beforeEach(() => registerLot.mockClear());
  afterAll(async () => { await app?.close(); });

  it.each(authorityFields)('does not lose the original %s field to DTO whitelist stripping', async (field) => {
    const response = await request(app.getHttpServer()).post('/api/auctions/lots').send({ ...registration, [field]: 'forged' }).expect(422);
    expect(response.body.code).toBe('AUCTION_UNKNOWN_FIELD');
    expect(registerLot).not.toHaveBeenCalled();
  });

  it.each(['quantity', 'inventoryExpectedVersion', 'volumeTons', 'startPriceKopecksPerTon'])('rejects JSON number %s through the real DTO', async (field) => {
    await request(app.getHttpServer()).post('/api/auctions/lots').send({ ...registration, [field]: 10 }).expect(400);
    expect(registerLot).not.toHaveBeenCalled();
  });

  it('passes valid original JSON and returns the command authority unchanged', async () => {
    const response = await request(app.getHttpServer()).post('/api/auctions/lots').send(registration).expect(201);
    expect(registerLot).toHaveBeenCalledWith(registration, user);
    expect(response.body).toEqual(result);
  });
});

describe('Auction declared stock authority projection', () => {
  const clock = { observed_at: new Date('2026-09-05T12:00:00Z'), tx_id: 1n, database_name: 'authority-test' };
  const lot = {
    id: 'lot-one', tenant_id: user.tenantId, seller_org_id: user.orgId, title: 'Declared wheat', culture: 'TEST.WHEAT', grade: null,
    volume_tons: '10.000000', start_price_rub_per_ton: '12500', step_price_rub_per_ton: '250', region: 'test-region', address: null,
    status: 'BIDDING', auction_ends_at: new Date('2027-01-15T18:00:00Z'), source_type: 'OTHER', source_external_id: 'inventory:batch-one',
    source_certificate_id: null, source_verified_at: null, admission_status: 'ADMITTED', auto_extend_enabled: true,
    auto_extend_window_minutes: 10, auto_extend_minutes: 10, version: 1n, updated_at: clock.observed_at,
    inventory_binding_id: 'binding-one', binding_id: 'binding-one', inventory_position_id: 'position-one', reservation_id: 'reservation-one',
    profile_version_id: 'profile-one', profile_content_hash: 'a'.repeat(64), canonical_code: 'TEST.WHEAT', quantity_atoms: '10000000',
    base_unit_code: 'KG', base_unit_precision: 3, inventory_state_version: '2',
  };
  function authority(row: Record<string, unknown>, workspace = false) {
    const $queryRaw = jest.fn().mockResolvedValueOnce([clock]).mockResolvedValueOnce([row]);
    if (workspace) $queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ active_count: 0n, winner_count: 0n, max_version: null }]).mockResolvedValueOnce([]);
    const withTrustedContext = jest.fn(async (_user, work) => work({ $queryRaw }, { userId: user.id, tenantId: user.tenantId, orgId: user.orgId }));
    return new AuctionAuthorityService({ withTrustedContext } as unknown as RlsTransactionService);
  }

  it('exposes exact binding quantities without inventing independent verification', async () => {
    const response = await authority(lot).listAccessibleLots(user);
    expect(response.items[0]).toMatchObject({ bindingState: 'INVENTORY_BOUND', verificationStatus: 'DECLARED', tradePermission: 'PUBLIC_ALLOWED', independentVerification: null, sourceVerifiedAt: null, exactVolumeTons: '10.000000', binding: { quantityAtoms: '10000000', profileVersionId: 'profile-one', reservationId: 'reservation-one' } });
  });

  it('permits declared public trading while preserving admission blockers', async () => {
    const ready = await authority(lot, true).getWorkspace(lot.id, user);
    expect(ready.workspace.readiness).toMatchObject({ readyForLive: true, blockers: [], nextAction: 'WAIT_FOR_SERVER_BIDS' });
    expect(ready.workspace.originMode.description).toBe('Наличие товара пока не подтверждено независимым источником.');
    const blocked = await authority({ ...lot, admission_status: 'BLOCKED' }, true).getWorkspace(lot.id, user);
    expect(blocked.workspace.tradePermission).toBe('BLOCKED');
    expect(blocked.workspace.readiness.readyForLive).toBe(false);
    expect(blocked.workspace.readiness.blockers).toContain('admission_blocked');
  });

  it('marks historical unbound rows without fabricating stock or independent proof', async () => {
    const response = await authority({ ...lot, inventory_binding_id: null, binding_id: null, source_verified_at: clock.observed_at }).listAccessibleLots(user);
    expect(response.items[0]).toMatchObject({ bindingState: 'LEGACY_UNBOUND', binding: null, verificationStatus: null, tradePermission: null, independentVerification: null, sourceVerifiedAt: clock.observed_at.toISOString() });
  });

  it('fails closed when a persisted binding is inaccessible or contradictory', async () => {
    await expect(authority({ ...lot, binding_id: null }).listAccessibleLots(user)).rejects.toMatchObject({ status: 500 });
    await expect(authority({ ...lot, source_verified_at: clock.observed_at }).listAccessibleLots(user)).rejects.toMatchObject({ status: 500 });
  });
});
