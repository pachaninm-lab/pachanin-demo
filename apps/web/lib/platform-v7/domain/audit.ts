import type { IsoDateTime, ParticipantRole } from './types';
import type { CriticalAction } from './canonical';

export type AuditResult = 'success' | 'failed' | 'blocked' | 'pending_review';
export type AuditTargetType = 'deal' | 'lot' | 'rfq' | 'offer' | 'document' | 'money' | 'dispute' | 'evidence' | 'counterparty' | 'integration' | 'system';

export interface AuditActor {
  readonly id: string;
  readonly name: string;
  readonly role: ParticipantRole;
  readonly organizationId?: string;
  readonly organizationName?: string;
}

export interface AuditEvent {
  readonly id: string;
  readonly at: IsoDateTime;
  readonly actor: AuditActor;
  readonly action: string | CriticalAction;
  readonly targetType: AuditTargetType;
  readonly targetId: string;
  readonly result: AuditResult;
  readonly reason?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly moneyImpact?: number;
  readonly riskImpact?: number;
  readonly linkedDealId?: string;
  readonly ip?: string;
  readonly userAgent?: string;
}

export function createAuditEvent(input: Omit<AuditEvent, 'id' | 'at'> & { id?: string; at?: IsoDateTime }): AuditEvent {
  return {
    id: input.id ?? `audit-${Date.now()}`,
    at: input.at ?? new Date().toISOString(),
    actor: input.actor,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    result: input.result,
    reason: input.reason,
    before: input.before,
    after: input.after,
    moneyImpact: input.moneyImpact,
    riskImpact: input.riskImpact,
    linkedDealId: input.linkedDealId,
    ip: input.ip,
    userAgent: input.userAgent,
  };
}

export function isMoneyImpactingAuditEvent(event: AuditEvent): boolean {
  return typeof event.moneyImpact === 'number' && event.moneyImpact !== 0;
}

export function isCriticalAuditAction(event: AuditEvent): boolean {
  return [
    'RESERVE_MONEY',
    'HOLD_MONEY',
    'REQUEST_RELEASE',
    'EXECUTE_RELEASE',
    'REQUEST_REFUND',
    'EXECUTE_REFUND',
    'CHANGE_BANK_DETAILS',
    'CLOSE_DISPUTE',
    'APPROVE_DISPUTE_DECISION',
    'OVERRIDE_BLOCKER',
  ].includes(String(event.action));
}
