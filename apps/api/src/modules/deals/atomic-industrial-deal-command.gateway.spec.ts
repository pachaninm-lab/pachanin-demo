import { ConflictException } from '@nestjs/common';
import { AtomicIndustrialDealCommandGateway } from './atomic-industrial-deal-command.gateway';

const FAILED_RESERVE = {
  dealId: 'DEAL-INDUSTRIAL-001',
  eventId: 'eventone',
  operation: 'RESERVE' as const,
  status: 'FAILED' as const,
  bankRef: 'refone',
  errorMessage: 'reserve_declined',
};

function fixture(options: {
  dealStatus?: string;
  operation?: { id: string } | null;
  paymentCount?: number;
  operationCount?: number;
} = {}) {
  const tx = {
    outboxEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'receipt' }),
    },
    deal: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'DEAL-INDUSTRIAL-001',
        tenantId: 'tenant-canonical-test',
        buyerOrgId: 'org-canonical-buyer',
        status: options.dealStatus ?? 'RESERVE_REQUESTED',
      }),
    },
    bankOperation: {
      findFirst: jest.fn().mockResolvedValue(
        options.operation === undefined ? { id: 'bank-reserve:DEAL-INDUSTRIAL-001' } : options.operation,
      ),
      updateMany: jest.fn().mockResolvedValue({ count: options.operationCount ?? 1 }),
    },
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: options.paymentCount ?? 1 }),
    },
    dealEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'event' }),
    },
    auditEvent: {
      create: jest.fn().mockResolvedValue({ id: 'audit' }),
    },
  };
  const database = {
    outboxEntry: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const commands = { execute: jest.fn() };
  return {
    tx,
    database,
    commands,
    gateway: new AtomicIndustrialDealCommandGateway(database as any, commands as any),
  };
}

describe('AtomicIndustrialDealCommandGateway failed callbacks', () => {
  it('rejects a stale failure before payment or bank-operation mutation', async () => {
    const test = fixture({ dealStatus: 'DRAFT' });

    await expect(test.gateway.executeBankCallback(FAILED_RESERVE)).rejects.toBeInstanceOf(ConflictException);

    expect(test.tx.payment.updateMany).not.toHaveBeenCalled();
    expect(test.tx.bankOperation.updateMany).not.toHaveBeenCalled();
    expect(test.tx.outboxEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a callback that has no matching pending bank operation', async () => {
    const test = fixture({ operation: null });

    await expect(test.gateway.executeBankCallback(FAILED_RESERVE)).rejects.toBeInstanceOf(ConflictException);

    expect(test.tx.payment.updateMany).not.toHaveBeenCalled();
    expect(test.tx.bankOperation.updateMany).not.toHaveBeenCalled();
  });

  it('commits payment, operation, evidence and receipt in one serializable transaction', async () => {
    const test = fixture();

    await expect(test.gateway.executeBankCallback(FAILED_RESERVE)).resolves.toMatchObject({
      ok: false,
      status: 'FAILED',
      operation: 'RESERVE',
      dealId: 'DEAL-INDUSTRIAL-001',
    });

    expect(test.database.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(test.tx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'RESERVE_REQUESTED',
        callbackState: 'PENDING',
      }),
    }));
    expect(test.tx.bankOperation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'PENDING' }),
    }));
    expect(test.tx.dealEvent.create).toHaveBeenCalledTimes(1);
    expect(test.tx.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(test.tx.outboxEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'bank.callback.receipt',
        idempotencyKey: 'bank-callback-failure:eventone',
      }),
    }));
    expect(test.commands.execute).not.toHaveBeenCalled();
  });

  it('rolls back when payment is no longer waiting for the callback', async () => {
    const test = fixture({ paymentCount: 0 });

    await expect(test.gateway.executeBankCallback(FAILED_RESERVE)).rejects.toBeInstanceOf(ConflictException);

    expect(test.tx.bankOperation.updateMany).not.toHaveBeenCalled();
    expect(test.tx.dealEvent.create).not.toHaveBeenCalled();
    expect(test.tx.outboxEntry.create).not.toHaveBeenCalled();
  });

  it('does not write evidence when the pending bank operation changes concurrently', async () => {
    const test = fixture({ operationCount: 0 });

    await expect(test.gateway.executeBankCallback(FAILED_RESERVE)).rejects.toBeInstanceOf(ConflictException);

    expect(test.tx.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(test.tx.dealEvent.create).not.toHaveBeenCalled();
    expect(test.tx.auditEvent.create).not.toHaveBeenCalled();
    expect(test.tx.outboxEntry.create).not.toHaveBeenCalled();
  });
});
