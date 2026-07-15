import { UnprocessableEntityException } from '@nestjs/common';
import { AuctionCommandService } from './auction-command.service';
import type { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';

const buyer: RequestUser = {
  id: 'buyer-user',
  orgId: 'buyer-org',
  tenantId: 'tenant-one',
  role: 'BUYER',
  email: 'buyer@example.test',
  sessionId: 'session-buyer',
};

describe('AuctionCommandService input authority', () => {
  const withTrustedContext = jest.fn();
  const service = new AuctionCommandService({
    withTrustedContext,
  } as unknown as RlsTransactionService);

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

  it('rejects unsafe idempotency keys before PostgreSQL execution', async () => {
    await expect(service.placeBid('lot-one', {
      amountKopecksPerTon: '1900000',
      volumeTons: '100.000000',
      expectedVersion: '3',
      idempotencyKey: 'bid key with spaces',
    }, buyer)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(withTrustedContext).not.toHaveBeenCalled();
  });
});
