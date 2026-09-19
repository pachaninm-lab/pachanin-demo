import type { PlatformV7Role } from '../rbac';
import { platformV7CanonicalReadDecision } from '../canonical-data';
import { platformV7LedgerSourceDecision, platformV7LedgerHasHeldMoney } from '../ledger-source';

export type PlatformV7AuditActorType = 'platform-role' | 'system-boundary';

export type PlatformV7AuditTargetType = 'deal' | 'ledger-entry' | 'evidence-reference' | 'dispute-case';

export type PlatformV7AuditEventKind =
  | 'deal-created'
  | 'ledger-reserved'
  | 'ledger-held'
  | 'evidence-attached'
  | 'dispute-opened'
  | 'boundary-reviewed';

export type PlatformV7AuditEvidenceReference = Readonly<{
  evidenceId: string;
  evidenceType: 'quality-report' | 'weighing-note' | 'route-proof' | 'money-basis';
  source: 'controlled-pilot-evidence-read-model';
}>;

export type PlatformV7AuditActor = Readonly<{
  actorId: string;
  role: PlatformV7Role;
  actorType: PlatformV7AuditActorType;
}>;

export type PlatformV7AuditTarget = Readonly<{
  targetId: string;
  targetType: PlatformV7AuditTargetType;
  dealId: string;
  tenantId: string;
}>;

export type PlatformV7AuditEvent = Readonly<{
  eventId: string;
  kind: PlatformV7AuditEventKind;
  actor: PlatformV7AuditActor;
  target: PlatformV7AuditTarget;
  reason: string;
  evidenceReferences: readonly PlatformV7AuditEvidenceReference[];
  occurredAtIso: string;
  source: 'controlled-pilot-audit-read-model';
}>;

export type PlatformV7AuditReadModelView = Readonly<{
  dealId: string;
  tenantId: string;
  events: readonly PlatformV7AuditEvent[];
  evidenceReferenceCount: number;
  hasMoneyHold: boolean;
  source: 'controlled-pilot-audit-read-model';
}>;

export type PlatformV7AuditReadDecisionReason =
  | 'audit-read-model-selected'
  | 'canonical-audit-entry-rejected'
  | 'ledger-source-rejected'
  | 'deal-mismatch'
  | 'tenant-mismatch';

export type PlatformV7AuditReadDecision = Readonly<{
  allowed: boolean;
  reason: PlatformV7AuditReadDecisionReason;
  view: PlatformV7AuditReadModelView | null;
}>;

export const PLATFORM_V7_AUDIT_READ_MODEL_EVENTS: readonly PlatformV7AuditEvent[] = Object.freeze([
  Object.freeze({
    eventId: 'AUDIT-DL-9102-DEAL-001',
    kind: 'deal-created',
    actor: Object.freeze({ actorId: 'ROLE-OPERATOR-001', role: 'operator', actorType: 'platform-role' }),
    target: Object.freeze({ targetId: 'DL-9102', targetType: 'deal', dealId: 'DL-9102', tenantId: 'TENANT-GRAIN-001' }),
    reason: 'Deal execution boundary opened inside the controlled-pilot source-of-truth.',
    evidenceReferences: Object.freeze([]),
    occurredAtIso: '2026-06-26T08:00:00.000Z',
    source: 'controlled-pilot-audit-read-model',
  }),
  Object.freeze({
    eventId: 'AUDIT-DL-9102-LEDGER-RESERVE-001',
    kind: 'ledger-reserved',
    actor: Object.freeze({ actorId: 'ROLE-BANK-001', role: 'bank', actorType: 'platform-role' }),
    target: Object.freeze({ targetId: 'LEDGER-DL-9102-RESERVE-001', targetType: 'ledger-entry', dealId: 'DL-9102', tenantId: 'TENANT-GRAIN-001' }),
    reason: 'Integer-money reserve basis is visible in the read-only ledger source boundary.',
    evidenceReferences: Object.freeze([
      Object.freeze({ evidenceId: 'EVID-DL-9102-MONEY-BASIS-001', evidenceType: 'money-basis', source: 'controlled-pilot-evidence-read-model' }),
    ]),
    occurredAtIso: '2026-06-26T08:05:00.000Z',
    source: 'controlled-pilot-audit-read-model',
  }),
  Object.freeze({
    eventId: 'AUDIT-DL-9102-LEDGER-HOLD-001',
    kind: 'ledger-held',
    actor: Object.freeze({ actorId: 'ROLE-COMPLIANCE-001', role: 'compliance', actorType: 'platform-role' }),
    target: Object.freeze({ targetId: 'LEDGER-DL-9102-HOLD-001', targetType: 'ledger-entry', dealId: 'DL-9102', tenantId: 'TENANT-GRAIN-001' }),
    reason: 'Dispute hold is recorded as read-model evidence only; this boundary does not release or move money.',
    evidenceReferences: Object.freeze([
      Object.freeze({ evidenceId: 'EVID-DL-9102-WEIGHING-001', evidenceType: 'weighing-note', source: 'controlled-pilot-evidence-read-model' }),
      Object.freeze({ evidenceId: 'EVID-DL-9102-QUALITY-001', evidenceType: 'quality-report', source: 'controlled-pilot-evidence-read-model' }),
    ]),
    occurredAtIso: '2026-06-26T08:10:00.000Z',
    source: 'controlled-pilot-audit-read-model',
  }),
  Object.freeze({
    eventId: 'AUDIT-DL-9102-DISPUTE-001',
    kind: 'dispute-opened',
    actor: Object.freeze({ actorId: 'ROLE-ARBITRATOR-001', role: 'arbitrator', actorType: 'platform-role' }),
    target: Object.freeze({ targetId: 'DSP-DL-9102-WEIGHT', targetType: 'dispute-case', dealId: 'DL-9102', tenantId: 'TENANT-GRAIN-001' }),
    reason: 'Dispute case is linked to evidence references for audit visibility only.',
    evidenceReferences: Object.freeze([
      Object.freeze({ evidenceId: 'EVID-DL-9102-ROUTE-001', evidenceType: 'route-proof', source: 'controlled-pilot-evidence-read-model' }),
    ]),
    occurredAtIso: '2026-06-26T08:15:00.000Z',
    source: 'controlled-pilot-audit-read-model',
  }),
]) as readonly PlatformV7AuditEvent[];

export function platformV7AuditEventsForDeal(dealId: string): readonly PlatformV7AuditEvent[] {
  return Object.freeze(PLATFORM_V7_AUDIT_READ_MODEL_EVENTS.filter((event) => event.target.dealId === dealId));
}

export function platformV7AuditReadModelViewFor(dealId: string, tenantId: string): PlatformV7AuditReadModelView | null {
  const eventsForDeal = platformV7AuditEventsForDeal(dealId);
  const events = eventsForDeal.filter((event) => event.target.tenantId === tenantId);

  if (events.length === 0) {
    return null;
  }

  const evidenceReferenceCount = events.reduce((total, event) => total + event.evidenceReferences.length, 0);
  const ledgerDecision = platformV7LedgerSourceDecision('compliance', dealId, tenantId);
  const hasMoneyHold = ledgerDecision.allowed && ledgerDecision.view !== null ? platformV7LedgerHasHeldMoney(ledgerDecision.view) : false;

  return Object.freeze({
    dealId,
    tenantId,
    events: Object.freeze([...events]),
    evidenceReferenceCount,
    hasMoneyHold,
    source: 'controlled-pilot-audit-read-model',
  });
}

export function platformV7AuditReadModelDecision(
  role: PlatformV7Role,
  dealId: string,
  tenantId: string,
): PlatformV7AuditReadDecision {
  const canonicalDecision = platformV7CanonicalReadDecision(role, 'auditEntry');

  if (!canonicalDecision.allowed) {
    return { allowed: false, reason: 'canonical-audit-entry-rejected', view: null };
  }

  const eventsForDeal = platformV7AuditEventsForDeal(dealId);

  if (eventsForDeal.length === 0) {
    return { allowed: false, reason: 'deal-mismatch', view: null };
  }

  if (eventsForDeal.every((event) => event.target.tenantId !== tenantId)) {
    return { allowed: false, reason: 'tenant-mismatch', view: null };
  }

  const ledgerDecision = platformV7LedgerSourceDecision('compliance', dealId, tenantId);

  if (!ledgerDecision.allowed) {
    return { allowed: false, reason: 'ledger-source-rejected', view: null };
  }

  const view = platformV7AuditReadModelViewFor(dealId, tenantId);

  if (view === null) {
    return { allowed: false, reason: 'tenant-mismatch', view: null };
  }

  return { allowed: true, reason: 'audit-read-model-selected', view };
}

export function platformV7AssertAuditReadModelDecision(role: PlatformV7Role, dealId: string, tenantId: string): void {
  const decision = platformV7AuditReadModelDecision(role, dealId, tenantId);

  if (!decision.allowed) {
    throw new Error(`platform-v7 audit read-model rejected: ${decision.reason}`);
  }
}
