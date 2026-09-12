import {
  StaffAccessGrant,
  StaffLifecycleAction,
  StaffLifecycleCommand,
  StaffLifecycleDecision,
  StaffLifecycleDenialCode,
  StaffLifecycleState,
} from './staff-lifecycle.types';

const MAX_SET_SIZE = 128;
const MAX_IDENTIFIER_LENGTH = 160;

const REQUIRED_PERMISSION: Readonly<Record<StaffLifecycleAction, string>> = {
  INVITE: 'staff.lifecycle.invite',
  MARK_INVITATION_DELIVERED: 'staff.lifecycle.invite',
  ACKNOWLEDGE_EMAIL_VERIFICATION: 'staff.lifecycle.activate',
  ACKNOWLEDGE_MFA_ENROLLMENT: 'staff.lifecycle.activate',
  ACTIVATE: 'staff.lifecycle.activate',
  SUSPEND: 'staff.lifecycle.suspend',
  RESTORE: 'staff.lifecycle.suspend',
  TERMINATE: 'staff.lifecycle.terminate',
  EXPIRE: 'staff.lifecycle.expire',
  REQUEST_ACCESS_GRANT: 'staff.grant.request',
  APPROVE_ACCESS_GRANT: 'staff.grant.approve',
  REJECT_ACCESS_GRANT: 'staff.grant.approve',
  REVOKE_ACCESS_GRANT: 'staff.grant.revoke',
};

const TRANSITIONS: Readonly<
  Record<StaffLifecycleAction, Partial<Record<StaffLifecycleState, StaffLifecycleState>>>
> = {
  INVITE: { EXPIRED: 'INVITED' },
  MARK_INVITATION_DELIVERED: { INVITED: 'EMAIL_VERIFICATION_REQUIRED' },
  ACKNOWLEDGE_EMAIL_VERIFICATION: { EMAIL_VERIFICATION_REQUIRED: 'MFA_ENROLLMENT_REQUIRED' },
  ACKNOWLEDGE_MFA_ENROLLMENT: { MFA_ENROLLMENT_REQUIRED: 'MFA_ENROLLMENT_REQUIRED' },
  ACTIVATE: { MFA_ENROLLMENT_REQUIRED: 'ACTIVE' },
  SUSPEND: { ACTIVE: 'SUSPENDED' },
  RESTORE: { SUSPENDED: 'ACTIVE' },
  TERMINATE: {
    INVITED: 'TERMINATED',
    EMAIL_VERIFICATION_REQUIRED: 'TERMINATED',
    MFA_ENROLLMENT_REQUIRED: 'TERMINATED',
    ACTIVE: 'TERMINATED',
    SUSPENDED: 'TERMINATED',
  },
  EXPIRE: {
    INVITED: 'EXPIRED',
    EMAIL_VERIFICATION_REQUIRED: 'EXPIRED',
    MFA_ENROLLMENT_REQUIRED: 'EXPIRED',
  },
  REQUEST_ACCESS_GRANT: { ACTIVE: 'ACTIVE' },
  APPROVE_ACCESS_GRANT: { ACTIVE: 'ACTIVE' },
  REJECT_ACCESS_GRANT: { ACTIVE: 'ACTIVE' },
  REVOKE_ACCESS_GRANT: { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' },
};

const STRONG_MFA_ACTIONS = new Set<StaffLifecycleAction>([
  'ACTIVATE',
  'SUSPEND',
  'RESTORE',
  'TERMINATE',
  'REQUEST_ACCESS_GRANT',
  'APPROVE_ACCESS_GRANT',
  'REJECT_ACCESS_GRANT',
  'REVOKE_ACCESS_GRANT',
]);

const GRANT_ACTIONS = new Set<StaffLifecycleAction>([
  'REQUEST_ACCESS_GRANT',
  'APPROVE_ACCESS_GRANT',
  'REJECT_ACCESS_GRANT',
  'REVOKE_ACCESS_GRANT',
]);

function denied(denialCode: StaffLifecycleDenialCode): StaffLifecycleDecision {
  return { allowed: false, denialCode, evidenceType: 'STAFF_LIFECYCLE_DECISION' };
}

function isSafeIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function hasDuplicates(source: readonly string[]): boolean {
  return new Set(source).size !== source.length;
}

function isValidSet(source: readonly string[]): boolean {
  return (
    source.length <= MAX_SET_SIZE &&
    !hasDuplicates(source) &&
    source.every((value) => isSafeIdentifier(value))
  );
}

function isValidGrantSet(source: readonly string[]): boolean {
  if (source.length === 0 || source.length > MAX_SET_SIZE || hasDuplicates(source)) return false;
  return source.every((value) => isSafeIdentifier(value));
}

function isSubset(source: readonly string[], ceiling: readonly string[]): boolean {
  const allowed = new Set(ceiling);
  return source.every((value) => allowed.has(value));
}

function isFiniteDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function validateEnvelope(command: StaffLifecycleCommand): StaffLifecycleDenialCode | null {
  if (
    !isSafeIdentifier(command.commandId) ||
    !isSafeIdentifier(command.idempotencyKey) ||
    !isSafeIdentifier(command.tenantId) ||
    !isSafeIdentifier(command.actor.actorId) ||
    !isSafeIdentifier(command.actor.tenantId) ||
    !isSafeIdentifier(command.subject.identityId) ||
    !isSafeIdentifier(command.subject.tenantId) ||
    !isFiniteDate(command.now) ||
    !Number.isSafeInteger(command.expectedAuthorityVersion) ||
    command.expectedAuthorityVersion < 0 ||
    !Number.isSafeInteger(command.actor.authorityVersion) ||
    command.actor.authorityVersion < 0 ||
    !Number.isSafeInteger(command.subject.authorityVersion) ||
    command.subject.authorityVersion < 0
  ) {
    return 'INVALID_COMMAND';
  }

  if (
    hasDuplicates(command.actor.permissions) ||
    hasDuplicates(command.actor.allowedPermissions) ||
    hasDuplicates(command.actor.allowedRoles) ||
    hasDuplicates(command.actor.allowedScopes) ||
    hasDuplicates(command.subject.permissions) ||
    hasDuplicates(command.subject.scopes) ||
    !isValidSet(command.actor.permissions) ||
    !isValidSet(command.actor.allowedPermissions) ||
    !isValidSet(command.actor.allowedRoles) ||
    !isValidSet(command.actor.allowedScopes) ||
    !isValidSet(command.subject.permissions) ||
    !isValidSet(command.subject.scopes)
  ) {
    return 'INVALID_COMMAND';
  }

  if (
    !(command.actor.sessionIssuedAt instanceof Date) ||
    Number.isNaN(command.actor.sessionIssuedAt.getTime()) ||
    command.actor.sessionIssuedAt.getTime() > command.now.getTime()
  ) {
    return 'INVALID_COMMAND';
  }

  if (
    command.tenantId !== command.actor.tenantId ||
    command.tenantId !== command.subject.tenantId
  ) {
    return 'TENANT_BOUNDARY_VIOLATION';
  }

  if (
    command.expectedAuthorityVersion !== command.subject.authorityVersion ||
    command.actor.authorityVersion < command.subject.authorityVersion
  ) {
    return 'AUTHORITY_VERSION_CONFLICT';
  }

  if (!command.actor.permissions.includes(REQUIRED_PERMISSION[command.action])) {
    return 'PERMISSION_DENIED';
  }

  if (STRONG_MFA_ACTIONS.has(command.action) && !['MFA', 'PHISHING_RESISTANT'].includes(command.actor.mfaLevel)) {
    return 'MFA_REQUIRED';
  }

  if (command.subject.state === 'TERMINATED' && command.action !== 'INVITE') {
    return 'SUBJECT_TERMINATED';
  }

  return null;
}

function validateGrantWindow(validFrom: Date, validUntil: Date | null, now: Date): StaffLifecycleDenialCode | null {
  if (!isFiniteDate(validFrom) || (validUntil !== null && !isFiniteDate(validUntil))) {
    return 'INVALID_COMMAND';
  }
  if (validUntil !== null && validUntil <= validFrom) return 'INVALID_COMMAND';
  if (validUntil !== null && validUntil <= now) return 'GRANT_NOT_EFFECTIVE';
  return null;
}

function validateGrantCeilings(
  command: StaffLifecycleCommand,
  role: string,
  permissions: readonly string[],
  scopes: readonly string[],
): StaffLifecycleDenialCode | null {
  if (!isSafeIdentifier(role) || !isValidGrantSet(permissions) || !isValidGrantSet(scopes)) {
    return 'INVALID_COMMAND';
  }
  if (!command.actor.allowedRoles.includes(role)) return 'ROLE_CEILING_EXCEEDED';
  if (!isSubset(permissions, command.actor.allowedPermissions)) return 'PERMISSION_CEILING_EXCEEDED';
  if (!isSubset(scopes, command.actor.allowedScopes)) return 'SCOPE_CEILING_EXCEEDED';
  return null;
}

function evaluateGrantRequest(command: StaffLifecycleCommand): StaffLifecycleDenialCode | null {
  const role = command.requestedRole;
  const permissions = command.requestedPermissions;
  const scopes = command.requestedScopes;
  const validFrom = command.validFrom ?? command.now;
  const validUntil = command.validUntil ?? null;
  if (role === undefined || permissions === undefined || scopes === undefined) return 'INVALID_COMMAND';
  return (
    validateGrantCeilings(command, role, permissions, scopes) ??
    validateGrantWindow(validFrom, validUntil, command.now)
  );
}

function evaluateGrantDecision(
  command: StaffLifecycleCommand,
  grant: StaffAccessGrant | undefined,
): StaffLifecycleDenialCode | null {
  if (
    grant === undefined ||
    !isSafeIdentifier(grant.grantId) ||
    !isSafeIdentifier(grant.requestedByActorId) ||
    command.actor.actorId === grant.requestedByActorId
  ) {
    return grant !== undefined && command.actor.actorId === grant.requestedByActorId
      ? 'SELF_APPROVAL_FORBIDDEN'
      : 'INVALID_COMMAND';
  }
  return (
    validateGrantCeilings(
      command,
      grant.requestedRole,
      grant.requestedPermissions,
      grant.requestedScopes,
    ) ?? validateGrantWindow(grant.validFrom, grant.validUntil, command.now)
  );
}

export function evaluateStaffLifecycleCommand(command: StaffLifecycleCommand): StaffLifecycleDecision {
  const envelopeFailure = validateEnvelope(command);
  if (envelopeFailure !== null) return denied(envelopeFailure);

  const nextState = TRANSITIONS[command.action][command.subject.state];
  if (nextState === undefined) return denied('INVALID_TRANSITION');

  if (
    command.action === 'ACKNOWLEDGE_EMAIL_VERIFICATION' &&
    !isFiniteDate(command.subject.emailVerifiedAt)
  ) {
    return denied('INVALID_COMMAND');
  }
  if (
    command.action === 'ACKNOWLEDGE_MFA_ENROLLMENT' &&
    !isFiniteDate(command.subject.mfaEnrolledAt)
  ) {
    return denied('INVALID_COMMAND');
  }
  if (
    command.action === 'ACTIVATE' &&
    (!isFiniteDate(command.subject.emailVerifiedAt) || !isFiniteDate(command.subject.mfaEnrolledAt))
  ) {
    return denied('MFA_REQUIRED');
  }

  if (command.action === 'REQUEST_ACCESS_GRANT') {
    const failure = evaluateGrantRequest(command);
    if (failure !== null) return denied(failure);
  }
  if (command.action === 'APPROVE_ACCESS_GRANT' || command.action === 'REJECT_ACCESS_GRANT') {
    const failure = evaluateGrantDecision(command, command.grant);
    if (failure !== null) return denied(failure);
  }
  if (command.action === 'REVOKE_ACCESS_GRANT' && command.grant === undefined) {
    return denied('INVALID_COMMAND');
  }

  return {
    allowed: true,
    action: command.action,
    nextState,
    nextAuthorityVersion: command.subject.authorityVersion + 1,
    requiresIndependentApproval: command.action === 'REQUEST_ACCESS_GRANT',
    revokeSessions: ['SUSPEND', 'TERMINATE', 'REVOKE_ACCESS_GRANT'].includes(command.action),
    evidenceType: 'STAFF_LIFECYCLE_DECISION',
  };
}
