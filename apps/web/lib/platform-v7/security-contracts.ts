export type PlatformV7SecurityRole =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'arbitrator'
  | 'compliance'
  | 'operator'
  | 'support_agent'
  | 'executive'
  | 'investor';

export type PlatformV7EntityType =
  | 'batch'
  | 'lot'
  | 'rfq'
  | 'proposal'
  | 'deal'
  | 'money'
  | 'document'
  | 'trip'
  | 'support_case'
  | 'dispute'
  | 'audit_event'
  | 'rating'
  | 'connector'
  | 'bank'
  | 'aggregate_report';

export type PlatformV7Permission =
  | 'read'
  | 'create'
  | 'update'
  | 'approve'
  | 'request_external_check'
  | 'request_bank_action'
  | 'view_money'
  | 'view_documents'
  | 'view_counterparty_private_data'
  | 'view_internal_audit'
  | 'resolve_dispute';

export type PlatformV7GuardDecision = {
  readonly allowed: boolean;
  readonly reason: string;
  readonly requiresAudit: boolean;
};

export type PlatformV7SecurityRule = {
  readonly role: PlatformV7SecurityRole;
  readonly entity: PlatformV7EntityType;
  readonly permissions: readonly PlatformV7Permission[];
};

export const PLATFORM_V7_SECURITY_RULES: readonly PlatformV7SecurityRule[] = [
  { role: 'seller', entity: 'batch', permissions: ['read', 'create', 'update'] },
  { role: 'seller', entity: 'lot', permissions: ['read', 'create', 'update'] },
  { role: 'seller', entity: 'proposal', permissions: ['read', 'approve'] },
  { role: 'seller', entity: 'deal', permissions: ['read'] },
  { role: 'seller', entity: 'money', permissions: ['read', 'view_money'] },
  { role: 'seller', entity: 'document', permissions: ['read', 'create', 'update', 'view_documents'] },
  { role: 'buyer', entity: 'rfq', permissions: ['read', 'create', 'update'] },
  { role: 'buyer', entity: 'lot', permissions: ['read'] },
  { role: 'buyer', entity: 'proposal', permissions: ['read', 'create', 'update'] },
  { role: 'buyer', entity: 'deal', permissions: ['read'] },
  { role: 'buyer', entity: 'money', permissions: ['read', 'view_money', 'request_bank_action'] },
  { role: 'buyer', entity: 'document', permissions: ['read', 'view_documents'] },
  { role: 'logistics', entity: 'trip', permissions: ['read', 'create', 'update'] },
  { role: 'logistics', entity: 'document', permissions: ['read', 'create', 'update', 'view_documents'] },
  { role: 'driver', entity: 'trip', permissions: ['read', 'update'] },
  { role: 'driver', entity: 'document', permissions: ['read', 'create'] },
  { role: 'elevator', entity: 'trip', permissions: ['read', 'update'] },
  { role: 'elevator', entity: 'document', permissions: ['read', 'create', 'update', 'view_documents'] },
  { role: 'lab', entity: 'document', permissions: ['read', 'create', 'update', 'view_documents'] },
  { role: 'surveyor', entity: 'document', permissions: ['read', 'create', 'update', 'view_documents'] },
  { role: 'bank', entity: 'money', permissions: ['read', 'view_money', 'request_bank_action', 'approve'] },
  { role: 'bank', entity: 'document', permissions: ['read', 'view_documents'] },
  { role: 'arbitrator', entity: 'dispute', permissions: ['read', 'update', 'resolve_dispute'] },
  { role: 'arbitrator', entity: 'document', permissions: ['read', 'view_documents'] },
  { role: 'compliance', entity: 'connector', permissions: ['read', 'request_external_check'] },
  { role: 'compliance', entity: 'document', permissions: ['read', 'view_documents', 'request_external_check'] },
  { role: 'operator', entity: 'batch', permissions: ['read', 'update', 'view_internal_audit'] },
  { role: 'operator', entity: 'lot', permissions: ['read', 'update', 'view_internal_audit'] },
  { role: 'operator', entity: 'rfq', permissions: ['read', 'update', 'view_internal_audit'] },
  { role: 'operator', entity: 'proposal', permissions: ['read', 'update', 'view_internal_audit'] },
  { role: 'operator', entity: 'deal', permissions: ['read', 'update', 'view_internal_audit'] },
  { role: 'operator', entity: 'money', permissions: ['read', 'view_money', 'request_bank_action', 'view_internal_audit'] },
  { role: 'operator', entity: 'document', permissions: ['read', 'update', 'view_documents', 'view_internal_audit'] },
  { role: 'operator', entity: 'support_case', permissions: ['read', 'create', 'update', 'view_internal_audit'] },
  { role: 'support_agent', entity: 'deal', permissions: ['read'] },
  { role: 'support_agent', entity: 'support_case', permissions: ['read', 'create', 'update'] },
  { role: 'executive', entity: 'aggregate_report', permissions: ['read'] },
  { role: 'investor', entity: 'aggregate_report', permissions: ['read'] },
  { role: 'investor', entity: 'rating', permissions: ['read'] },
];

export const PLATFORM_V7_DRIVER_FORBIDDEN_ENTITIES: readonly PlatformV7EntityType[] = [
  'money',
  'proposal',
  'rfq',
  'rating',
  'connector',
  'audit_event',
  'deal',
  'bank',
  'support_case',
];

export const PLATFORM_V7_SENSITIVE_PERMISSIONS: readonly PlatformV7Permission[] = [
  'approve',
  'request_external_check',
  'request_bank_action',
  'view_money',
  'view_counterparty_private_data',
  'view_internal_audit',
  'resolve_dispute',
];

export function canPlatformV7Role(
  role: PlatformV7SecurityRole,
  entity: PlatformV7EntityType,
  permission: PlatformV7Permission,
): PlatformV7GuardDecision {
  if (role === 'driver' && PLATFORM_V7_DRIVER_FORBIDDEN_ENTITIES.includes(entity)) {
    return { allowed: false, reason: 'driver_field_scope_only', requiresAudit: true };
  }

  const rule = PLATFORM_V7_SECURITY_RULES.find((item) => item.role === role && item.entity === entity);
  const allowed = Boolean(rule?.permissions.includes(permission));

  return {
    allowed,
    reason: allowed ? 'allowed_by_role_policy' : 'not_allowed_by_role_policy',
    requiresAudit: PLATFORM_V7_SENSITIVE_PERMISSIONS.includes(permission),
  };
}
