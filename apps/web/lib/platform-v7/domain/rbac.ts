import type { CriticalAction } from './canonical';
import type { ParticipantRole } from './types';

export type PermissionVerb = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'sign' | 'export' | 'override';
export type PermissionScope = 'deal' | 'lot' | 'rfq' | 'offer' | 'document' | 'money' | 'dispute' | 'evidence' | 'counterparty' | 'integration' | 'audit' | 'settings';

export interface Permission {
  readonly scope: PermissionScope;
  readonly verb: PermissionVerb;
}

export interface AccessDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiresSecondFactor?: boolean;
  readonly requiresAudit?: boolean;
}

export const BASE_ROLE_PERMISSIONS: Record<ParticipantRole, readonly Permission[]> = {
  seller: [
    { scope: 'lot', verb: 'create' },
    { scope: 'lot', verb: 'read' },
    { scope: 'lot', verb: 'update' },
    { scope: 'deal', verb: 'read' },
    { scope: 'document', verb: 'create' },
    { scope: 'document', verb: 'sign' },
    { scope: 'dispute', verb: 'create' },
    { scope: 'evidence', verb: 'create' },
  ],
  buyer: [
    { scope: 'lot', verb: 'read' },
    { scope: 'rfq', verb: 'create' },
    { scope: 'offer', verb: 'create' },
    { scope: 'deal', verb: 'read' },
    { scope: 'money', verb: 'create' },
    { scope: 'document', verb: 'sign' },
    { scope: 'dispute', verb: 'create' },
    { scope: 'evidence', verb: 'create' },
  ],
  operator: [
    { scope: 'deal', verb: 'read' },
    { scope: 'deal', verb: 'update' },
    { scope: 'document', verb: 'read' },
    { scope: 'money', verb: 'read' },
    { scope: 'dispute', verb: 'read' },
    { scope: 'audit', verb: 'read' },
  ],
  driver: [
    { scope: 'deal', verb: 'read' },
    { scope: 'evidence', verb: 'create' },
    { scope: 'document', verb: 'sign' },
  ],
  carrier: [
    { scope: 'deal', verb: 'read' },
    { scope: 'document', verb: 'create' },
    { scope: 'document', verb: 'sign' },
  ],
  logistics: [
    { scope: 'deal', verb: 'read' },
    { scope: 'deal', verb: 'update' },
    { scope: 'evidence', verb: 'read' },
  ],
  elevator: [
    { scope: 'deal', verb: 'read' },
    { scope: 'document', verb: 'create' },
    { scope: 'evidence', verb: 'create' },
  ],
  lab: [
    { scope: 'deal', verb: 'read' },
    { scope: 'document', verb: 'create' },
    { scope: 'evidence', verb: 'create' },
  ],
  surveyor: [
    { scope: 'deal', verb: 'read' },
    { scope: 'document', verb: 'create' },
    { scope: 'evidence', verb: 'create' },
  ],
  bank: [
    { scope: 'deal', verb: 'read' },
    { scope: 'money', verb: 'read' },
    { scope: 'money', verb: 'approve' },
    { scope: 'audit', verb: 'read' },
  ],
  compliance: [
    { scope: 'counterparty', verb: 'read' },
    { scope: 'counterparty', verb: 'approve' },
    { scope: 'deal', verb: 'read' },
    { scope: 'audit', verb: 'read' },
  ],
  arbitrator: [
    { scope: 'dispute', verb: 'read' },
    { scope: 'dispute', verb: 'approve' },
    { scope: 'evidence', verb: 'read' },
    { scope: 'money', verb: 'approve' },
  ],
  admin: [
    { scope: 'settings', verb: 'update' },
    { scope: 'audit', verb: 'read' },
    { scope: 'integration', verb: 'update' },
    { scope: 'deal', verb: 'override' },
  ],
  investor_readonly: [
    { scope: 'deal', verb: 'read' },
    { scope: 'money', verb: 'read' },
  ],
  region_readonly: [
    { scope: 'deal', verb: 'read' },
  ],
  external_auditor_readonly: [
    { scope: 'deal', verb: 'read' },
    { scope: 'document', verb: 'read' },
    { scope: 'audit', verb: 'read' },
  ],
};

export const CRITICAL_ACTION_ROLES: Record<CriticalAction, readonly ParticipantRole[]> = {
  RESERVE_MONEY: ['buyer', 'bank'],
  HOLD_MONEY: ['bank'],
  REQUEST_RELEASE: ['operator', 'seller', 'bank'],
  EXECUTE_RELEASE: ['bank'],
  REQUEST_REFUND: ['operator', 'buyer', 'arbitrator'],
  EXECUTE_REFUND: ['bank'],
  SIGN_DOCUMENT: ['seller', 'buyer', 'driver', 'carrier', 'elevator', 'lab', 'surveyor'],
  REPLACE_SIGNED_DOCUMENT: ['operator', 'admin'],
  CHANGE_BANK_DETAILS: ['seller', 'buyer', 'admin'],
  CLOSE_DISPUTE: ['arbitrator'],
  APPROVE_DISPUTE_DECISION: ['arbitrator'],
  OVERRIDE_BLOCKER: ['admin'],
  FREEZE_COUNTERPARTY: ['compliance', 'admin'],
  EXPORT_SENSITIVE_DATA: ['admin', 'external_auditor_readonly'],
};

export function hasPermission(role: ParticipantRole, permission: Permission): boolean {
  return BASE_ROLE_PERMISSIONS[role].some((item) => item.scope === permission.scope && item.verb === permission.verb);
}

export function canPerformCriticalAction(role: ParticipantRole, action: CriticalAction): AccessDecision {
  const allowed = CRITICAL_ACTION_ROLES[action].includes(role);
  const requiresSecondFactor = ['EXECUTE_RELEASE', 'EXECUTE_REFUND', 'CHANGE_BANK_DETAILS', 'APPROVE_DISPUTE_DECISION'].includes(action);

  return {
    allowed,
    reason: allowed ? 'role-allowed' : 'role-not-allowed',
    requiresSecondFactor,
    requiresAudit: true,
  };
}
