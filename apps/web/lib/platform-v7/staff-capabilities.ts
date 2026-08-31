export type StaffCapabilitiesContract = {
  identity: { id: string; email: string; fullName: string | null };
  assignments: Array<{ id: string; role: string; status: string; validFrom: string; validUntil: string | null }>;
  roles: string[];
  capabilities: string[];
  workspaces: string[];
  scopes: Array<{
    accessSessionId: string;
    accessMode: string;
    effectiveTenantId: string | null;
    effectiveOrganizationId: string | null;
    effectiveUserId: string | null;
    effectiveRole: string | null;
    targetDealId: string | null;
    expiresAt: string;
  }>;
  authenticationAssurance: { mfaVerified: true; mfaVerifiedAt: string | null; recentMfa: boolean };
  activeAccessSessions: Array<{
    accessSessionId: string;
    staffRole: string;
    accessMode: string;
    permissions: string[];
    effectiveTenantId: string | null;
    effectiveOrganizationId: string | null;
    effectiveUserId: string | null;
    effectiveRole: string | null;
    targetDealId: string | null;
    mfaLevel: string;
    expiresAt: string;
  }>;
  pendingApprovals: { total: number; staffAccessRequests: number; criticalActions: number };
};

const ACCESS_MODES = new Set(['CONTROL_PLANE', 'VIEW_AS', 'ASSISTED', 'OPERATIONS', 'JIT_PRIVILEGED', 'BREAK_GLASS']);
const MFA_LEVELS = new Set(['TOTP', 'BACKUP', 'WEBAUTHN']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function isUniqueStringArray(value: unknown): value is string[] {
  return isStringArray(value) && new Set(value).size === value.length;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function safeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseAssignment(value: unknown): StaffCapabilitiesContract['assignments'][number] | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' || !value.id
    || typeof value.role !== 'string' || !value.role
    || typeof value.status !== 'string' || !value.status
    || typeof value.validFrom !== 'string' || !value.validFrom
    || !nullableString(value.validUntil)
  ) return null;
  return { id: value.id, role: value.role, status: value.status, validFrom: value.validFrom, validUntil: value.validUntil };
}

function parseScope(value: unknown): StaffCapabilitiesContract['scopes'][number] | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.accessSessionId !== 'string' || !value.accessSessionId
    || typeof value.accessMode !== 'string' || !ACCESS_MODES.has(value.accessMode)
    || !nullableString(value.effectiveTenantId)
    || !nullableString(value.effectiveOrganizationId)
    || !nullableString(value.effectiveUserId)
    || !nullableString(value.effectiveRole)
    || !nullableString(value.targetDealId)
    || typeof value.expiresAt !== 'string' || !value.expiresAt
  ) return null;
  return {
    accessSessionId: value.accessSessionId,
    accessMode: value.accessMode,
    effectiveTenantId: value.effectiveTenantId,
    effectiveOrganizationId: value.effectiveOrganizationId,
    effectiveUserId: value.effectiveUserId,
    effectiveRole: value.effectiveRole,
    targetDealId: value.targetDealId,
    expiresAt: value.expiresAt,
  };
}

function parseSession(value: unknown): StaffCapabilitiesContract['activeAccessSessions'][number] | null {
  if (!isRecord(value) || !isUniqueStringArray(value.permissions)) return null;
  if (
    typeof value.accessSessionId !== 'string' || !value.accessSessionId
    || typeof value.staffRole !== 'string' || !value.staffRole
    || typeof value.accessMode !== 'string' || !ACCESS_MODES.has(value.accessMode)
    || !nullableString(value.effectiveTenantId)
    || !nullableString(value.effectiveOrganizationId)
    || !nullableString(value.effectiveUserId)
    || !nullableString(value.effectiveRole)
    || !nullableString(value.targetDealId)
    || typeof value.mfaLevel !== 'string' || !MFA_LEVELS.has(value.mfaLevel)
    || typeof value.expiresAt !== 'string' || !value.expiresAt
  ) return null;
  return {
    accessSessionId: value.accessSessionId,
    staffRole: value.staffRole,
    accessMode: value.accessMode,
    permissions: value.permissions,
    effectiveTenantId: value.effectiveTenantId,
    effectiveOrganizationId: value.effectiveOrganizationId,
    effectiveUserId: value.effectiveUserId,
    effectiveRole: value.effectiveRole,
    targetDealId: value.targetDealId,
    mfaLevel: value.mfaLevel,
    expiresAt: value.expiresAt,
  };
}

function parsePendingApprovals(value: unknown): StaffCapabilitiesContract['pendingApprovals'] | null {
  if (!isRecord(value)) return null;
  if (!safeCount(value.total) || !safeCount(value.staffAccessRequests) || !safeCount(value.criticalActions)) return null;
  if (value.total !== value.staffAccessRequests + value.criticalActions) return null;
  return { total: value.total, staffAccessRequests: value.staffAccessRequests, criticalActions: value.criticalActions };
}

function sameScope(
  scope: StaffCapabilitiesContract['scopes'][number],
  session: StaffCapabilitiesContract['activeAccessSessions'][number],
): boolean {
  return scope.accessMode === session.accessMode
    && scope.effectiveTenantId === session.effectiveTenantId
    && scope.effectiveOrganizationId === session.effectiveOrganizationId
    && scope.effectiveUserId === session.effectiveUserId
    && scope.effectiveRole === session.effectiveRole
    && scope.targetDealId === session.targetDealId
    && scope.expiresAt === session.expiresAt;
}

export function parseStaffCapabilitiesContract(value: unknown): StaffCapabilitiesContract | null {
  if (!isRecord(value) || !isRecord(value.identity) || !isRecord(value.authenticationAssurance)) return null;
  if (
    typeof value.identity.id !== 'string' || !value.identity.id
    || typeof value.identity.email !== 'string' || !value.identity.email
    || !nullableString(value.identity.fullName)
  ) return null;
  if (
    value.authenticationAssurance.mfaVerified !== true
    || !nullableString(value.authenticationAssurance.mfaVerifiedAt)
    || typeof value.authenticationAssurance.recentMfa !== 'boolean'
  ) return null;
  if (!isUniqueStringArray(value.roles) || value.roles.length === 0) return null;
  if (!isUniqueStringArray(value.capabilities) || !isUniqueStringArray(value.workspaces)) return null;
  if (!Array.isArray(value.assignments) || value.assignments.length === 0) return null;
  if (!Array.isArray(value.scopes) || !Array.isArray(value.activeAccessSessions)) return null;

  const assignments = value.assignments.map(parseAssignment);
  const scopes = value.scopes.map(parseScope);
  const sessions = value.activeAccessSessions.map(parseSession);
  const pendingApprovals = parsePendingApprovals(value.pendingApprovals);
  if (
    assignments.some((item) => item === null)
    || scopes.some((item) => item === null)
    || sessions.some((item) => item === null)
    || pendingApprovals === null
  ) return null;

  const typedAssignments = assignments as StaffCapabilitiesContract['assignments'];
  const typedScopes = scopes as StaffCapabilitiesContract['scopes'];
  const typedSessions = sessions as StaffCapabilitiesContract['activeAccessSessions'];
  if (new Set(typedAssignments.map((item) => item.id)).size !== typedAssignments.length) return null;
  if (new Set(typedSessions.map((item) => item.accessSessionId)).size !== typedSessions.length) return null;
  if (new Set(typedScopes.map((item) => item.accessSessionId)).size !== typedScopes.length) return null;

  const assignmentRoles = new Set(typedAssignments.map((assignment) => assignment.role));
  const roleSet = new Set(value.roles);
  if (assignmentRoles.size !== roleSet.size || value.roles.some((role) => !assignmentRoles.has(role))) return null;

  const capabilitySet = new Set(value.capabilities);
  const sessionById = new Map(typedSessions.map((session) => [session.accessSessionId, session]));
  if (typedSessions.some((session) => (
    !roleSet.has(session.staffRole)
    || session.permissions.some((permission) => !capabilitySet.has(permission))
  ))) return null;
  if (typedScopes.some((scope) => {
    const session = sessionById.get(scope.accessSessionId);
    return !session || !sameScope(scope, session);
  })) return null;

  return {
    identity: { id: value.identity.id, email: value.identity.email, fullName: value.identity.fullName },
    assignments: typedAssignments,
    roles: value.roles,
    capabilities: value.capabilities,
    workspaces: value.workspaces,
    scopes: typedScopes,
    authenticationAssurance: {
      mfaVerified: true,
      mfaVerifiedAt: value.authenticationAssurance.mfaVerifiedAt,
      recentMfa: value.authenticationAssurance.recentMfa,
    },
    activeAccessSessions: typedSessions,
    pendingApprovals,
  };
}
