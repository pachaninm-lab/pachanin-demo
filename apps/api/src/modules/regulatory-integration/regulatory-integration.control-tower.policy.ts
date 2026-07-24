import { Role, type RequestUser } from '../../common/types/request-user';
import { StaffRole } from '../staff-access/staff-access.types';

export const IntegrationControlTowerAction = {
  READ: 'READ',
  REDRIVE: 'REDRIVE',
  RECONCILE: 'RECONCILE',
} as const;

export type IntegrationControlTowerAction =
  (typeof IntegrationControlTowerAction)[keyof typeof IntegrationControlTowerAction];

export type IntegrationHonestStatus =
  | 'CONFIRMED_LIVE'
  | 'TEST'
  | 'ADAPTER_READY'
  | 'MANUAL'
  | 'UNAVAILABLE'
  | 'DEGRADED'
  | 'REVOKED';

export type IntegrationControlTowerReasonCode =
  | 'ALLOWED'
  | 'AUTH_CONTEXT_INCOMPLETE'
  | 'ROLE_DENIED'
  | 'STAFF_AUTHORITY_REQUIRED'
  | 'MFA_REQUIRED'
  | 'JIT_AUTHORITY_REQUIRED'
  | 'HUMAN_REASON_REQUIRED'
  | 'ACTION_NOT_AVAILABLE';

export type IntegrationControlTowerDecision = Readonly<{
  allowed: boolean;
  reasonCode: IntegrationControlTowerReasonCode;
}>;

export type IntegrationControlTowerPolicyInput = Readonly<{
  user: RequestUser;
  action: IntegrationControlTowerAction;
  hasJitAuthority?: boolean;
  hasHumanReason?: boolean;
  redriveAvailable?: boolean;
}>;

export type IntegrationControlTowerPrimaryAction = Readonly<{
  id: 'REDRIVE' | 'RECONCILE';
  allowed: boolean;
  reasonCode: IntegrationControlTowerReasonCode;
  requiresConfirmation: true;
  owner: 'OPERATOR' | 'COMPLIANCE';
  impact: 'HIGH';
  entryId: string | null;
}>;

const READ_ROLES = new Set<string>([
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.EXECUTIVE,
]);

const PRIVILEGED_ACTOR_ROLES = new Set<string>([
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
]);

const CONTROL_TOWER_STAFF_ROLES = new Set<string>([
  StaffRole.PLATFORM_OWNER,
  StaffRole.PLATFORM_ADMIN,
  StaffRole.OPERATIONS_SUPERVISOR,
  StaffRole.COMPLIANCE_STAFF,
]);

function hasTrustedIdentity(user: RequestUser): boolean {
  return Boolean(
    user.id?.trim()
    && user.sessionId?.trim()
    && user.membershipId?.trim()
    && user.tenantId?.trim()
    && user.orgId?.trim(),
  );
}

function hasStaffAuthority(user: RequestUser): boolean {
  return Boolean(user.staffRoles?.some((role) => CONTROL_TOWER_STAFF_ROLES.has(role)));
}

export function decideIntegrationControlTowerAction(
  input: IntegrationControlTowerPolicyInput,
): IntegrationControlTowerDecision {
  if (!hasTrustedIdentity(input.user)) {
    return { allowed: false, reasonCode: 'AUTH_CONTEXT_INCOMPLETE' };
  }

  if (input.action === IntegrationControlTowerAction.READ) {
    return READ_ROLES.has(input.user.role)
      ? { allowed: true, reasonCode: 'ALLOWED' }
      : { allowed: false, reasonCode: 'ROLE_DENIED' };
  }

  if (!PRIVILEGED_ACTOR_ROLES.has(input.user.role)) {
    return { allowed: false, reasonCode: 'ROLE_DENIED' };
  }
  if (!hasStaffAuthority(input.user)) {
    return { allowed: false, reasonCode: 'STAFF_AUTHORITY_REQUIRED' };
  }
  if (!input.user.mfaVerified) {
    return { allowed: false, reasonCode: 'MFA_REQUIRED' };
  }
  if (!input.hasJitAuthority) {
    return { allowed: false, reasonCode: 'JIT_AUTHORITY_REQUIRED' };
  }
  if (!input.hasHumanReason) {
    return { allowed: false, reasonCode: 'HUMAN_REASON_REQUIRED' };
  }
  if (input.action === IntegrationControlTowerAction.REDRIVE && !input.redriveAvailable) {
    return { allowed: false, reasonCode: 'ACTION_NOT_AVAILABLE' };
  }
  return { allowed: true, reasonCode: 'ALLOWED' };
}

export function deriveIntegrationControlTowerPrimaryAction(
  user: RequestUser,
  input: Readonly<{
    redriveEntryId: string | null;
    hasJitAuthority: boolean;
  }>,
): IntegrationControlTowerPrimaryAction {
  const action = input.redriveEntryId
    ? IntegrationControlTowerAction.REDRIVE
    : IntegrationControlTowerAction.RECONCILE;
  const decision = decideIntegrationControlTowerAction({
    user,
    action,
    hasJitAuthority: input.hasJitAuthority,
    hasHumanReason: true,
    redriveAvailable: input.redriveEntryId !== null,
  });
  return {
    id: action,
    allowed: decision.allowed,
    reasonCode: decision.reasonCode,
    requiresConfirmation: true,
    owner: user.role === Role.COMPLIANCE_OFFICER ? 'COMPLIANCE' : 'OPERATOR',
    impact: 'HIGH',
    entryId: action === IntegrationControlTowerAction.REDRIVE
      ? input.redriveEntryId
      : null,
  };
}
