import { StaffAccessMode, StaffPermission } from './staff-access.types';

export const StaffAuthorizationClass = {
  STAFF_SELF_AUTHORITY_READ: 'STAFF_SELF_AUTHORITY_READ',
  STAFF_SELF_GOVERNANCE_MUTATION: 'STAFF_SELF_GOVERNANCE_MUTATION',
  STAFF_EMERGENCY_MUTATION: 'STAFF_EMERGENCY_MUTATION',
  STAFF_PRIVILEGED_READ: 'STAFF_PRIVILEGED_READ',
  STAFF_PRIVILEGED_MUTATION: 'STAFF_PRIVILEGED_MUTATION',
  STAFF_CRITICAL_MUTATION: 'STAFF_CRITICAL_MUTATION',
} as const;

export type StaffAuthorizationClass = typeof StaffAuthorizationClass[keyof typeof StaffAuthorizationClass];

export const StaffAuditClass = {
  STANDARD_READ: 'STANDARD_READ',
  SENSITIVE_READ: 'SENSITIVE_READ',
  MUTATION: 'MUTATION',
  CRITICAL_MUTATION: 'CRITICAL_MUTATION',
} as const;

export type StaffAuditClass = typeof StaffAuditClass[keyof typeof StaffAuditClass];

export type StaffEndpointPolicy = {
  method: 'GET' | 'POST';
  path: string;
  authorizationClass: StaffAuthorizationClass;
  auditClass: StaffAuditClass;
  requiresAccessSession: boolean;
  modes: readonly StaffAccessMode[];
  permissions: readonly StaffPermission[];
  scopeContract: 'ACTOR_ONLY' | 'ACTOR_OWNED_RESOURCE' | 'SERVER_VALIDATED_SCOPE' | 'PRIVILEGED_SCOPE' | 'EMERGENCY_SCOPE';
};

type PolicyOptions = {
  requiresAccessSession?: boolean;
  modes?: readonly StaffAccessMode[];
  permissions?: readonly StaffPermission[];
  scopeContract?: StaffEndpointPolicy['scopeContract'];
};

function policy(
  method: StaffEndpointPolicy['method'],
  path: string,
  authorizationClass: StaffAuthorizationClass,
  auditClass: StaffAuditClass,
  options: PolicyOptions = {},
): StaffEndpointPolicy {
  return {
    method,
    path,
    authorizationClass,
    auditClass,
    requiresAccessSession: options.requiresAccessSession ?? false,
    modes: options.modes ?? [],
    permissions: options.permissions ?? [],
    scopeContract: options.scopeContract ?? 'ACTOR_ONLY',
  };
}

const privileged = (
  method: StaffEndpointPolicy['method'],
  path: string,
  authorizationClass: StaffAuthorizationClass,
  auditClass: StaffAuditClass,
  modes: readonly StaffAccessMode[],
  permissions: readonly StaffPermission[],
  scopeContract: StaffEndpointPolicy['scopeContract'] = 'PRIVILEGED_SCOPE',
) => policy(method, path, authorizationClass, auditClass, {
  requiresAccessSession: true,
  modes,
  permissions,
  scopeContract,
});

export const STAFF_ENDPOINT_POLICIES: readonly StaffEndpointPolicy[] = [
  policy('GET', '/staff/assignments/me', StaffAuthorizationClass.STAFF_SELF_AUTHORITY_READ, StaffAuditClass.STANDARD_READ),
  privileged('GET', '/staff/registration/applications', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_REQUEST_READ]),
  privileged('POST', '/staff/registration/applications/:applicationId/decision', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_REQUEST_APPROVE]),
  privileged('GET', '/staff/assignments', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_ASSIGNMENT_READ]),
  privileged('POST', '/staff/assignments', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_ASSIGNMENT_WRITE]),
  privileged('POST', '/staff/assignments/:id/revoke', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_ASSIGNMENT_WRITE]),
  policy('GET', '/staff/access/requests', StaffAuthorizationClass.STAFF_SELF_AUTHORITY_READ, StaffAuditClass.STANDARD_READ),
  privileged('GET', '/staff/access/requests/review', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_REQUEST_READ]),
  policy('POST', '/staff/access/requests', StaffAuthorizationClass.STAFF_SELF_GOVERNANCE_MUTATION, StaffAuditClass.MUTATION, { scopeContract: 'SERVER_VALIDATED_SCOPE' }),
  privileged('POST', '/staff/access/requests/:id/decision', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_REQUEST_APPROVE]),
  policy('POST', '/staff/access/grants/:id/activate', StaffAuthorizationClass.STAFF_SELF_GOVERNANCE_MUTATION, StaffAuditClass.MUTATION, { scopeContract: 'ACTOR_OWNED_RESOURCE' }),
  policy('GET', '/staff/access/sessions', StaffAuthorizationClass.STAFF_SELF_AUTHORITY_READ, StaffAuditClass.SENSITIVE_READ),
  privileged('GET', '/staff/access/sessions/review', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_SESSION_READ]),
  privileged('POST', '/staff/access/sessions/:id/revoke', StaffAuthorizationClass.STAFF_PRIVILEGED_MUTATION, StaffAuditClass.MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_SESSION_REVOKE]),
  policy('POST', '/staff/access/sessions/:id/end', StaffAuthorizationClass.STAFF_SELF_GOVERNANCE_MUTATION, StaffAuditClass.MUTATION, { scopeContract: 'ACTOR_OWNED_RESOURCE' }),
  policy('POST', '/staff/break-glass/activate', StaffAuthorizationClass.STAFF_EMERGENCY_MUTATION, StaffAuditClass.CRITICAL_MUTATION, { scopeContract: 'EMERGENCY_SCOPE' }),
  privileged('GET', '/staff/break-glass/active', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_SESSION_READ]),
  policy('POST', '/staff/break-glass/:id/end', StaffAuthorizationClass.STAFF_EMERGENCY_MUTATION, StaffAuditClass.CRITICAL_MUTATION, { scopeContract: 'EMERGENCY_SCOPE' }),
  privileged('POST', '/staff/critical-actions', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.ASSISTED, StaffAccessMode.OPERATIONS, StaffAccessMode.JIT_PRIVILEGED], [StaffPermission.CRITICAL_ACTION_REQUEST]),
  privileged('POST', '/staff/critical-actions/:id/decision', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.CRITICAL_ACTION_APPROVE]),
  privileged('POST', '/staff/critical-actions/:id/consume', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.ASSISTED, StaffAccessMode.OPERATIONS, StaffAccessMode.JIT_PRIVILEGED], [StaffPermission.CRITICAL_ACTION_REQUEST]),
  privileged('GET', '/staff/organizations', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.ORGANIZATION_LIST]),
  privileged('GET', '/staff/organizations/:organizationId/users', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.USER_LIST]),
  privileged('GET', '/staff/organizations/:organizationId/cabinet/:role', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.VIEW_AS], [StaffPermission.CABINET_VIEW_AS]),
  privileged('GET', '/staff/audit/events', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.AUDIT_READ]),
  privileged('GET', '/staff/audit/actors/:actorUserId/verify', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.AUDIT_READ]),

  policy('GET', '/staff/capabilities/me', StaffAuthorizationClass.STAFF_SELF_AUTHORITY_READ, StaffAuditClass.SENSITIVE_READ),

  privileged('GET', '/staff/workspaces/support', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.SUPPORT_CASE_READ]),
  privileged('GET', '/staff/workspaces/support/cases', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.ASSISTED], [StaffPermission.SUPPORT_CASE_READ]),
  privileged('POST', '/staff/workspaces/support/cases', StaffAuthorizationClass.STAFF_PRIVILEGED_MUTATION, StaffAuditClass.MUTATION, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.ASSISTED], [StaffPermission.SUPPORT_CASE_UPDATE]),
  privileged('POST', '/staff/workspaces/support/cases/:id/transition', StaffAuthorizationClass.STAFF_PRIVILEGED_MUTATION, StaffAuditClass.MUTATION, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.ASSISTED], [StaffPermission.SUPPORT_CASE_UPDATE]),
  privileged('POST', '/staff/workspaces/support/users/:userId/revoke-sessions', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.ASSISTED], [StaffPermission.USER_SESSION_REVOKE]),
  privileged('POST', '/staff/workspaces/support/users/:userId/recovery', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.ASSISTED], [StaffPermission.USER_ACCESS_RECOVERY_INITIATE]),
  privileged('GET', '/staff/workspaces/operations', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.OPERATIONS], [StaffPermission.DEAL_LIST]),
  privileged('GET', '/staff/workspaces/finance', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED], [StaffPermission.PAYMENT_METADATA_READ]),
  privileged('GET', '/staff/workspaces/diagnostics', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED, StaffAccessMode.BREAK_GLASS], [StaffPermission.DIAGNOSTIC_READ]),
  privileged('GET', '/staff/workspaces/critical-actions/mine', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.ASSISTED, StaffAccessMode.OPERATIONS, StaffAccessMode.JIT_PRIVILEGED], [StaffPermission.CRITICAL_ACTION_REQUEST]),
  privileged('GET', '/staff/workspaces/critical-actions', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.CRITICAL_ACTION_APPROVE]),
  privileged('POST', '/staff/workspaces/critical-actions', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.ASSISTED, StaffAccessMode.OPERATIONS, StaffAccessMode.JIT_PRIVILEGED], [StaffPermission.CRITICAL_ACTION_REQUEST]),
  privileged('POST', '/staff/workspaces/critical-actions/:id/decision', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.CRITICAL_ACTION_APPROVE]),
  privileged('GET', '/staff/workspaces/assignments', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_ASSIGNMENT_READ]),
  privileged('POST', '/staff/workspaces/assignments', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_ASSIGNMENT_WRITE]),
  privileged('POST', '/staff/workspaces/assignments/:id/revoke', StaffAuthorizationClass.STAFF_CRITICAL_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_ASSIGNMENT_WRITE]),
  privileged('GET', '/staff/workspaces/organizations/:organizationId/users', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.USER_LIST]),
  privileged('GET', '/staff/workspaces/break-glass', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.STAFF_SESSION_READ]),
  privileged('POST', '/staff/workspaces/break-glass/:id/end', StaffAuthorizationClass.STAFF_EMERGENCY_MUTATION, StaffAuditClass.CRITICAL_MUTATION, [StaffAccessMode.CONTROL_PLANE, StaffAccessMode.BREAK_GLASS], [StaffPermission.STAFF_SESSION_READ], 'EMERGENCY_SCOPE'),
  privileged('GET', '/staff/workspaces/audit/actors/:actorUserId/verify', StaffAuthorizationClass.STAFF_PRIVILEGED_READ, StaffAuditClass.SENSITIVE_READ, [StaffAccessMode.CONTROL_PLANE], [StaffPermission.AUDIT_READ]),
] as const;

export function staffEndpointPolicyKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

export function findStaffEndpointPolicy(method: string, path: string): StaffEndpointPolicy | undefined {
  const key = staffEndpointPolicyKey(method, path);
  return STAFF_ENDPOINT_POLICIES.find((entry) => staffEndpointPolicyKey(entry.method, entry.path) === key);
}
