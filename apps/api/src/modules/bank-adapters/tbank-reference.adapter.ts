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
    return buildReferenceRequestEnvelope(this.providerFamily, input);
  }

  mapDispatchResponse(response: BankProviderResponse): BankDispatchMapping {
    return mapReferenceDispatch(this.providerFamily, response);
  }

  mapReceiptResponse(response: BankProviderResponse): BankReceiptCandidate {
    const status = response.rawStatus?.trim().toUpperCase() ?? '';
    return buildReceiptCandidate(
      this.providerFamily,
      response,
      status === 'PAYMENT_FAILED' ? 'FAILURE_EVIDENCE' : 'UNKNOWN_EVIDENCE',
    );
  }
}
