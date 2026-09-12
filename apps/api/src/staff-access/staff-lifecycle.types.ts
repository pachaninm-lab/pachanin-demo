export const STAFF_LIFECYCLE_STATES = [
  'INVITED',
  'EMAIL_VERIFICATION_REQUIRED',
  'MFA_ENROLLMENT_REQUIRED',
  'ACTIVE',
  'SUSPENDED',
  'TERMINATED',
  'EXPIRED',
] as const;

export type StaffLifecycleState = (typeof STAFF_LIFECYCLE_STATES)[number];

export const STAFF_LIFECYCLE_ACTIONS = [
  'INVITE',
  'MARK_INVITATION_DELIVERED',
  'ACKNOWLEDGE_EMAIL_VERIFICATION',
  'ACKNOWLEDGE_MFA_ENROLLMENT',
  'ACTIVATE',
  'SUSPEND',
  'RESTORE',
  'TERMINATE',
  'EXPIRE',
  'REQUEST_ACCESS_GRANT',
  'APPROVE_ACCESS_GRANT',
  'REJECT_ACCESS_GRANT',
  'REVOKE_ACCESS_GRANT',
] as const;

export type StaffLifecycleAction = (typeof STAFF_LIFECYCLE_ACTIONS)[number];

export type StaffMfaLevel = 'NONE' | 'SINGLE_FACTOR' | 'MFA' | 'PHISHING_RESISTANT';

export interface StaffLifecycleActor {
  readonly tenantId: string;
  readonly actorId: string;
  readonly permissions: readonly string[];
  readonly allowedPermissions: readonly string[];
  readonly allowedRoles: readonly string[];
  readonly allowedScopes: readonly string[];
  readonly mfaLevel: StaffMfaLevel;
  readonly sessionIssuedAt: Date;
  readonly authorityVersion: number;
}

export interface StaffLifecycleSubject {
  readonly tenantId: string;
  readonly identityId: string;
  readonly state: StaffLifecycleState;
  readonly role: string | null;
  readonly permissions: readonly string[];
  readonly scopes: readonly string[];
  readonly authorityVersion: number;
  readonly emailVerifiedAt: Date | null;
  readonly mfaEnrolledAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly terminatedAt: Date | null;
}

export interface StaffAccessGrant {
  readonly grantId: string;
  readonly requestedByActorId: string;
  readonly requestedRole: string;
  readonly requestedPermissions: readonly string[];
  readonly requestedScopes: readonly string[];
  readonly privileged: boolean;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
}

export interface StaffLifecycleCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly tenantId: string;
  readonly action: StaffLifecycleAction;
  readonly actor: StaffLifecycleActor;
  readonly subject: StaffLifecycleSubject;
  readonly now: Date;
  readonly expectedAuthorityVersion: number;
  readonly requestedRole?: string;
  readonly requestedPermissions?: readonly string[];
  readonly requestedScopes?: readonly string[];
  readonly validFrom?: Date;
  readonly validUntil?: Date | null;
  readonly grant?: StaffAccessGrant;
}

export type StaffLifecycleDenialCode =
  | 'INVALID_COMMAND'
  | 'TENANT_BOUNDARY_VIOLATION'
  | 'AUTHORITY_VERSION_CONFLICT'
  | 'PERMISSION_DENIED'
  | 'MFA_REQUIRED'
  | 'INVALID_TRANSITION'
  | 'ROLE_CEILING_EXCEEDED'
  | 'PERMISSION_CEILING_EXCEEDED'
  | 'SCOPE_CEILING_EXCEEDED'
  | 'SELF_APPROVAL_FORBIDDEN'
  | 'GRANT_NOT_EFFECTIVE'
  | 'SUBJECT_TERMINATED';

export interface StaffLifecycleAllowedDecision {
  readonly allowed: true;
  readonly denialCode?: never;
  readonly action: StaffLifecycleAction;
  readonly nextState: StaffLifecycleState;
  readonly nextAuthorityVersion: number;
  readonly requiresIndependentApproval: boolean;
  readonly revokeSessions: boolean;
  readonly evidenceType: 'STAFF_LIFECYCLE_DECISION';
}

export interface StaffLifecycleDeniedDecision {
  readonly allowed: false;
  readonly denialCode: StaffLifecycleDenialCode;
  readonly evidenceType: 'STAFF_LIFECYCLE_DECISION';
}

export type StaffLifecycleDecision = StaffLifecycleAllowedDecision | StaffLifecycleDeniedDecision;
