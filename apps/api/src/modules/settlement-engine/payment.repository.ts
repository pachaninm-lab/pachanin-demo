/**
 * Injection token for the payment read boundary.
 *
 * Controlled-pilot / pre-integration note:
 * Only the payment READ surface is abstracted here. Money mutations
 * (reserve/release/callback/confirm/adjust/import) deliberately remain on the
 * RuntimeCore path until a dedicated MoneyEngine + idempotency layer exists —
 * they are NOT part of this repository. The DB-backed (Prisma) read adapter is
 * a disabled skeleton selected only under the explicit
 * PLATFORM_V7_PAYMENT_REPOSITORY=prisma flag. No silent Prisma activation.
 */
export const PAYMENT_REPOSITORY = 'PAYMENT_REPOSITORY';

/**
 * Read boundary for payment/settlement data. Abstracts how payment views are
 * read away from SettlementEngineService, which keeps all money-mutation,
 * outbox and role-gating logic.
 */
export interface PaymentRepository {
  /** All payments (settlement snapshots). */
  list(): Promise<unknown[]>;
  /** A single payment by id. */
  detail(id: string): Promise<any>;
  /** Settlement worksheet for a deal. */
  worksheet(dealId: string): any;
  /** Bank workspace for a deal. */
  bankWorkspace(dealId: string): any;
}
