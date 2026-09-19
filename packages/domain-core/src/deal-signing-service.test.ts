import { describe, it, expect, beforeEach } from 'vitest';
import { DealSigningService } from './deal-signing-service';
import { AppendOnlyLedger } from './double-entry-ledger';
import { AuditLog } from './audit-log';
import { verifyEventChain } from './deal-event-chain';

describe('DealSigningService', () => {
  let ledger: AppendOnlyLedger;
  let auditLog: AuditLog;
  let svc: DealSigningService;

  beforeEach(() => {
    ledger = new AppendOnlyLedger();
    auditLog = new AuditLog();
    svc = new DealSigningService(ledger, auditLog);
  });

  const dealId = 'deal-001';
  const contentHash = '0'.repeat(64); // placeholder — tests override via initContract path

  it('initialises contract in PENDING_SELLER status', () => {
    const contract = svc.initContract({ dealId, sellerId: 's1', buyerId: 'b1', amount: 100_000 });
    expect(contract.status).toBe('PENDING_SELLER');
    expect(contract.contentHash).toBeTruthy();
  });

  it('seller signs first, status moves to PENDING_BUYER', () => {
    const contract = svc.initContract({ dealId, sellerId: 's1', buyerId: 'b1', amount: 100_000 });
    const result = svc.signContract(dealId, {
      userId: 's1',
      userRole: 'FARMER',
      certificateId: 'cert-s1',
      signature: { documentHash: contract.contentHash, signatureBase64: 'sig-s1', certificateId: 'cert-s1', signerUserId: 's1', signedAt: new Date().toISOString(), algorithm: 'GOST R 34.10-2012' },
    });
    expect(result.status).toBe('PENDING_BUYER');
  });

  it('buyer signs second, status moves to FULLY_SIGNED', () => {
    const contract = svc.initContract({ dealId, sellerId: 's1', buyerId: 'b1', amount: 100_000 });
    svc.signContract(dealId, { userId: 's1', userRole: 'FARMER', certificateId: 'cert-s1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig-s1', certificateId: 'cert-s1', signerUserId: 's1', signedAt: new Date().toISOString(), algorithm: 'GOST R 34.10-2012' } });
    const result = svc.signContract(dealId, { userId: 'b1', userRole: 'BUYER', certificateId: 'cert-b1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig-b1', certificateId: 'cert-b1', signerUserId: 'b1', signedAt: new Date().toISOString(), algorithm: 'GOST R 34.10-2012' } });
    expect(result.status).toBe('FULLY_SIGNED');
  });

  it('rejects signature with wrong document hash', () => {
    const contract = svc.initContract({ dealId, sellerId: 's1', buyerId: 'b1', amount: 100_000 });
    expect(() =>
      svc.signContract(dealId, { userId: 's1', userRole: 'FARMER', certificateId: 'cert-s1', signature: { documentHash: 'bad-hash', signatureBase64: 'sig', certificateId: 'cert-s1', signerUserId: 's1', signedAt: new Date().toISOString(), algorithm: 'GOST' } })
    ).toThrow('hash does not match');
  });

  it('rejects buyer signing before seller', () => {
    const contract = svc.initContract({ dealId, sellerId: 's1', buyerId: 'b1', amount: 100_000 });
    expect(() =>
      svc.signContract(dealId, { userId: 'b1', userRole: 'BUYER', certificateId: 'cert-b1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig', certificateId: 'cert-b1', signerUserId: 'b1', signedAt: new Date().toISOString(), algorithm: 'GOST' } })
    ).toThrow('awaiting buyer');
  });

  it('reserves payment only after FULLY_SIGNED', () => {
    const contract = svc.initContract({ dealId, sellerId: 's1', buyerId: 'b1', amount: 100_000 });
    expect(() => svc.reservePayment(dealId, { actorId: 'b1', amountKopecks: 10_000_00 })).toThrow('fully signed');
    svc.signContract(dealId, { userId: 's1', userRole: 'FARMER', certificateId: 'cert-s1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig-s1', certificateId: 'cert-s1', signerUserId: 's1', signedAt: new Date().toISOString(), algorithm: 'GOST' } });
    svc.signContract(dealId, { userId: 'b1', userRole: 'BUYER', certificateId: 'cert-b1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig-b1', certificateId: 'cert-b1', signerUserId: 'b1', signedAt: new Date().toISOString(), algorithm: 'GOST' } });
    svc.reservePayment(dealId, { actorId: 'b1', amountKopecks: 10_000_00 });
    expect(ledger.getBalance('PLATFORM_RESERVE')).toBe(10_000_00);
  });

  it('event chain is valid after full flow', () => {
    const contract = svc.initContract({ dealId, sellerId: 's1', buyerId: 'b1', amount: 100_000 });
    svc.signContract(dealId, { userId: 's1', userRole: 'FARMER', certificateId: 'cert-s1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig-s1', certificateId: 'cert-s1', signerUserId: 's1', signedAt: new Date().toISOString(), algorithm: 'GOST' } });
    svc.signContract(dealId, { userId: 'b1', userRole: 'BUYER', certificateId: 'cert-b1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig-b1', certificateId: 'cert-b1', signerUserId: 'b1', signedAt: new Date().toISOString(), algorithm: 'GOST' } });
    svc.reservePayment(dealId, { actorId: 'b1', amountKopecks: 10_000_00 });
    const state = svc.getState(dealId)!;
    expect(verifyEventChain(state.events).valid).toBe(true);
  });

  it('audit log records all actions', () => {
    const contract = svc.initContract({ dealId, sellerId: 's1', buyerId: 'b1', amount: 100_000 });
    svc.signContract(dealId, { userId: 's1', userRole: 'FARMER', certificateId: 'cert-s1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig-s1', certificateId: 'cert-s1', signerUserId: 's1', signedAt: new Date().toISOString(), algorithm: 'GOST' } });
    svc.signContract(dealId, { userId: 'b1', userRole: 'BUYER', certificateId: 'cert-b1', signature: { documentHash: contract.contentHash, signatureBase64: 'sig-b1', certificateId: 'cert-b1', signerUserId: 'b1', signedAt: new Date().toISOString(), algorithm: 'GOST' } });
    svc.reservePayment(dealId, { actorId: 'b1', amountKopecks: 10_000_00 });
    expect(auditLog.length).toBeGreaterThanOrEqual(4);
    expect(auditLog.verify().valid).toBe(true);
  });
});
