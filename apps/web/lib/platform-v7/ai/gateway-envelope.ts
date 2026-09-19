export type GatewayMaturity = 'pre-integration';

export type GatewayRole =
  | 'seller'
  | 'buyer'
  | 'operator'
  | 'bank'
  | 'support'
  | 'arbitrator'
  | 'elevator'
  | 'driver'
  | 'lab';

export type GatewayScope =
  | 'hint'
  | 'summary'
  | 'blocker_explanation'
  | 'next_action'
  | 'evidence_summary'
  | 'triage';

export type GatewayIdempotencyKey = string;

export interface GatewayAuditContext {
  readonly providerId: string;
  readonly executedAt: string;
}

export interface GatewayRequest {
  readonly requestId: string;
  readonly dealId: string;
  readonly role: GatewayRole;
  readonly scope: GatewayScope;
  readonly maturity: GatewayMaturity;
  readonly idempotencyKey: GatewayIdempotencyKey;
  readonly inputSnapshot: Record<string, unknown>;
}

export interface GatewayResponse {
  readonly result: string | null;
  readonly confidence: number;
  readonly limitations: readonly string[];
  readonly auditContext: GatewayAuditContext;
}
