/**
 * Live Bank/escrow adapter — reference implementation.
 *
 * Implements the existing `BankAdapter` contract over the shared HTTP client.
 * All transport concerns (auth, retries, timeouts, idempotency) come from the
 * client. Money-moving mutations carry an Idempotency-Key derived from the deal /
 * payment reference to make retries safe (no double reserve / double payout).
 *
 * The per-vendor work left is the endpoint paths + request/response field
 * mapping below (marked "VENDOR MAPPING"): the bank's real API rarely matches a
 * DTO 1:1. Transport concerns are handled by the shared client; this stays at
 * pre-integration maturity until a real vendor contract and credentials land.
 */

import type { BankAdapter, BankPaymentOrder, BankStatement, EscrowAccount } from '../adapters/bank.adapter';
import { LiveAdapterBase } from './live-adapter-base';

export class LiveBankAdapter extends LiveAdapterBase implements BankAdapter {
  readonly name = 'BANK';
  readonly version = '1.0.0-live';

  async createEscrow(params: Omit<EscrowAccount, 'accountNumber' | 'createdAt' | 'status'>): Promise<EscrowAccount> {
    // VENDOR MAPPING: adjust path + payload shape to the bank's escrow-open API.
    return this.http.request<EscrowAccount>({
      method: 'POST',
      path: '/escrow',
      body: params,
      idempotencyKey: `escrow:${params.dealId}`,
    });
  }

  async releaseEscrow(accountNumber: string, conditionsMet: string[]): Promise<void> {
    await this.http.request<void>({
      method: 'POST',
      path: `/escrow/${encodeURIComponent(accountNumber)}/release`,
      body: { conditionsMet },
      idempotencyKey: `escrow-release:${accountNumber}`,
    });
  }

  async refundEscrow(accountNumber: string, reason: string): Promise<void> {
    await this.http.request<void>({
      method: 'POST',
      path: `/escrow/${encodeURIComponent(accountNumber)}/refund`,
      body: { reason },
      idempotencyKey: `escrow-refund:${accountNumber}`,
    });
  }

  async getEscrowStatus(accountNumber: string): Promise<EscrowAccount> {
    return this.http.request<EscrowAccount>({
      method: 'GET',
      path: `/escrow/${encodeURIComponent(accountNumber)}`,
    });
  }

  async sendPayment(order: Omit<BankPaymentOrder, 'id'>): Promise<{ paymentId: string; status: string }> {
    return this.http.request<{ paymentId: string; status: string }>({
      method: 'POST',
      path: '/payments',
      body: order,
      // Deterministic key: same deal+reference must never pay twice on retry.
      idempotencyKey: `payment:${order.dealId}:${order.reference}`,
    });
  }

  async getStatement(accountNumber: string, from: Date, to: Date): Promise<BankStatement> {
    return this.http.request<BankStatement>({
      method: 'GET',
      path: `/accounts/${encodeURIComponent(accountNumber)}/statement`,
      query: { from: from.toISOString(), to: to.toISOString() },
    });
  }

  async verifyAccount(bik: string, account: string): Promise<{ valid: boolean; bankName: string }> {
    return this.http.request<{ valid: boolean; bankName: string }>({
      method: 'POST',
      path: '/accounts/verify',
      body: { bik, account },
    });
  }
}
