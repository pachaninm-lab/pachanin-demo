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
 * Alfa nominal-account conformance mapping.
 *
 * Public documentation establishes the product family, but this repository has
 * no pinned exact Alfa status schema/hash or credentials. The adapter therefore
 * refuses to classify provider status strings as success/failure evidence. It
 * only classifies synchronous HTTP transport acknowledgement conservatively.
 */
export class AlfaReferenceAdapter implements BankReferenceAdapter {
  readonly providerFamily = 'ALFA_BANK' as const;
  readonly contractMode = 'REFERENCE_CONFORMANCE_ONLY' as const;
  readonly liveTransportImplemented = false;
  readonly capabilities: readonly BankCapability[] = [
    'SAFE_DEAL_RESERVE_RELEASE',
    'DIRECT_PAYMENT',
    'STATUS_READ',
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
      evidenceState: 'UNKNOWN_EVIDENCE',
      rawStatus: response.rawStatus,
      observedAt: normalizeObservedAt(response.observedAt),
      canonicalFinality: 'NOT_DECIDED_HERE',
    };
  }
}
