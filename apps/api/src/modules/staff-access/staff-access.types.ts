export const StaffRole = {
  PLATFORM_OWNER: 'PLATFORM_OWNER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SUPPORT_L1: 'SUPPORT_L1',
  SUPPORT_L2: 'SUPPORT_L2',
  OPERATIONS_AGENT: 'OPERATIONS_AGENT',
  OPERATIONS_SUPERVISOR: 'OPERATIONS_SUPERVISOR',
  FINANCE_OPS: 'FINANCE_OPS',
  COMPLIANCE_STAFF: 'COMPLIANCE_STAFF',
  DEVELOPER: 'DEVELOPER',
  SRE_ONCALL: 'SRE_ONCALL',
  SECURITY_AUDITOR: 'SECURITY_AUDITOR',
  BREAK_GLASS_ADMIN: 'BREAK_GLASS_ADMIN',
} as const;

export type StaffRole = typeof StaffRole[keyof typeof StaffRole];

export const StaffAccessMode = {
  CONTROL_PLANE: 'CONTROL_PLANE',
  VIEW_AS: 'VIEW_AS',
  ASSISTED: 'ASSISTED',
  OPERATIONS: 'OPERATIONS',
  JIT_PRIVILEGED: 'JIT_PRIVILEGED',
  BREAK_GLASS: 'BREAK_GLASS',
} as const;

export type StaffAccessMode = typeof StaffAccessMode[keyof typeof StaffAccessMode];

export const StaffPermission = {
  ORGANIZATION_LIST: 'organization:list',
  ORGANIZATION_READ: 'organization:read',
  USER_LIST: 'user:list',
  USER_READ: 'user:read',
  USER_SESSION_REVOKE: 'user:session:revoke',
  USER_ACCESS_RECOVERY_INITIATE: 'user:access-recovery:initiate',
  DEAL_LIST: 'deal:list',
  DEAL_READ: 'deal:read',
  DEAL_BLOCKER_READ: 'deal:blocker:read',
  DEAL_OPERATION_RETRY: 'deal:operation:retry',
  SUPPORT_CASE_READ: 'support-case:read',
  SUPPORT_CASE_UPDATE: 'support-case:update',
  DOCUMENT_METADATA_READ: 'document:metadata:read',
  DOCUMENT_CONTENT_READ: 'document:content:read',
  PAYMENT_METADATA_READ: 'payment:metadata:read',
  PAYMENT_RECONCILIATION_READ: 'payment:reconciliation:read',
  PAYMENT_MANUAL_REVIEW: 'payment:manual-review',
  AUDIT_READ: 'audit:read',
  AUDIT_EXPORT: 'audit:export',
  DIAGNOSTIC_READ: 'diagnostic:read',
  DEPLOYMENT_READ: 'deployment:read',
  FEATURE_FLAG_READ: 'feature-flag:read',
  FEATURE_FLAG_WRITE: 'feature-flag:write',
  STAFF_ASSIGNMENT_READ: 'staff-assignment:read',
  STAFF_ASSIGNMENT_WRITE: 'staff-assignment:write',
  STAFF_REQUEST_READ: 'staff-request:read',
  STAFF_REQUEST_APPROVE: 'staff-request:approve',
  STAFF_SESSION_READ: 'staff-session:read',
  STAFF_SESSION_REVOKE: 'staff-session:revoke',
  CABINET_VIEW_AS: 'cabinet:view-as',
  CABINET_ASSISTED_ACTION: 'cabinet:assisted-action',
  BREAK_GLASS_ACTIVATE: 'break-glass:activate',
  CRITICAL_ACTION_REQUEST: 'critical-action:request',
  CRITICAL_ACTION_APPROVE: 'critical-action:approve',
  COMMODITY_PROFILE_LIFECYCLE_MANAGE: 'commodity-profile:lifecycle:manage',
} as const;

export type StaffPermission = typeof StaffPermission[keyof typeof StaffPermission];

export const ALLOWED_STAFF_CRITICAL_ACTIONS = new Set<string>([
  'deal:operation:retry',
  'user:session:revoke',
  'user:mfa:reset',
  'user:access-recovery:initiate',
  'payment:manual-review',
  'feature-flag:write',
]);

export const FORBIDDEN_STAFF_ACTIONS = new Set<string>([
  'payment:reserve',
  'payment:release',
  'payment:beneficiary-change',
  'bank-callback:confirm',
  'document:sign',
  'lab:finalize',
  'acceptance:sign',
  'arbitration:decide',
  'evidence:delete',
]);

export const ROLE_PERMISSION_CEILING: Readonly<Record<StaffRole, readonly StaffPermission[]>> = {
  PLATFORM_OWNER: Object.values(StaffPermission),
  PLATFORM_ADMIN: [
    StaffPermission.ORGANIZATION_LIST,
    StaffPermission.ORGANIZATION_READ,
    StaffPermission.USER_LIST,
    StaffPermission.USER_READ,
    StaffPermission.USER_SESSION_REVOKE,
    StaffPermission.USER_ACCESS_RECOVERY_INITIATE,
    StaffPermission.DEAL_LIST,
    StaffPermission.DEAL_READ,
    StaffPermission.DEAL_BLOCKER_READ,
    StaffPermission.AUDIT_READ,
    StaffPermission.STAFF_ASSIGNMENT_READ,
    StaffPermission.STAFF_ASSIGNMENT_WRITE,
    StaffPermission.STAFF_REQUEST_READ,
    StaffPermission.STAFF_REQUEST_APPROVE,
    StaffPermission.STAFF_SESSION_READ,
    StaffPermission.STAFF_SESSION_REVOKE,
    StaffPermission.CABINET_VIEW_AS,
    StaffPermission.COMMODITY_PROFILE_LIFECYCLE_MANAGE,
    StaffPermission.CRITICAL_ACTION_REQUEST,
    StaffPermission.CRITICAL_ACTION_APPROVE,
  ],
  SUPPORT_L1: [
    StaffPermission.ORGANIZATION_READ,
    StaffPermission.USER_READ,
    StaffPermission.USER_ACCESS_RECOVERY_INITIATE,
    StaffPermission.DEAL_READ,
    StaffPermission.DEAL_BLOCKER_READ,
    StaffPermission.SUPPORT_CASE_READ,
    StaffPermission.SUPPORT_CASE_UPDATE,
    StaffPermission.DOCUMENT_METADATA_READ,
  ],
  SUPPORT_L2: [
    StaffPermission.ORGANIZATION_READ,
    StaffPermission.USER_READ,
    StaffPermission.USER_SESSION_REVOKE,
    StaffPermission.USER_ACCESS_RECOVERY_INITIATE,
    StaffPermission.DEAL_READ,
    StaffPermission.DEAL_BLOCKER_READ,
    StaffPermission.SUPPORT_CASE_READ,
    StaffPermission.SUPPORT_CASE_UPDATE,
    StaffPermission.DOCUMENT_METADATA_READ,
    StaffPermission.DOCUMENT_CONTENT_READ,
    StaffPermission.CABINET_VIEW_AS,
    StaffPermission.CABINET_ASSISTED_ACTION,
    StaffPermission.DIAGNOSTIC_READ,
  ],
  OPERATIONS_AGENT: [
    StaffPermission.ORGANIZATION_READ,
    StaffPermission.USER_READ,
    StaffPermission.DEAL_LIST,
    StaffPermission.DEAL_READ,
    StaffPermission.DEAL_BLOCKER_READ,
    StaffPermission.DEAL_OPERATION_RETRY,
    StaffPermission.DOCUMENT_METADATA_READ,
    StaffPermission.CABINET_VIEW_AS,
    StaffPermission.CRITICAL_ACTION_REQUEST,
  ],
  OPERATIONS_SUPERVISOR: [
    StaffPermission.ORGANIZATION_READ,
    StaffPermission.USER_READ,
    StaffPermission.DEAL_LIST,
    StaffPermission.DEAL_READ,
    StaffPermission.DEAL_BLOCKER_READ,
    StaffPermission.DEAL_OPERATION_RETRY,
    StaffPermission.DOCUMENT_METADATA_READ,
    StaffPermission.DOCUMENT_CONTENT_READ,
    StaffPermission.PAYMENT_METADATA_READ,
    StaffPermission.PAYMENT_RECONCILIATION_READ,
    StaffPermission.PAYMENT_MANUAL_REVIEW,
    StaffPermission.CABINET_VIEW_AS,
    StaffPermission.STAFF_REQUEST_READ,
    StaffPermission.STAFF_REQUEST_APPROVE,
    StaffPermission.COMMODITY_PROFILE_LIFECYCLE_MANAGE,
    StaffPermission.CRITICAL_ACTION_REQUEST,
    StaffPermission.CRITICAL_ACTION_APPROVE,
  ],
  FINANCE_OPS: [
    StaffPermission.ORGANIZATION_READ,
    StaffPermission.DEAL_READ,
    StaffPermission.DOCUMENT_METADATA_READ,
    StaffPermission.PAYMENT_METADATA_READ,
    StaffPermission.PAYMENT_RECONCILIATION_READ,
    StaffPermission.PAYMENT_MANUAL_REVIEW,
    StaffPermission.AUDIT_READ,
    StaffPermission.CRITICAL_ACTION_REQUEST,
    StaffPermission.CRITICAL_ACTION_APPROVE,
  ],
  COMPLIANCE_STAFF: [
    StaffPermission.ORGANIZATION_LIST,
    StaffPermission.ORGANIZATION_READ,
    StaffPermission.USER_LIST,
    StaffPermission.USER_READ,
    StaffPermission.DEAL_LIST,
    StaffPermission.DEAL_READ,
    StaffPermission.DOCUMENT_METADATA_READ,
    StaffPermission.DOCUMENT_CONTENT_READ,
    StaffPermission.PAYMENT_METADATA_READ,
    StaffPermission.AUDIT_READ,
    StaffPermission.AUDIT_EXPORT,
    StaffPermission.CABINET_VIEW_AS,
    StaffPermission.COMMODITY_PROFILE_LIFECYCLE_MANAGE,
    StaffPermission.STAFF_REQUEST_READ,
    StaffPermission.STAFF_REQUEST_APPROVE,
    StaffPermission.CRITICAL_ACTION_APPROVE,
  ],
  DEVELOPER: [
    StaffPermission.DIAGNOSTIC_READ,
    StaffPermission.DEPLOYMENT_READ,
    StaffPermission.FEATURE_FLAG_READ,
  ],
  SRE_ONCALL: [
    StaffPermission.DIAGNOSTIC_READ,
    StaffPermission.DEPLOYMENT_READ,
    StaffPermission.FEATURE_FLAG_READ,
    StaffPermission.FEATURE_FLAG_WRITE,
    StaffPermission.BREAK_GLASS_ACTIVATE,
  ],
  SECURITY_AUDITOR: [
    StaffPermission.ORGANIZATION_READ,
    StaffPermission.USER_READ,
    StaffPermission.DEAL_READ,
    StaffPermission.PAYMENT_METADATA_READ,
    StaffPermission.AUDIT_READ,
    StaffPermission.AUDIT_EXPORT,
    StaffPermission.STAFF_ASSIGNMENT_READ,
    StaffPermission.STAFF_REQUEST_READ,
    StaffPermission.STAFF_SESSION_READ,
  ],
  BREAK_GLASS_ADMIN: [
    StaffPermission.DIAGNOSTIC_READ,
    StaffPermission.DEPLOYMENT_READ,
    StaffPermission.FEATURE_FLAG_READ,
    StaffPermission.FEATURE_FLAG_WRITE,
    StaffPermission.BREAK_GLASS_ACTIVATE,
  ],
};

export const MODE_MAX_DURATION_SECONDS: Readonly<Record<StaffAccessMode, number>> = {
  CONTROL_PLANE: 3600,
  VIEW_AS: 3600,
  ASSISTED: 1800,
  OPERATIONS: 3600,
  JIT_PRIVILEGED: 3600,
  BREAK_GLASS: 900,
};

export const MODES_REQUIRING_APPROVAL = new Set<StaffAccessMode>([
  StaffAccessMode.ASSISTED,
  StaffAccessMode.OPERATIONS,
  StaffAccessMode.JIT_PRIVILEGED,
]);

export const MODES_REQUIRING_RECENT_MFA = new Set<StaffAccessMode>(Object.values(StaffAccessMode));

export type StaffAssignment = {
  id: string;
  userId: string;
  role: StaffRole;
  status: 'ELIGIBLE' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  validFrom: Date;
  validUntil: Date | null;
};

export type StaffAccessContext = {
  accessSessionId: string;
  grantId: string;
  actorUserId: string;
  staffRole: StaffRole;
  accessMode: StaffAccessMode;
  permissions: StaffPermission[];
  effectiveTenantId: string | null;
  effectiveOrganizationId: string | null;
  effectiveUserId: string | null;
  effectiveRole: string | null;
  targetDealId?: string | null;
  reason: string;
  ticketId: string;
  expiresAt: Date;
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && Object.values(StaffRole).includes(value as StaffRole);
}

export function isStaffPermission(value: unknown): value is StaffPermission {
  return typeof value === 'string' && Object.values(StaffPermission).includes(value as StaffPermission);
}

export function isStaffAccessMode(value: unknown): value is StaffAccessMode {
  return typeof value === 'string' && Object.values(StaffAccessMode).includes(value as StaffAccessMode);
}
