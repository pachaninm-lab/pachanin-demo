import { ForbiddenException } from '@nestjs/common';
import { SettlementEngineService } from './settlement-engine.service';

function repository() {
  return {
    listPayments: jest.fn().mockResolvedValue([]),
    paymentDetail: jest.fn().mockResolvedValue({ id: 'P1', dealId: 'D1' }),
    worksheet: jest.fn().mockResolvedValue({
      dealId: 'D1',
      beneficiaries: [{ id: 'B1', role: 'SELLER' }],
      availableKopecks: '100000',
    }),
    bankWorkspace: jest.fn().mockResolvedValue({ dealId: 'D1' }),
    outboxStatus: jest.fn().mockResolvedValue({ total: 0, pending: [] }),
    configureTerms: jest.fn().mockResolvedValue({ termsId: 'T1' }),
    requestOperation: jest.fn().mockResolvedValue({
      operationId: 'OP1',
      status: 'PENDING',
      outboxStatus: 'PENDING',
    }),
    placeHold: jest.fn().mockResolvedValue({ holdId: 'H1' }),
    releaseHold: jest.fn().mockResolvedValue({ holdId: 'H1' }),
    reconcileOperation: jest.fn().mockResolvedValue({ verdict: 'MATCH' }),
    registerVerifiedCallback: jest.fn().mockResolvedValue({
      operationId: 'OP1',
      status: 'SUCCESS',
    }),
  } as any;
}

function access() {
  return {
    assertDealAccess: jest.fn().mockResolvedValue(undefined),
    assertPaymentAccess: jest.fn().mockResolvedValue(undefined),
    filterReadablePayments: jest.fn().mockImplementation(async (rows) => rows),
  } as any;
}

const accountingUser = {
  id: 'u1',
  role: 'ACCOUNTING' as any,
  orgId: 'org1',
  tenantId: 'tenant1',
  sessionId: 'session1',
  email: 'acc@test.com',
  fullName: 'Accounting',
};

describe('SettlementEngineService PostgreSQL authority', () => {
  it('checks participant scope before reads and routes to PostgreSQL', async () => {
    const repo = repository();
    const scope = access();
    const service = new SettlementEngineService(repo, scope);

    await service.listPayments(accountingUser);
    await service.getPayment('P1', accountingUser);
    await service.getWorksheet('D1', accountingUser);
    await service.getBankWorkspace('D1', accountingUser);
    await service.getOutboxStatus('D1', accountingUser);

    expect(scope.filterReadablePayments).toHaveBeenCalledWith([], accountingUser);
    expect(scope.assertPaymentAccess).toHaveBeenCalledWith('P1', accountingUser, false);
    expect(scope.assertDealAccess).toHaveBeenCalledWith('D1', accountingUser, false);
    expect(repo.listPayments).toHaveBeenCalledWith(accountingUser);
    expect(repo.paymentDetail).toHaveBeenCalledWith('P1', accountingUser);
    expect(repo.worksheet).toHaveBeenCalledWith('D1', accountingUser);
    expect(repo.bankWorkspace).toHaveBeenCalledWith('D1', accountingUser);
    expect(repo.outboxStatus).toHaveBeenCalledWith('D1', accountingUser);
  });

  it('checks write scope and creates reserve request through PostgreSQL', async () => {
    const repo = repository();
    const scope = access();
    const service = new SettlementEngineService(repo, scope);

    const result = await service.requestReserve('D1', accountingUser, {
      commandId: 'reserve-command',
      idempotencyKey: 'reserve-idempotency',
      expectedDealVersion: '3',
    });

    expect(result.status).toBe('PENDING');
    expect(scope.assertDealAccess).toHaveBeenCalledWith('D1', accountingUser, true);
    expect(repo.requestOperation).toHaveBeenCalledWith({
      commandId: 'reserve-command',
      idempotencyKey: 'reserve-idempotency',
      expectedPaymentVersion: undefined,
      expectedDealVersion: '3',
      dealId: 'D1',
      operation: 'RESERVE',
    }, accountingUser);
  });

  it('derives full release from PostgreSQL worksheet only after write scope passes', async () => {
    const repo = repository();
    const scope = access();
    const service = new SettlementEngineService(repo, scope);

    await service.requestRelease('D1', accountingUser, {
      commandId: 'release-command',
      idempotencyKey: 'release-idempotency',
    });

    expect(scope.assertDealAccess).toHaveBeenCalledWith('D1', accountingUser, true);
    expect(repo.requestOperation).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'RELEASE',
      dealId: 'D1',
      beneficiaryId: 'B1',
      amountKopecks: '100000',
    }), accountingUser);
  });

  it('routes refund, hold, reconciliation and verified callback to PostgreSQL', async () => {
    const repo = repository();
    const scope = access();
    const service = new SettlementEngineService(repo, scope);

    await service.requestRefund('D1', accountingUser, {
      commandId: 'refund-command',
      idempotencyKey: 'refund-idempotency',
      amountKopecks: '1000',
    });
    await service.placeHold({
      commandId: 'hold-command',
      idempotencyKey: 'hold-idempotency',
      dealId: 'D1',
      amountKopecks: '500',
      basisType: 'DISPUTE',
      basisId: 'DISPUTE-1',
      reason: 'Open dispute',
    }, accountingUser);
    await service.reconcileOperation({
      commandId: 'reconcile-command',
      idempotencyKey: 'reconcile-idempotency',
      dealId: 'D1',
      operationId: 'OP1',
      observedAmountKopecks: '1000',
    }, accountingUser);
    await service.registerBankCallback({
      dealId: 'D1',
      operationId: 'OP1',
      eventId: 'EV1',
      operation: 'REFUND',
      status: 'SUCCESS',
      bankRef: 'BANK-1',
      partnerId: 'safe-deals',
      keyId: 'key-v1',
      payloadFingerprint: 'a'.repeat(64),
      payload: {},
    });

    expect(scope.assertDealAccess).toHaveBeenCalledTimes(3);
    expect(repo.requestOperation).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'REFUND',
      amountKopecks: '1000',
    }), accountingUser);
    expect(repo.placeHold).toHaveBeenCalledTimes(1);
    expect(repo.reconcileOperation).toHaveBeenCalledTimes(1);
    expect(repo.registerVerifiedCallback).toHaveBeenCalledTimes(1);
  });

  it('does not call the repository when participant scope fails', async () => {
    const repo = repository();
    const scope = access();
    scope.assertDealAccess.mockRejectedValueOnce(new ForbiddenException());
    const service = new SettlementEngineService(repo, scope);

    await expect(service.getWorksheet('D1', accountingUser)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.worksheet).not.toHaveBeenCalled();
  });

  it.each([
    'confirmWorksheet',
    'releasePayment',
    'adjustWorksheet',
    'importStatement',
    'replayOutbox',
  ] as const)('fails closed for manual method %s', (method) => {
    const service = new SettlementEngineService(repository(), access());
    expect(() => service[method]()).toThrow(ForbiddenException);
  });
});
