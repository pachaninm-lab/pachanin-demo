/**
 * Live AML / Росфинмониторинг adapter (sanction screening, 115-ФЗ transaction
 * checks) over the shared HTTP client. Per-vendor work left: endpoint paths +
 * field mapping (marked "VENDOR MAPPING").
 */

import type {
  AmlScreeningRequest,
  AmlScreeningResult,
  AmlTransactionCheck,
  AmlTransactionResult,
} from '../adapters/aml.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveAmlAdapter extends LiveAdapterBase {
  readonly name = 'AML_ROSFINMONITORING';
  readonly version = '1.0.0-live';

  /** Matches the mock: the generic execute routes to entity screening. */
  async execute(request: unknown): Promise<AmlScreeningResult> {
    return this.screenEntity(request as AmlScreeningRequest);
  }

  async screenEntity(req: AmlScreeningRequest): Promise<AmlScreeningResult> {
    // VENDOR MAPPING: screening provider entity-check endpoint.
    return this.http.request<AmlScreeningResult>({
      method: 'POST',
      path: '/screening/entity',
      body: req,
    });
  }

  async checkTransaction(req: AmlTransactionCheck): Promise<AmlTransactionResult> {
    return this.http.request<AmlTransactionResult>({
      method: 'POST',
      path: '/screening/transaction',
      body: req,
      idempotencyKey: `aml-tx:${req.transactionId}`,
    });
  }
}
