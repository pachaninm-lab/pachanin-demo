import { getPlatformV7ApiBoundary } from './api-boundary-contracts';
import type { PlatformV7AuditEvent } from './audit-event-helper';
import { isPlatformV7AuditEventAppendOnly, validatePlatformV7AuditEvent } from './audit-event-helper';
import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';

export type PlatformV7ServerAuditBoundaryStatus =
  | 'not_required_read_boundary'
  | 'blocked_missing_audit_event'
  | 'blocked_invalid_audit_event'
  | 'blocked_non_append_only_audit_event'
  | 'blocked_money_audit_incomplete'
  | 'ready_for_append_only_audit_record';

export type PlatformV7ServerAuditBoundaryResult = {
  readonly status: PlatformV7ServerAuditBoundaryStatus;
  readonly canProceed: boolean;
  readonly requiresAuditRecord: boolean;
  readonly auditEventValid: boolean;
  readonly appendOnly: boolean;
  readonly moneyAuditComplete: boolean;
  readonly reason: string;
};

export function checkPlatformV7ServerAuditBoundary(
  response: PlatformV7ServerActionContractResponse,
  auditEvent?: PlatformV7AuditEvent,
): PlatformV7ServerAuditBoundaryResult {
  const boundary = getPlatformV7ApiBoundary(response.boundaryId);

  if (boundary?.writesAuditEvent !== true) {
    return {
      status: 'not_required_read_boundary',
      canProceed: true,
      requiresAuditRecord: false,
      auditEventValid: true,
      appendOnly: false,
      moneyAuditComplete: true,
      reason: 'Boundary does not write audit event.',
    };
  }

  if (!auditEvent) {
    return {
      status: 'blocked_missing_audit_event',
      canProceed: false,
      requiresAuditRecord: true,
      auditEventValid: false,
      appendOnly: false,
      moneyAuditComplete: false,
      reason: 'Append-only audit event is required before sensitive server action can proceed.',
    };
  }

  const validation = validatePlatformV7AuditEvent(auditEvent);

  if (!validation.ok) {
    return {
      status: 'blocked_invalid_audit_event',
      canProceed: false,
      requiresAuditRecord: true,
      auditEventValid: false,
      appendOnly: isPlatformV7AuditEventAppendOnly(auditEvent),
      moneyAuditComplete: false,
      reason: validation.issues.join(' '),
    };
  }

  if (!isPlatformV7AuditEventAppendOnly(auditEvent)) {
    return {
      status: 'blocked_non_append_only_audit_event',
      canProceed: false,
      requiresAuditRecord: true,
      auditEventValid: true,
      appendOnly: false,
      moneyAuditComplete: false,
      reason: 'Audit event must be append-only and not user-deletable.',
    };
  }

  if (boundary.affectsMoney && (!auditEvent.affectsMoney || auditEvent.severity !== 'critical')) {
    return {
      status: 'blocked_money_audit_incomplete',
      canProceed: false,
      requiresAuditRecord: true,
      auditEventValid: true,
      appendOnly: true,
      moneyAuditComplete: false,
      reason: 'Money-affecting boundary requires critical money audit event.',
    };
  }

  return {
    status: 'ready_for_append_only_audit_record',
    canProceed: true,
    requiresAuditRecord: true,
    auditEventValid: true,
    appendOnly: true,
    moneyAuditComplete: true,
    reason: 'Audit boundary is ready for durable append-only audit record check.',
  };
}

export function getPlatformV7ServerAuditBoundarySummary(result: PlatformV7ServerAuditBoundaryResult) {
  return {
    status: result.status,
    canProceed: result.canProceed,
    requiresAuditRecord: result.requiresAuditRecord,
    auditEventValid: result.auditEventValid,
    appendOnly: result.appendOnly,
    moneyAuditComplete: result.moneyAuditComplete,
  };
}
