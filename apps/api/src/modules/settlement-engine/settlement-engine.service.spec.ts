import { SettlementEngineService } from './settlement-engine.service';

function makeRuntime() {
  return {
    worksheet: jest.fn().mockReturnValue({ payment: { amountRub: 1000000, bankEventId: 'EVT1' } }),
    bankWorkspace: jest.fn().mockReturnValue({ beneficiaries: [] }),
    listPayments: jest.fn().mockReturnValue([]),
    paymentDetail: jest.fn().mockReturnValue({}),
    reservePrepayment: jest.fn().mockReturnValue({ status: 'RESERVE_PENDING' }),
    releasePayment: jest.fn().mockReturnValue({ status: 'RELEASED' }),
    confirmWorksheet: jest.fn().mockReturnValue({ status: 'RESERVED' }),
    adjustWorksheet: jest.fn().mockReturnValue({}),
    importBankStatement: jest.fn().mockReturnValue({}),
    registerSafeDealsCallback: jest.fn().mockReturnValue({ status: 'OK' }),
    dealWorkspace: jest.fn().mockReturnValue({ blockers: [], payment: { status: 'RESERVED' }, completeness: { isComplete: true }, bankWorkspace: { beneficiaries: [] } }),
  } as any;
}

function makeExecutor() {
  return {
    execute: jest.fn().mockResolvedValue({ result: { status: 'OK' } }),
  } as any;
}

function makeOutbox(pending: any[] = []) {
  return {
    getByDeal: jest.fn().mockReturnValue(pending),
    listPending: jest.fn().mockReturnValue(pending),
    listManualReview: jest.fn().mockReturnValue([]),
    confirm: jest.fn(),
    markFailed: jest.fn(),
    enqueue: jest.fn().mockReturnValue({ id: 'O1' }),
  } as any;
}

const accountingUser = { id: 'u1', role: 'ACCOUNTING' as any, orgId: 'org1', email: 'acc@test.com' };

describe('SettlementEngineService', () => {
  describe('requestReserve()', () => {
    it('enqueues outbox and returns pending status', async () => {
      const svc = new SettlementEngineService(makeRuntime(), makeExecutor(), makeOutbox([{ id: 'O1', status: 'PENDING' }]));
      const result = await svc.requestReserve('D1', accountingUser);
      expect(result.outboxStatus).toBe('PENDING');
    });

    it('throws ForbiddenException for non-money roles', async () => {
      const svc = new SettlementEngineService(makeRuntime(), makeExecutor(), makeOutbox());
      const driver = { id: 'u2', role: 'DRIVER' as any, orgId: 'org1', email: 'd@test.com' };
      await expect(svc.requestReserve('D1', driver)).rejects.toThrow(/DRIVER cannot perform money/);
    });
  });

  describe('requestRelease()', () => {
    it('returns blocked when deal has blockers', async () => {
      const runtime = makeRuntime();
      runtime.dealWorkspace = jest.fn().mockReturnValue({ blockers: ['dispute open'] });
      const svc = new SettlementEngineService(runtime, makeExecutor(), makeOutbox());
      const result = await svc.requestRelease('D1', accountingUser) as any;
      expect(result.blocked).toBe(true);
      expect(result.blockers).toEqual(['dispute open']);
    });

    it('enqueues release when no blockers', async () => {
      const executor = makeExecutor();
      const svc = new SettlementEngineService(makeRuntime(), executor, makeOutbox());
      await svc.requestRelease('D1', accountingUser);
      expect(executor.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerSafeDealsCallback()', () => {
    it('confirms pending outbox entry on SUCCESS callback', () => {
      const outbox = makeOutbox([{ id: 'O1', status: 'PENDING' }]);
      const svc = new SettlementEngineService(makeRuntime(), makeExecutor(), outbox);
      svc.registerSafeDealsCallback({ dealId: 'D1', status: 'SUCCESS' });
      expect(outbox.confirm).toHaveBeenCalledWith('O1');
    });

    it('marks failed outbox entry on FAILED callback', () => {
      const outbox = makeOutbox([{ id: 'O1', status: 'SENT' }]);
      const svc = new SettlementEngineService(makeRuntime(), makeExecutor(), outbox);
      svc.registerSafeDealsCallback({ dealId: 'D1', status: 'FAILED', errorMessage: 'nsf' });
      expect(outbox.markFailed).toHaveBeenCalledWith('O1', 'nsf');
    });

    it('does nothing when no pending outbox entries', () => {
      const outbox = makeOutbox([]);
      const svc = new SettlementEngineService(makeRuntime(), makeExecutor(), outbox);
      svc.registerSafeDealsCallback({ dealId: 'D1', status: 'SUCCESS' });
      expect(outbox.confirm).not.toHaveBeenCalled();
    });
  });

  describe('getOutboxStatus()', () => {
    it('returns all pending when no dealId provided', () => {
      const outbox = makeOutbox([{ id: 'O1' }]);
      const svc = new SettlementEngineService(makeRuntime(), makeExecutor(), outbox);
      const result = svc.getOutboxStatus();
      expect(outbox.listPending).toHaveBeenCalled();
    });

    it('returns deal-specific pending when dealId provided', () => {
      const outbox = makeOutbox([{ id: 'O1', dealId: 'D1' }]);
      const svc = new SettlementEngineService(makeRuntime(), makeExecutor(), outbox);
      svc.getOutboxStatus('D1');
      expect(outbox.getByDeal).toHaveBeenCalledWith('D1');
    });
  });
});
