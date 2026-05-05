import { AuditEvent, EntityId, PlatformRole, nowIso } from './core-types';

export interface AuditInput {
  entityType: string;
  entityId: EntityId;
  actorRole: PlatformRole;
  actorId: EntityId;
  action: string;
  dealId?: EntityId;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export function createAuditEvent(input: AuditInput): AuditEvent {
  return {
    id: `AUD-${input.entityType}-${input.entityId}-${input.action}-${Date.now()}`.replace(/[^A-Za-z0-9-]/g, '-'),
    entityType: input.entityType,
    entityId: input.entityId,
    dealId: input.dealId,
    actorRole: input.actorRole,
    actorId: input.actorId,
    action: input.action,
    before: input.before,
    after: input.after,
    reason: input.reason,
    createdAt: nowIso(),
  };
}

export function requireReason(action: string, reason?: string): void {
  const reasonRequired = ['reject_offer', 'cancel_deal_draft', 'override_risk', 'reveal_contact', 'hide_review'];
  if (reasonRequired.includes(action) && !reason?.trim()) {
    throw new Error(`Action ${action} requires a reason`);
  }
}

export function withAudit<T>(input: AuditInput, after: T): { result: T; auditEvent: AuditEvent } {
  requireReason(input.action, input.reason);
  return {
    result: after,
    auditEvent: createAuditEvent({ ...input, after }),
  };
}
