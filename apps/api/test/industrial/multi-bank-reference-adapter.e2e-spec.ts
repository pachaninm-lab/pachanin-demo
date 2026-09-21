import { describe, expect, it } from '@jest/globals';
import { BankCapabilityRouter, type BankRoutingAuthority } from '../../src/modules/bank-adapters/bank-capability.router';
import { SberReferenceAdapter } from '../../src/modules/bank-adapters/sber-reference.adapter';
import { AlfaReferenceAdapter } from '../../src/modules/bank-adapters/alfa-reference.adapter';
import { TBankReferenceAdapter } from '../../src/modules/bank-adapters/tbank-reference.adapter';
import { validateBankReceiptCandidate } from '../../src/modules/bank-adapters/bank-receipt.contract';

describe('multi-bank reference adapter industrial contract', () => {
  const adapters = [
    new SberReferenceAdapter(),
    new AlfaReferenceAdapter(),
    new TBankReferenceAdapter(),
  ];
  const router = new BankCapabilityRouter(adapters);

  const authority = (providerFamily: BankRoutingAuthority['providerFamily']): BankRoutingAuthority => ({
    providerFamily,
    integrationBindingId: 'binding-1',
    bindingKey: 'bank-primary',
    providerId: 'provider-1',
    providerCapabilityId: 'provider-capability-1',
    capabilityCode: 'BANK',
    maturity: 'CONTRACT_TESTED',
    bindingVersion: '4',
    evidenceMode: 'SERVER_HELD',
    mayCarryRealTraffic: false,
  });

  it('keeps all real provider families non-activated without server-held LIVE_ACCEPTED traffic authority and live transport', () => {
    for (const providerFamily of ['SBER', 'ALFA_BANK', 'T_BANK'] as const) {
      expect(router.route(authority(providerFamily), 'STATUS_READ')).toMatchObject({
        status: 'NOT_ACTIVATED',
        reason: 'SERVER_HELD_MATURITY_DOES_NOT_ALLOW_REAL_TRAFFIC',
      });
    }
  });

  it('never turns transport success or provider evidence into canonical finality', () => {
    const sber = adapters[0]!;
    const response = {
      httpStatus: 201,
      rawStatus: 'DONE',
      providerOperationId: 'provider-op-1',
      providerEventId: 'provider-event-1',
      externalReceiptId: 'external-receipt-1',
      authenticationEvidenceRef: 'auth-evidence-1',
      payloadFingerprint: 'sha256:abc',
      observedAt: '2026-09-22T00:00:00.000Z',
      operationId: 'operation-1',
      amountMinor: '50000',
      currency: 'RUB',
    };
    expect(sber.mapDispatchResponse(response).canonicalFinality).toBe('NOT_DECIDED_HERE');
    const receipt = sber.mapReceiptResponse(response);
    expect(validateBankReceiptCandidate({
      providerFamily: 'SBER',
      operationId: 'operation-1',
      providerOperationId: 'provider-op-1',
      amountMinor: '50000',
      currency: 'RUB',
    }, receipt)).toMatchObject({
      status: 'MATCHED',
      reconciliationState: 'READY_FOR_CANONICAL_RECONCILIATION',
      canonicalFinality: 'NOT_DECIDED_HERE',
    });
  });

  it('keeps provider-specific status vocabulary behind each adapter boundary', () => {
    const alfa = adapters[1]!;
    const tbank = adapters[2]!;
    const base = {
      httpStatus: 200,
      providerOperationId: 'provider-op-1',
      providerEventId: 'event-1',
      externalReceiptId: 'receipt-1',
      authenticationEvidenceRef: 'auth-1',
      payloadFingerprint: 'sha256:abc',
      observedAt: '2026-09-22T00:00:00.000Z',
      operationId: 'operation-1',
      amountMinor: '100',
      currency: 'RUB',
    };
    expect(alfa.mapReceiptResponse({ ...base, rawStatus: 'PAYMENT_FAILED' }).evidenceState)
      .toBe('UNKNOWN_EVIDENCE');
    expect(tbank.mapReceiptResponse({ ...base, rawStatus: 'PAYMENT_FAILED' }).evidenceState)
      .toBe('FAILURE_EVIDENCE');
  });
});
