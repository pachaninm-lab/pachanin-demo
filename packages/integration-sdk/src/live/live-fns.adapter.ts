/**
 * Live ФНС adapter (counterparty checks: ЕГРЮЛ/ЕГРИП, tax debt, bank account)
 * over the shared HTTP client. Per-vendor work left: endpoint paths + field
 * mapping (marked "VENDOR MAPPING"). Read-only lookups, no idempotency keys.
 */

import type { FnsAdapter, FnsOrganizationInfo, FnsTaxDebt } from '../adapters/fns.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveFnsAdapter extends LiveAdapterBase implements FnsAdapter {
  readonly name = 'FNS';
  readonly version = '1.0.0-live';

  async getOrganizationByInn(inn: string): Promise<FnsOrganizationInfo | null> {
    // VENDOR MAPPING: ФНС/ЕГРЮЛ lookup; map 404 → null.
    return this.http.request<FnsOrganizationInfo | null>({
      method: 'GET',
      path: `/organizations/${encodeURIComponent(inn)}`,
    });
  }

  async checkTaxDebt(inn: string): Promise<FnsTaxDebt> {
    return this.http.request<FnsTaxDebt>({
      method: 'GET',
      path: `/organizations/${encodeURIComponent(inn)}/tax-debt`,
    });
  }

  async validateBankAccount(bik: string, account: string): Promise<{ valid: boolean; bankName?: string }> {
    return this.http.request<{ valid: boolean; bankName?: string }>({
      method: 'POST',
      path: '/bank-accounts/validate',
      body: { bik, account },
    });
  }
}
