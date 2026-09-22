import type { BankCapability } from '../../../../../packages/domain-core/src/bank-capability';
import {
  buildReceiptCandidate,
  buildReferenceRequestEnvelope,
  mapReferenceDispatch,
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
    return buildReferenceRequestEnvelope(this.providerFamily, this.capabilities, input);
  }

  mapDispatchResponse(response: BankProviderResponse): BankDispatchMapping {
    return mapReferenceDispatch(this.providerFamily, response, ['ERROR']);
  }

  mapReceiptResponse(response: BankProviderResponse): BankReceiptCandidate {
    const status = typeof response.rawStatus === 'string'
      ? response.rawStatus.trim().toUpperCase()
      : '';
    const evidenceState = status === 'DONE'
      ? 'SUCCESS_EVIDENCE'
      : status === 'ERROR'
        ? 'FAILURE_EVIDENCE'
        : status === 'CREATED' || status === 'PENDING'
          ? 'NONFINAL_EVIDENCE'
          : 'UNKNOWN_EVIDENCE';
    return buildReceiptCandidate(this.providerFamily, response, evidenceState);
  }
}
