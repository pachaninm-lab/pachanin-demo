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
 * Sber Safe Deals / nominal-account reference mapping.
 *
 * Verified public documentation (2026-09) states that a 201 payment response
 * only means preliminary checks passed and asynchronous processing started.
 * GET status is required; even DONE can later be followed by a separate return
 * transaction from the recipient bank. Therefore no mapping here declares
 * canonical PC-CROP settlement finality.
 */
export class SberReferenceAdapter implements BankReferenceAdapter {
  readonly providerFamily = 'SBER' as const;
  readonly contractMode = 'REFERENCE_CONFORMANCE_ONLY' as const;
  readonly liveTransportImplemented = false;
  readonly capabilities: readonly BankCapability[] = [
    'SAFE_DEAL_RESERVE_RELEASE',
    'DIRECT_PAYMENT',
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
    const status = response.rawStatus?.trim().toUpperCase() ?? null;
    const acknowledgement = status === 'ERROR'
      ? 'REJECTED'
      : response.httpStatus !== null && response.httpStatus >= 200 && response.httpStatus < 300
        ? 'ACCEPTED_NONFINAL'
        : response.httpStatus !== null && response.httpStatus >= 400 && response.httpStatus < 500
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
    const evidenceState = status === 'DONE'
      ? 'SUCCESS_EVIDENCE'
      : status === 'ERROR'
        ? 'FAILURE_EVIDENCE'
        : status === 'CREATED' || status === 'PENDING'
          ? 'NONFINAL_EVIDENCE'
          : 'UNKNOWN_EVIDENCE';
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
      evidenceState,
      rawStatus: response.rawStatus,
      observedAt: normalizeObservedAt(response.observedAt),
      canonicalFinality: 'NOT_DECIDED_HERE',
    };
  }
}
