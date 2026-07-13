import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SettlementEngineService } from './settlement-engine.service';
import { Role, type RequestUser } from '../../common/types/request-user';

const accountingUser: RequestUser = {
  id: 'u1',
  role: Role.ACCOUNTING,
  orgId: 'org1',
  tenantId: 'tenant1',
  sessionId: 'session1',
  email: 'acc@test.com',
};

const command = {
  commandId: 'command-reserve-0001',
  idempotencyKey: 'idempotency-reserve-0001',
  expectedUpdatedAt: '2026-07-13T12:00:00.000Z',
  expectedVersion: '5',
  payload: {},
};

function makePayments() {
  return {
    list: jest.fn().mockResolvedValue([]),
    detail: jest.fn().mockResolvedValue({ id: 'payment-1' }),
    worksheet: jest.fn().mockResolvedValue({ deal: { id: 'D1' }, blockers: [] }),
    bankWorkspace: jest.fn().mockResolvedValue({ deal: { id: 'D1' }, blockers: [] }),
    outboxStatus: jest.fn().mockResolvedValue({ totalPending: 0, pending: [], manualReview: [] }),
    exportDeals: jest.fn().mockResolvedValue({ contentType: 'text/csv', fileName: 'payments.csv', body: '' }),
    exportContractors: jest.fn().mockResolvedValue({ contentType: 'text/csv', fileName: 'contractors.csv', body: '' }),
  } as any;
}

function makeGateway() {
  return {
    executeUser: jest.fn().mockResolvedValue({ ok: true, duplicate: false }),
  } as any;
}

function makeReconciliation() {
  return {
    importMT940: jest.fn().mockResolvedValue({ imported: 1 }),
  } as any;
}

describe('SettlementEngineService PostgreSQL authority', () => {
  it('delegates reads to the trusted-RLS payment repository', async () => {
    const payments = makePayments();
    const service = new SettlementEngineService(payments, makeGateway(), makeReconciliation());

    await expect(service.worksheet('D1', accountingUser)).resolves.toMatchObject({ deal: { id: 'D1' } });
    await expect(service.bankWorkspace('D1', accountingUser)).resolves.toMatchObject({ deal: { id: 'D1' } });
    await service.listPayments(accountingUser);
    await service.paymentDetail('payment-1', accountingUser);
    await service.getOutboxStatus('D1', accountingUser);

    expect(payments.worksheet).toHaveBeenCalledWith('D1', accountingUser);
    expect(payments.outboxStatus).toHaveBeenCalledWith('D1', accountingUser);
  });

  it('routes reserve and release requests through canonical Deal commands', async () => {
    const gateway = makeGateway();
    const service = new SettlementEngineService(makePayments(), gateway, makeReconciliation());

    await service.requestReserve('D1', command, accountingUser);
    await service.requestRelease('D1', { ...command, commandId: 'command-release-0001' }, accountingUser);

    expect(gateway.executeUser).toHaveBeenNthCalledWith(
      1,
      'D1',
      'request_reserve',
      expect.objectContaining({ expectedVersion: '5' }),
      accountingUser,
    );
    expect(gateway.executeUser).toHaveBeenNthCalledWith(
      2,
      'D1',
      'request_release',
      expect.any(Object),
      accountingUser,
    );
  });

  it('denies roles that cannot request money operations', async () => {
    const service = new SettlementEngineService(makePayments(), makeGateway(), makeReconciliation());
    const driver = { ...accountingUser, id: 'driver-1', role: Role.DRIVER };

    await expect(service.requestReserve('D1', command, driver)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.requestRelease('D1', command, driver)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('has no human reserve-confirmation or payout path', () => {
    const service = new SettlementEngineService(makePayments(), makeGateway(), makeReconciliation());

    expect(() => service.confirmWorksheet()).toThrow(UnauthorizedException);
    expect(() => service.releasePayment()).toThrow(UnauthorizedException);
  });

  it('fails closed on free-form amount adjustment', () => {
    const service = new SettlementEngineService(makePayments(), makeGateway(), makeReconciliation());

    expect(() => service.adjustWorksheet('D1', [{ deltaKopecks: 100 }], accountingUser))
      .toThrow(ConflictException);
  });

  it('delegates only MT940 to the durable PostgreSQL reconciliation service', async () => {
    const reconciliation = makeReconciliation();
    const service = new SettlementEngineService(makePayments(), makeGateway(), reconciliation);

    await expect(service.importBankStatement(':20:TEST', 'MT940', accountingUser))
      .resolves.toMatchObject({ imported: 1 });
    expect(reconciliation.importMT940).toHaveBeenCalledWith(':20:TEST', accountingUser);
    await expect(service.importBankStatement('csv', 'CSV', accountingUser)).rejects.toThrow();
  });
});
