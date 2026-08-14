export type StaffCapabilitiesContract = {
  identity: {
    id: string;
    email: string;
    fullName: string | null;
  };
  assignments: Array<{
    id: string;
    role: string;
    status: string;
    validFrom: string;
    validUntil: string | null;
  }>;
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
  authenticationAssurance: {
    mfaVerified: true;
    mfaVerifiedAt: string | null;
    recentMfa: boolean;
  };
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
  pendingApprovals: {
    total: number;
    staffAccessRequests: number;
    criticalActions: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function safeCount(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0;
}

function parseAssignment(value: unknown): StaffCapabilitiesContract['assignments'][number] | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string'
    || typeof value.role !== 'string'
    || typeof value.status !== 'string'
    || typeof value.validFrom !== 'string'
    || !nullableString(value.validUntil)
  ) return null;
  return {
    id: value.id,
    role: value.role,
    status: value.status,
    validFrom: value.validFrom,
    validUntil: value.validUntil,
  };
}

function parseScope(value: unknown): StaffCapabilitiesContract['scopes'][number] | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.accessSessionId !== 'string'
    || typeof value.accessMode !== 'string'
    || !nullableString(value.effectiveTenantId)
    || !nullableString(value.effectiveOrganizationId)
    || !nullableString(value.effectiveUserId)
    || !nullableString(value.effectiveRole)
    || !nullableString(value.targetDealId)
    || typeof value.expiresAt !== 'string'
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
  if (!isRecord(value) || !isStringArray(value.permissions)) return null;
  if (
    typeof value.accessSessionId !== 'string'
    || typeof value.staffRole !== 'string'
    || typeof value.accessMode !== 'string'
    || !nullableString(value.effectiveTenantId)
    || !nullableString(value.effectiveOrganizationId)
    || !nullableString(value.effectiveUserId)
    || !nullableString(value.effectiveRole)
    || !nullableString(value.targetDealId)
    || typeof value.mfaLevel !== 'string'
    || typeof value.expiresAt !== 'string'
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
  if (
    !safeCount(value.total)
    || !safeCount(value.staffAccessRequests)
    || !safeCount(value.criticalActions)
  ) return null;
  if (value.total !== value.staffAccessRequests + value.criticalActions) return null;
  return {
    total: value.total,
    staffAccessRequests: value.staffAccessRequests,
    criticalActions: value.criticalActions,
  };
}

export function parseStaffCapabilitiesContract(value: unknown): StaffCapabilitiesContract | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.identity) || !isRecord(value.authenticationAssurance)) return null;
  if (
    typeof value.identity.id !== 'string'
    || typeof value.identity.email !== 'string'
    || !nullableString(value.identity.fullName)
  ) return null;
  if (
    value.authenticationAssurance.mfaVerified !== true
    || !nullableString(value.authenticationAssurance.mfaVerifiedAt)
    || typeof value.authenticationAssurance.recentMfa !== 'boolean'
  ) return null;
  if (!isStringArray(value.roles) || value.roles.length === 0) return null;
  if (!isStringArray(value.capabilities) || !isStringArray(value.workspaces)) return null;
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
  ) {
    return null;
  }

  const typedAssignments = assignments as StaffCapabilitiesContract['assignments'];
  const typedScopes = scopes as StaffCapabilitiesContract['scopes'];
  const typedSessions = sessions as StaffCapabilitiesContract['activeAccessSessions'];
  const roleSet = new Set(value.roles);
  const capabilitySet = new Set(value.capabilities);
  const sessionIds = new Set(typedSessions.map((session) => session.accessSessionId));
  if (typedAssignments.some((assignment) => !roleSet.has(assignment.role))) return null;
  if (typedSessions.some((session) => (
    !roleSet.has(session.staffRole)
    || session.permissions.some((permission) => !capabilitySet.has(permission))
  ))) return null;
  if (typedScopes.some((scope) => !sessionIds.has(scope.accessSessionId))) return null;

  return {
    identity: {
      id: value.identity.id,
      email: value.identity.email,
      fullName: value.identity.fullName,
    },
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
