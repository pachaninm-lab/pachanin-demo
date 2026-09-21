import {
  requiredBankCapability,
  type BankCapability,
} from '../../../../../packages/domain-core/src/bank-capability';
import {
  normalizeBankOperationRequest,
  normalizeObservedAt,
  type BankAdapterOperationRequest,
  type BankDispatchMapping,
  type BankProviderResponse,
  type BankReceiptCandidate,
  type BankReferenceAdapter,
  type BankReferenceRequestEnvelope,
} from './bank-adapter.port';

/**
 * T-Bank nominal-account reference mapping.
 *
 * Public documentation exposes nominal-account deal stages, status reads,
 * billing and credit-product APIs. HTTP 200/201 acknowledges the called API
 * operation but does not establish PC-CROP settlement finality. PAYMENT_FAILED
 * is explicitly documented for a failed deal-stage payout and is therefore
 * mapped only to failure evidence.
 */
export class TBankReferenceAdapter implements BankReferenceAdapter {
  readonly providerFamily = 'T_BANK' as const;
  readonly contractMode = 'REFERENCE_CONFORMANCE_ONLY' as const;
  readonly liveTransportImplemented = false;
  readonly capabilities: readonly BankCapability[] = [
    'SAFE_DEAL_RESERVE_RELEASE',
    'DIRECT_PAYMENT',
    'BILLING',
    'FINANCING_APPLICATION',
    'STATEMENT_READ',
    'STATUS_READ',
    'AUTHENTICATED_CALLBACK',
    'RECONCILIATION',
  ];

  describeRequest(input: BankAdapterOperationRequest): BankReferenceRequestEnvelope {
    const normalized = normalizeBankOperationRequest(input);
    return {
      providerFamily: this.providerFamily,
      capability: requiredBankCapability(normalized.command),
      command: normalized.command,
      operationId: normalized.operationId,
      idempotencyKey: normalized.idempotencyKey,
      amountMinor: normalized.amountMinor,
      currency: normalized.currency,
      sourceVersion: normalized.sourceVersion,
      beneficiaryReference: normalized.beneficiaryReference,
      contractMode: this.contractMode,
      liveRequestReady: false,
    };
  }

  mapDispatchResponse(response: BankProviderResponse): BankDispatchMapping {
    const acknowledgement = response.httpStatus !== null
      && response.httpStatus >= 200
      && response.httpStatus < 300
      ? 'ACCEPTED_NONFINAL'
      : response.httpStatus !== null
        && response.httpStatus >= 400
        && response.httpStatus < 500
        ? 'REJECTED'
        : 'UNKNOWN';
    return {
      providerFamily: this.providerFamily,
      acknowledgement,
      providerOperationId: response.providerOperationId,
      rawStatus: response.rawStatus,
      observedAt: normalizeObservedAt(response.observedAt),
      canonicalFinality: 'NOT_DECIDED_HERE',
      retryPolicy: acknowledgement === 'REJECTED' ? 'NO_MUTATION_RECORDED' : 'RECONCILE_BEFORE_RETRY',
    };
  }

  mapReceiptResponse(response: BankProviderResponse): BankReceiptCandidate {
    const status = response.rawStatus?.trim().toUpperCase() ?? '';
    return {
      providerFamily: this.providerFamily,
      operationId: response.operationId,
      providerOperationId: response.providerOperationId,
      providerEventId: response.providerEventId,
      externalReceiptId: response.externalReceiptId,
      authenticationEvidenceRef: response.authenticationEvidenceRef,
      payloadFingerprint: response.payloadFingerprint,
      amountMinor: response.amountMinor,
      currency: response.currency,
      evidenceState: status === 'PAYMENT_FAILED' ? 'FAILURE_EVIDENCE' : 'UNKNOWN_EVIDENCE',
      rawStatus: response.rawStatus,
      observedAt: normalizeObservedAt(response.observedAt),
      canonicalFinality: 'NOT_DECIDED_HERE',
    };
  }
}
