/**
 * Who may grant and revoke authority inside the PC-CROP accounting contour.
 *
 * The read side is settled: policies decide what a membership may see. This
 * module decides who may hand authority out and take it back, which is the
 * side fraud actually targets. Section 41 of the contract asks for the shape
 * directly — a risky grant must not be self-approved, and a stand-in must not
 * be able to mint powers the person standing in for them never held.
 *
 * Two asymmetries are deliberate and worth stating, because they look like
 * inconsistencies until you see the direction they fail in.
 *
 * Granting is harder than revoking. Granting needs the manage capability,
 * fresh MFA and a second person; revoking your own authority needs only fresh
 * MFA. An actor who can always reduce their own power cannot be locked into
 * holding a power they no longer want, and an attacker gains nothing from a
 * revocation they could have achieved by waiting.
 *
 * Delegation cannot exceed the delegator. A membership may only pass on
 * capabilities it currently holds itself, so a chain of delegations can lose
 * authority but never gain it.
 */

import {
  Capability,
  isCapability,
  NEVER_PROFILE_GRANTED,
} from './membership-capability.resolver';
import { DEFAULT_MFA_MAX_AGE_SECONDS } from './signing-authority.policy';

export const AuthorityCommandDenyReason = {
  ACTOR_MEMBERSHIP_NOT_ACTIVE: 'ACTOR_MEMBERSHIP_NOT_ACTIVE',
  ACTOR_USER_NOT_ACTIVE: 'ACTOR_USER_NOT_ACTIVE',
  TARGET_MEMBERSHIP_NOT_ACTIVE: 'TARGET_MEMBERSHIP_NOT_ACTIVE',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  ORGANIZATION_MISMATCH: 'ORGANIZATION_MISMATCH',
  CAPABILITY_REQUIRED: 'CAPABILITY_REQUIRED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_STALE: 'MFA_STALE',
  SELF_APPROVAL_FORBIDDEN: 'SELF_APPROVAL_FORBIDDEN',
  SECOND_APPROVAL_REQUIRED: 'SECOND_APPROVAL_REQUIRED',
  SECOND_APPROVER_SAME_PERSON: 'SECOND_APPROVER_SAME_PERSON',
  DELEGATION_EXCEEDS_DELEGATOR: 'DELEGATION_EXCEEDS_DELEGATOR',
  DELEGATION_CAPABILITY_UNKNOWN: 'DELEGATION_CAPABILITY_UNKNOWN',
  DELEGATION_CAPABILITY_FORBIDDEN: 'DELEGATION_CAPABILITY_FORBIDDEN',
  DELEGATION_EMPTY: 'DELEGATION_EMPTY',
  WINDOW_INVALID: 'WINDOW_INVALID',
  WINDOW_ALREADY_PAST: 'WINDOW_ALREADY_PAST',
  AMOUNT_LIMIT_NEGATIVE: 'AMOUNT_LIMIT_NEGATIVE',
  DOCUMENT_TYPES_EMPTY: 'DOCUMENT_TYPES_EMPTY',
  SIGNING_MODES_EMPTY: 'SIGNING_MODES_EMPTY',
  MCHD_REFERENCE_REQUIRED: 'MCHD_REFERENCE_REQUIRED',
  SECURITY_HOLD: 'SECURITY_HOLD',
  NOT_PERMITTED_TO_REVOKE: 'NOT_PERMITTED_TO_REVOKE',
} as const;

export type AuthorityCommandDenyReason =
  typeof AuthorityCommandDenyReason[keyof typeof AuthorityCommandDenyReason];

export type CommandDecision = {
  allowed: boolean;
  reasons: readonly AuthorityCommandDenyReason[];
};

export type CommandActor = {
  tenantId: string;
  organizationId: string;
  membershipId: string;
  userId: string;
  membershipStatus: string;
  userStatus?: string;
  capabilities: ReadonlySet<Capability>;
  mfaVerifiedAt: Date | null;
  mfaMaxAgeSeconds?: number;
  securityHold?: boolean;
};

export type CommandTarget = {
  tenantId: string;
  organizationId: string;
  membershipId: string;
  userId: string;
  membershipStatus: string;
};

/**
 * The independent person a risky grant needs. Section 41 asks for a second
 * approval on privileged capability grants; this carries who that was so the
 * policy can refuse a second approval that is really the same human twice.
 */
export type SecondApproval = {
  membershipId: string;
  userId: string;
  capabilities: ReadonlySet<Capability>;
  mfaVerifiedAt: Date | null;
};

export type SigningAuthorityGrant = {
  authorityType: 'ORGANIZATION_HEAD' | 'MCHD_DELEGATED';
  mchdReference: string | null;
  validFrom: Date;
  validTo: Date;
  allowedDocumentTypes: readonly string[];
  allowedSigningModes: readonly string[];
  amountLimitKopecks: bigint | null;
};

export type DelegationGrant = {
  capabilities: readonly string[];
  startsAt: Date;
  endsAt: Date;
};

function checkActor(
  actor: CommandActor,
  now: Date,
  reasons: AuthorityCommandDenyReason[],
): void {
  if (actor.membershipStatus !== 'ACTIVE') {
    reasons.push(AuthorityCommandDenyReason.ACTOR_MEMBERSHIP_NOT_ACTIVE);
  }
  if (actor.userStatus !== undefined && actor.userStatus !== 'ACTIVE') {
    reasons.push(AuthorityCommandDenyReason.ACTOR_USER_NOT_ACTIVE);
  }
  if (actor.securityHold === true) {
    reasons.push(AuthorityCommandDenyReason.SECURITY_HOLD);
  }
  if (actor.mfaVerifiedAt === null) {
    reasons.push(AuthorityCommandDenyReason.MFA_REQUIRED);
    return;
  }
  const maxAge = actor.mfaMaxAgeSeconds ?? DEFAULT_MFA_MAX_AGE_SECONDS;
  const ageSeconds = (now.getTime() - actor.mfaVerifiedAt.getTime()) / 1000;
  if (ageSeconds < 0 || ageSeconds > maxAge) {
    reasons.push(AuthorityCommandDenyReason.MFA_STALE);
  }
}

function checkSameScope(
  actor: CommandActor,
  target: CommandTarget,
  reasons: AuthorityCommandDenyReason[],
): void {
  if (actor.tenantId !== target.tenantId) {
    reasons.push(AuthorityCommandDenyReason.TENANT_MISMATCH);
  }
  if (actor.organizationId !== target.organizationId) {
    reasons.push(AuthorityCommandDenyReason.ORGANIZATION_MISMATCH);
  }
  if (target.membershipStatus !== 'ACTIVE') {
    reasons.push(AuthorityCommandDenyReason.TARGET_MEMBERSHIP_NOT_ACTIVE);
  }
}

function checkWindow(
  from: Date,
  to: Date,
  now: Date,
  reasons: AuthorityCommandDenyReason[],
): void {
  if (to.getTime() <= from.getTime()) {
    reasons.push(AuthorityCommandDenyReason.WINDOW_INVALID);
    return;
  }
  if (to.getTime() <= now.getTime()) {
    reasons.push(AuthorityCommandDenyReason.WINDOW_ALREADY_PAST);
  }
}

/**
 * Grant a signing authority to somebody.
 *
 * The self-approval refusal is keyed on the user, not the membership. A person
 * holding two memberships in one organization would otherwise approve their own
 * grant by switching hats, which is the collusion case wearing a disguise.
 */
export function evaluateGrantSigningAuthority(input: {
  actor: CommandActor;
  target: CommandTarget;
  grant: SigningAuthorityGrant;
  secondApproval?: SecondApproval | null;
  now?: Date;
}): CommandDecision {
  const reasons: AuthorityCommandDenyReason[] = [];
  const now = input.now ?? new Date();
  const { actor, target, grant } = input;

  checkActor(actor, now, reasons);
  checkSameScope(actor, target, reasons);

  if (!actor.capabilities.has(Capability.SIGNING_AUTHORITY_MANAGE)) {
    reasons.push(AuthorityCommandDenyReason.CAPABILITY_REQUIRED);
  }

  if (actor.userId === target.userId) {
    reasons.push(AuthorityCommandDenyReason.SELF_APPROVAL_FORBIDDEN);
  }

  checkWindow(grant.validFrom, grant.validTo, now, reasons);

  if (grant.allowedDocumentTypes.length === 0) {
    reasons.push(AuthorityCommandDenyReason.DOCUMENT_TYPES_EMPTY);
  }
  if (grant.allowedSigningModes.length === 0) {
    reasons.push(AuthorityCommandDenyReason.SIGNING_MODES_EMPTY);
  }
  if (grant.amountLimitKopecks !== null && grant.amountLimitKopecks < 0n) {
    reasons.push(AuthorityCommandDenyReason.AMOUNT_LIMIT_NEGATIVE);
  }
  if (
    grant.authorityType === 'MCHD_DELEGATED'
    && (grant.mchdReference === null || grant.mchdReference.trim() === '')
  ) {
    reasons.push(AuthorityCommandDenyReason.MCHD_REFERENCE_REQUIRED);
  }

  // Minting the right to sign on behalf of an organization is exactly the
  // privileged grant section 41 wants two people behind.
  const second = input.secondApproval;
  if (!second) {
    reasons.push(AuthorityCommandDenyReason.SECOND_APPROVAL_REQUIRED);
  } else {
    if (second.userId === actor.userId || second.userId === target.userId) {
      reasons.push(AuthorityCommandDenyReason.SECOND_APPROVER_SAME_PERSON);
    }
    if (!second.capabilities.has(Capability.SIGNING_AUTHORITY_MANAGE)) {
      reasons.push(AuthorityCommandDenyReason.SECOND_APPROVAL_REQUIRED);
    }
    if (second.mfaVerifiedAt === null) {
      reasons.push(AuthorityCommandDenyReason.SECOND_APPROVAL_REQUIRED);
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Revoke a signing authority.
 *
 * Deliberately easier than granting: the holder may always retire their own
 * authority with fresh MFA alone, and somebody with the manage capability may
 * retire anyone's. No second approval, because refusing a revocation would
 * mean forcing a person to keep a power they are trying to give up.
 */
export function evaluateRevokeSigningAuthority(input: {
  actor: CommandActor;
  authorityHolderMembershipId: string;
  authorityOrganizationId: string;
  authorityTenantId: string;
  now?: Date;
}): CommandDecision {
  const reasons: AuthorityCommandDenyReason[] = [];
  const now = input.now ?? new Date();
  const { actor } = input;

  checkActor(actor, now, reasons);

  if (actor.tenantId !== input.authorityTenantId) {
    reasons.push(AuthorityCommandDenyReason.TENANT_MISMATCH);
  }
  if (actor.organizationId !== input.authorityOrganizationId) {
    reasons.push(AuthorityCommandDenyReason.ORGANIZATION_MISMATCH);
  }

  const isHolder = actor.membershipId === input.authorityHolderMembershipId;
  const canManage = actor.capabilities.has(Capability.SIGNING_AUTHORITY_MANAGE);
  if (!isHolder && !canManage) {
    reasons.push(AuthorityCommandDenyReason.NOT_PERMITTED_TO_REVOKE);
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Create a delegation.
 *
 * The delegator must hold every capability it passes on. Without that rule a
 * bookkeeper could delegate period close to a colleague and thereby acquire,
 * through a stand-in, a power the organization never gave them.
 */
export function evaluateCreateDelegation(input: {
  actor: CommandActor;
  target: CommandTarget;
  delegation: DelegationGrant;
  now?: Date;
}): CommandDecision {
  const reasons: AuthorityCommandDenyReason[] = [];
  const now = input.now ?? new Date();
  const { actor, target, delegation } = input;

  checkActor(actor, now, reasons);
  checkSameScope(actor, target, reasons);

  if (actor.membershipId === target.membershipId) {
    reasons.push(AuthorityCommandDenyReason.SELF_APPROVAL_FORBIDDEN);
  }

  checkWindow(delegation.startsAt, delegation.endsAt, now, reasons);

  if (delegation.capabilities.length === 0) {
    reasons.push(AuthorityCommandDenyReason.DELEGATION_EMPTY);
  }

  for (const raw of delegation.capabilities) {
    if (!isCapability(raw)) {
      reasons.push(AuthorityCommandDenyReason.DELEGATION_CAPABILITY_UNKNOWN);
      continue;
    }
    if (NEVER_PROFILE_GRANTED.has(raw)) {
      reasons.push(AuthorityCommandDenyReason.DELEGATION_CAPABILITY_FORBIDDEN);
      continue;
    }
    if (!actor.capabilities.has(raw)) {
      reasons.push(AuthorityCommandDenyReason.DELEGATION_EXCEEDS_DELEGATOR);
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Revoke a delegation. The granter, the recipient and anyone who manages the
 * team may end it. The recipient is included on purpose: a stand-in must be
 * able to hand back a responsibility they did not ask for.
 */
export function evaluateRevokeDelegation(input: {
  actor: CommandActor;
  delegationFromMembershipId: string;
  delegationToMembershipId: string;
  delegationOrganizationId: string;
  delegationTenantId: string;
  now?: Date;
}): CommandDecision {
  const reasons: AuthorityCommandDenyReason[] = [];
  const now = input.now ?? new Date();
  const { actor } = input;

  checkActor(actor, now, reasons);

  if (actor.tenantId !== input.delegationTenantId) {
    reasons.push(AuthorityCommandDenyReason.TENANT_MISMATCH);
  }
  if (actor.organizationId !== input.delegationOrganizationId) {
    reasons.push(AuthorityCommandDenyReason.ORGANIZATION_MISMATCH);
  }

  const isParty = actor.membershipId === input.delegationFromMembershipId
    || actor.membershipId === input.delegationToMembershipId;
  const managesTeam = actor.capabilities.has(Capability.ORGANIZATION_TEAM_MANAGE);
  if (!isParty && !managesTeam) {
    reasons.push(AuthorityCommandDenyReason.NOT_PERMITTED_TO_REVOKE);
  }

  return { allowed: reasons.length === 0, reasons };
}
