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
    return buildReferenceRequestEnvelope(this.providerFamily, this.capabilities, input);
  }

  mapDispatchResponse(response: BankProviderResponse): BankDispatchMapping {
    return mapReferenceDispatch(this.providerFamily, response);
  }

  mapReceiptResponse(response: BankProviderResponse): BankReceiptCandidate {
    return buildReceiptCandidate(this.providerFamily, response, 'UNKNOWN_EVIDENCE');
  }
}
