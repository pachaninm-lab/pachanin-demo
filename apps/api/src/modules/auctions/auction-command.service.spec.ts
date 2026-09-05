import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import { AuctionCommandService, type RegisterAuctionLotInput } from './auction-command.service';
import type { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { RecordingFgisQuarantineAudit } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.test-double';

const buyer: RequestUser = {
  id: 'buyer-user',
  orgId: 'buyer-org',
  tenantId: 'tenant-one',
  role: 'BUYER',
  email: 'buyer@example.test',
  sessionId: 'session-buyer',
};

const registration: RegisterAuctionLotInput = {
  title: 'Declared wheat', culture: 'TEST.WHEAT', volumeTons: '10.000000',
  startPriceKopecksPerTon: '1250000', stepPriceKopecksPerTon: '25000', region: 'test-region',
  auctionEndsAt: '2027-01-15T18:00:00.000Z', sourceType: 'OTHER', sourceExternalId: 'own-stock-one',
  idempotencyKey: 'register-one', inventoryPositionId: 'position-one', inventoryExpectedVersion: '1',
  profileVersionId: 'profile-one', unitCode: 'TON', quantity: '10.000000',
  correlationId: 'correlation-one', reason: 'Publish stock using its canonical reservation.',
};

describe('AuctionCommandService input authority', () => {
  const withTrustedContext = jest.fn();
  const audit = new RecordingFgisQuarantineAudit();
  const service = new AuctionCommandService(
    { withTrustedContext } as unknown as RlsTransactionService,
    audit.asService(),
  );

  beforeEach(() => withTrustedContext.mockReset());

  it('rejects JSON number money before PostgreSQL execution', async () => {
    await expect(service.placeBid('lot-one', {
      amountKopecksPerTon: 1_900_000 as unknown as string,
      volumeTons: '100.000000',
      expectedVersion: '3',
      idempotencyKey: 'bid-one',
    }, buyer)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(withTrustedContext).not.toHaveBeenCalled();
  });

  it('rejects JSON number versions before PostgreSQL execution', async () => {
    await expect(service.placeBid('lot-one', {
      amountKopecksPerTon: '1900000',
      volumeTons: '100.000000',
      expectedVersion: 3 as unknown as string,
      idempotencyKey: 'bid-one',
    }, buyer)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(withTrustedContext).not.toHaveBeenCalled();
  });

  it('rejects volume precision beyond integer microtons', async () => {
    await expect(service.placeBid('lot-one', {
      amountKopecksPerTon: '1900000',
      volumeTons: '100.0000001',
      expectedVersion: '3',
      idempotencyKey: 'bid-microton-overflow',
    }, buyer)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(withTrustedContext).not.toHaveBeenCalled();
  });

  it('rejects unsafe idempotency keys before PostgreSQL execution', async () => {
    await expect(service.placeBid('lot-one', {
      amountKopecksPerTon: '1900000',
      volumeTons: '100.000000',
      expectedVersion: '3',
      idempotencyKey: 'bid key with spaces',
    }, buyer)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(withTrustedContext).not.toHaveBeenCalled();
  });

  it('passes exact JSON strings to the canonical binding command and flushes evidence before ACK', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ result: { lotId: 'lot-one', verificationStatus: 'DECLARED' } }]), $executeRaw: jest.fn().mockResolvedValue(0) };
    withTrustedContext.mockImplementation(async (_user, work) => work(tx));
    const receipt = await service.registerLot(registration, buyer);
    const query = tx.$queryRaw.mock.calls[0]![0];
    expect(query.sql).toContain('auction.register_inventory_lot');
    const payload = JSON.parse(query.values[0]);
    expect(payload).toMatchObject({ inventoryExpectedVersion: '1', quantity: '10', volumeTons: '10', startPriceKopecksPerTon: '1250000', profileVersionId: 'profile-one' });
    expect(payload.commandId).toMatch(/^auction-command:/);
    expect(tx.$executeRaw.mock.calls[0]![0].sql).toContain('SET CONSTRAINTS ALL IMMEDIATE');
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.$executeRaw.mock.invocationCallOrder[0]!);
    expect(receipt).toMatchObject({ lotId: 'lot-one', verificationStatus: 'DECLARED' });
  });

  it('rejects a successful command result when deferred evidence fails', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ result: { lotId: 'lot-one' } }]), $executeRaw: jest.fn().mockRejectedValue(new Error('deferred evidence failed')) };
    withTrustedContext.mockImplementation(async (_user, work) => work(tx));
    await expect(service.registerLot(registration, buyer)).rejects.toMatchObject({ status: 500 });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('retains the persisted command identity on an idempotency replay', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ result: { commandId: 'auction-command:first', lotId: 'lot-one', duplicate: true } }]), $executeRaw: jest.fn().mockResolvedValue(0) };
    withTrustedContext.mockImplementation(async (_user, work) => work(tx));
    expect(await service.registerLot(registration, buyer)).toMatchObject({ commandId: 'auction-command:first', duplicate: true });
    expect(JSON.parse(tx.$queryRaw.mock.calls[0]![0].values[0]).commandId).not.toBe('auction-command:first');
  });

  it.each([
    ['42501', 'INVENTORY_ORGANIZATION_ADMIN_REQUIRED', 403],
    ['P0002', 'INVENTORY_POSITION_NOT_FOUND', 404],
    ['40001', 'INVENTORY_STALE_VERSION', 409],
    ['23505', 'INVENTORY_IDEMPOTENCY_PAYLOAD_MISMATCH', 409],
    ['22023', 'INVENTORY_QUANTITY_NOT_REPRESENTABLE', 422],
    ['23514', 'INVENTORY_INSUFFICIENT_CAPACITY', 422],
  ])('maps nested inventory SQLSTATE %s to the existing HTTP boundary', async (code, message, status) => {
    withTrustedContext.mockRejectedValue({ meta: { code, message } });
    const error = await service.registerLot(registration, buyer).catch((e: HttpException) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
    expect((error as HttpException).getResponse()).toMatchObject({ code: message });
  });
});
