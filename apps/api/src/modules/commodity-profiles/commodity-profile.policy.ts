import { Role, type RequestUser } from '../../common/types/request-user';

export const CommodityProfileAction = {
  READ: 'READ',
  CREATE_PROFILE: 'CREATE_PROFILE',
  CREATE_DRAFT: 'CREATE_DRAFT',
  UPDATE_DRAFT: 'UPDATE_DRAFT',
  SUBMIT_REVIEW: 'SUBMIT_REVIEW',
  APPROVE: 'APPROVE',
  ACTIVATE: 'ACTIVATE',
  DEPRECATE: 'DEPRECATE',
  REVOKE: 'REVOKE',
} as const;

export type CommodityProfileAction =
  (typeof CommodityProfileAction)[keyof typeof CommodityProfileAction];

export type CommodityProfileLifecycle =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'EFFECTIVE'
  | 'DEPRECATED'
  | 'REVOKED';

export type CommodityProfileClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'PERSONAL'
  | 'COMMERCIAL_SECRET';

export type CommodityProfilePolicyInput = {
  user: RequestUser;
  action: CommodityProfileAction;
  lifecycle?: CommodityProfileLifecycle;
  classification?: CommodityProfileClassification;
  hasJitAuthority?: boolean;
  hasHumanReason?: boolean;
};

export type CommodityProfilePolicyDecision = {
  allowed: boolean;
  reasonCode:
    | 'ALLOWED'
    | 'AUTH_CONTEXT_INCOMPLETE'
    | 'ROLE_READ_ONLY'
    | 'STAFF_AUTHORITY_REQUIRED'
    | 'MFA_REQUIRED'
    | 'JIT_AUTHORITY_REQUIRED'
    | 'HUMAN_REASON_REQUIRED'
    | 'CLASSIFICATION_DENIED'
    | 'INVALID_LIFECYCLE_ACTION';
};

const READ_ROLES = new Set<string>([
  Role.FARMER,
  Role.BUYER,
  Role.LOGISTICIAN,
  Role.DRIVER,
  Role.SURVEYOR,
  Role.LAB,
  Role.ELEVATOR,
  Role.ACCOUNTING,
  Role.EXECUTIVE,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.ARBITRATOR,
]);

const DRAFT_ROLES = new Set<string>([
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.SUPPORT_MANAGER,
]);

const PRIVILEGED_ACTIONS = new Set<CommodityProfileAction>([
  CommodityProfileAction.APPROVE,
  CommodityProfileAction.ACTIVATE,
  CommodityProfileAction.DEPRECATE,
  CommodityProfileAction.REVOKE,
]);

function hasTrustedIdentity(user: RequestUser): boolean {
  return Boolean(user.id && user.orgId && user.role && user.sessionId && user.membershipId);
}

function hasStaffAuthority(user: RequestUser): boolean {
  return Boolean(user.staffRoles?.some((role) =>
    ['PLATFORM_ADMIN', 'COMMODITY_PROFILE_EDITOR', 'COMPLIANCE_CONTROL'].includes(role),
  ));
}

function lifecycleAllows(action: CommodityProfileAction, lifecycle?: CommodityProfileLifecycle): boolean {
  if (action === CommodityProfileAction.READ || action === CommodityProfileAction.CREATE_PROFILE) return true;
  if (action === CommodityProfileAction.CREATE_DRAFT) return lifecycle === undefined;
  if (action === CommodityProfileAction.UPDATE_DRAFT || action === CommodityProfileAction.SUBMIT_REVIEW) {
    return lifecycle === 'DRAFT';
  }
  if (action === CommodityProfileAction.APPROVE) return lifecycle === 'REVIEW';
  if (action === CommodityProfileAction.ACTIVATE) return lifecycle === 'APPROVED';
  if (action === CommodityProfileAction.DEPRECATE) return lifecycle === 'EFFECTIVE';
  if (action === CommodityProfileAction.REVOKE) {
    return lifecycle === 'APPROVED' || lifecycle === 'EFFECTIVE' || lifecycle === 'DEPRECATED';
  }
  return false;
}

export function decideCommodityProfileAction(
  input: CommodityProfilePolicyInput,
): CommodityProfilePolicyDecision {
  const { user, action, lifecycle, classification = 'INTERNAL' } = input;

  if (!hasTrustedIdentity(user)) {
    return { allowed: false, reasonCode: 'AUTH_CONTEXT_INCOMPLETE' };
  }

  if (!lifecycleAllows(action, lifecycle)) {
    return { allowed: false, reasonCode: 'INVALID_LIFECYCLE_ACTION' };
  }

  if (action === CommodityProfileAction.READ) {
    if (!READ_ROLES.has(user.role)) return { allowed: false, reasonCode: 'ROLE_READ_ONLY' };
    if (
      ['CONFIDENTIAL', 'PERSONAL', 'COMMERCIAL_SECRET'].includes(classification)
      && !hasStaffAuthority(user)
      && ![Role.ADMIN, Role.COMPLIANCE_OFFICER].includes(user.role as typeof Role.ADMIN | typeof Role.COMPLIANCE_OFFICER)
    ) {
      return { allowed: false, reasonCode: 'CLASSIFICATION_DENIED' };
    }
    return { allowed: true, reasonCode: 'ALLOWED' };
  }

  if (!DRAFT_ROLES.has(user.role)) return { allowed: false, reasonCode: 'ROLE_READ_ONLY' };
  if (!hasStaffAuthority(user)) return { allowed: false, reasonCode: 'STAFF_AUTHORITY_REQUIRED' };
  if (!input.hasHumanReason) return { allowed: false, reasonCode: 'HUMAN_REASON_REQUIRED' };

  if (PRIVILEGED_ACTIONS.has(action)) {
    if (!user.mfaVerified) return { allowed: false, reasonCode: 'MFA_REQUIRED' };
    if (!input.hasJitAuthority) return { allowed: false, reasonCode: 'JIT_AUTHORITY_REQUIRED' };
  }

  return { allowed: true, reasonCode: 'ALLOWED' };
}

export type ServerDerivedAction = {
  id: CommodityProfileAction;
  allowed: boolean;
  reasonCode: CommodityProfilePolicyDecision['reasonCode'];
  requiresConfirmation: boolean;
  owner: 'OPERATOR' | 'COMPLIANCE' | 'PLATFORM_ADMIN';
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
};

const ACTION_ORDER: CommodityProfileAction[] = [
  CommodityProfileAction.UPDATE_DRAFT,
  CommodityProfileAction.SUBMIT_REVIEW,
  CommodityProfileAction.APPROVE,
  CommodityProfileAction.ACTIVATE,
  CommodityProfileAction.DEPRECATE,
  CommodityProfileAction.REVOKE,
];

export function deriveCommodityProfileActions(
  user: RequestUser,
  lifecycle: CommodityProfileLifecycle,
  classification: CommodityProfileClassification,
  hasJitAuthority: boolean,
): ServerDerivedAction[] {
  return ACTION_ORDER.map((id) => {
    const decision = decideCommodityProfileAction({
      user,
      action: id,
      lifecycle,
      classification,
      hasJitAuthority,
      hasHumanReason: true,
    });
    const privileged = PRIVILEGED_ACTIONS.has(id);
    return {
      id,
      allowed: decision.allowed,
      reasonCode: decision.reasonCode,
      requiresConfirmation: privileged,
      owner: id === CommodityProfileAction.UPDATE_DRAFT || id === CommodityProfileAction.SUBMIT_REVIEW
        ? 'OPERATOR'
        : id === CommodityProfileAction.APPROVE || id === CommodityProfileAction.ACTIVATE
          ? 'COMPLIANCE'
          : 'PLATFORM_ADMIN',
      impact: id === CommodityProfileAction.REVOKE
        ? 'CRITICAL'
        : privileged
          ? 'HIGH'
          : 'MEDIUM',
    };
  });
}

/**
 * The client receives one server-selected lifecycle action. An allowed action wins;
 * otherwise the first lifecycle-relevant denial is returned so the UI can explain
 * why the current user cannot proceed without reconstructing permissions locally.
 */
export function deriveCommodityProfilePrimaryAction(
  user: RequestUser,
  lifecycle: CommodityProfileLifecycle,
  classification: CommodityProfileClassification,
  hasJitAuthority: boolean,
): ServerDerivedAction | null {
  const actions = deriveCommodityProfileActions(
    user,
    lifecycle,
    classification,
    hasJitAuthority,
  );
  return actions.find((action) => action.allowed)
    ?? actions.find((action) => action.reasonCode !== 'INVALID_LIFECYCLE_ACTION')
    ?? null;
}
