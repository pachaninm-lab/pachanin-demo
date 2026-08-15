/**
 * Capability resolution for the PC-CROP federal accounting contour.
 *
 * Deny by default. The resolver returns the empty set unless an active
 * membership carries a job profile that explicitly grants each capability.
 *
 * Scope boundary: this resolver governs the accounting contour only. It never
 * grants deal, money or bank authority derived from `user_orgs.role` — those
 * remain with the existing role-based policies (`organization-role-policy.ts`,
 * `deal-command.policy.ts`, the settlement engine). Role is consulted here only
 * to deny, never to widen.
 */

import { Role } from '../../common/types/request-user';
import { JobProfile, isJobProfile } from './organization-job-profile';

export const Capability = {
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_TEAM_READ: 'organization.team.read',
  ORGANIZATION_TEAM_MANAGE: 'organization.team.manage',

  DEAL_READ: 'deal.read',
  DEAL_COMMERCIAL_READ: 'deal.commercial.read',
  DEAL_COMMERCIAL_MANAGE: 'deal.commercial.manage',

  ACCOUNTING_DASHBOARD_READ: 'accounting.dashboard.read',
  ACCOUNTING_TASK_MANAGE: 'accounting.task.manage',
  ACCOUNTING_PACKAGE_READ: 'accounting.package.read',
  ACCOUNTING_PACKAGE_PREPARE: 'accounting.package.prepare',
  ACCOUNTING_PACKAGE_CLOSE: 'accounting.package.close',

  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_PREPARE: 'documents.prepare',
  DOCUMENTS_VALIDATE: 'documents.validate',
  DOCUMENTS_SEND: 'documents.send',
  DOCUMENTS_RECEIVE: 'documents.receive',
  DOCUMENTS_REJECT: 'documents.reject',
  DOCUMENTS_CORRECT: 'documents.correct',
  DOCUMENTS_SIGN: 'documents.sign',

  EDO_READ: 'edo.read',
  EDO_SEND: 'edo.send',
  EDO_ACCEPT: 'edo.accept',
  EDO_CONFIGURE: 'edo.configure',

  ONE_C_READ: 'one_c.read',
  ONE_C_SYNC: 'one_c.sync',
  ONE_C_MAPPING_MANAGE: 'one_c.mapping.manage',
  ONE_C_CONFIGURE: 'one_c.configure',

  PAYMENTS_READ: 'payments.read',
  PAYMENTS_MATCH: 'payments.match',
  PAYMENTS_RECONCILE: 'payments.reconcile',

  GRAIN_READ: 'grain.read',
  GRAIN_MANAGE: 'grain.manage',

  TRANSPORT_EPD_READ: 'transport_epd.read',
  TRANSPORT_EPD_MANAGE: 'transport_epd.manage',

  INTEGRATIONS_READ: 'integrations.read',
  INTEGRATIONS_CONFIGURE: 'integrations.configure',

  SIGNING_AUTHORITY_READ: 'signing_authority.read',
  SIGNING_AUTHORITY_MANAGE: 'signing_authority.manage',

  SECURITY_SESSION_READ_OWN: 'security.session.read_own',
  SECURITY_SESSION_REVOKE_OWN: 'security.session.revoke_own',
  SECURITY_CONNECTION_READ: 'security.connection.read',
  SECURITY_CONNECTION_REVOKE: 'security.connection.revoke',
} as const;

export type Capability = typeof Capability[keyof typeof Capability];

export const ALL_CAPABILITIES = Object.freeze(
  Object.values(Capability),
) as readonly Capability[];

export function isCapability(value: unknown): value is Capability {
  return typeof value === 'string'
    && (ALL_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Legal signing is never derived from a job profile. It requires a valid
 * signing authority record checked at signing time, so no profile below and no
 * delegation may grant it. Keeping it in the capability vocabulary while
 * refusing to mint it keeps call sites honest instead of inventing a parallel
 * check.
 */
export const NEVER_PROFILE_GRANTED: ReadonlySet<Capability> = new Set([
  Capability.DOCUMENTS_SIGN,
]);

/** Granted to every active membership, regardless of job profile. */
const BASELINE: readonly Capability[] = [
  Capability.ORGANIZATION_READ,
  Capability.SECURITY_SESSION_READ_OWN,
  Capability.SECURITY_SESSION_REVOKE_OWN,
];

const READ_ONLY_ACCOUNTING: readonly Capability[] = [
  Capability.ACCOUNTING_DASHBOARD_READ,
  Capability.ACCOUNTING_PACKAGE_READ,
  Capability.DEAL_READ,
  Capability.DOCUMENTS_READ,
  Capability.PAYMENTS_READ,
];

const BOOKKEEPING_CORE: readonly Capability[] = [
  ...READ_ONLY_ACCOUNTING,
  Capability.ACCOUNTING_TASK_MANAGE,
  Capability.ACCOUNTING_PACKAGE_PREPARE,
  Capability.DOCUMENTS_PREPARE,
  Capability.DOCUMENTS_VALIDATE,
  Capability.DOCUMENTS_SEND,
  Capability.DOCUMENTS_RECEIVE,
  Capability.DOCUMENTS_REJECT,
  Capability.DOCUMENTS_CORRECT,
  Capability.EDO_READ,
  Capability.EDO_SEND,
  Capability.EDO_ACCEPT,
  Capability.ONE_C_READ,
  Capability.ONE_C_SYNC,
  Capability.PAYMENTS_MATCH,
  Capability.GRAIN_READ,
  Capability.TRANSPORT_EPD_READ,
  Capability.INTEGRATIONS_READ,
  Capability.ORGANIZATION_TEAM_READ,
];

const PROFILE_CAPABILITIES: Readonly<
  Record<JobProfile, readonly Capability[]>
> = {
  OWNER: ALL_CAPABILITIES.filter((c) => !NEVER_PROFILE_GRANTED.has(c)),

  DIRECTOR: [
    ...BOOKKEEPING_CORE,
    Capability.DEAL_COMMERCIAL_READ,
    Capability.DEAL_COMMERCIAL_MANAGE,
    Capability.ORGANIZATION_TEAM_MANAGE,
    Capability.ACCOUNTING_PACKAGE_CLOSE,
    Capability.PAYMENTS_RECONCILE,
    Capability.SIGNING_AUTHORITY_READ,
    Capability.SIGNING_AUTHORITY_MANAGE,
    Capability.SECURITY_CONNECTION_READ,
    Capability.SECURITY_CONNECTION_REVOKE,
  ],

  CHIEF_ACCOUNTANT: [
    ...BOOKKEEPING_CORE,
    Capability.DEAL_COMMERCIAL_READ,
    Capability.ACCOUNTING_PACKAGE_CLOSE,
    Capability.PAYMENTS_RECONCILE,
    Capability.ONE_C_MAPPING_MANAGE,
    Capability.ONE_C_CONFIGURE,
    Capability.EDO_CONFIGURE,
    Capability.INTEGRATIONS_CONFIGURE,
    Capability.SIGNING_AUTHORITY_READ,
    Capability.SECURITY_CONNECTION_READ,
  ],

  ACCOUNTANT: [
    ...BOOKKEEPING_CORE,
    Capability.ONE_C_MAPPING_MANAGE,
  ],

  /**
   * An external bookkeeper serves several organizations. It gets the same daily
   * bookkeeping surface but never provider configuration, never period close
   * and never reconciliation: those concentrate cross-organization blast radius
   * in an account that lives outside the organization.
   */
  EXTERNAL_ACCOUNTANT: [...BOOKKEEPING_CORE],

  SALES_MANAGER: [
    Capability.DEAL_READ,
    Capability.DEAL_COMMERCIAL_READ,
    Capability.DEAL_COMMERCIAL_MANAGE,
    Capability.DOCUMENTS_READ,
    Capability.GRAIN_READ,
  ],

  PROCUREMENT_MANAGER: [
    Capability.DEAL_READ,
    Capability.DEAL_COMMERCIAL_READ,
    Capability.DEAL_COMMERCIAL_MANAGE,
    Capability.DOCUMENTS_READ,
    Capability.DOCUMENTS_RECEIVE,
    Capability.GRAIN_READ,
  ],

  LOGISTICS_MANAGER: [
    Capability.DEAL_READ,
    Capability.DOCUMENTS_READ,
    Capability.GRAIN_READ,
    Capability.TRANSPORT_EPD_READ,
    Capability.TRANSPORT_EPD_MANAGE,
  ],

  DOCUMENT_SPECIALIST: [
    Capability.DEAL_READ,
    Capability.DOCUMENTS_READ,
    Capability.DOCUMENTS_PREPARE,
    Capability.DOCUMENTS_VALIDATE,
    Capability.DOCUMENTS_SEND,
    Capability.DOCUMENTS_RECEIVE,
    Capability.DOCUMENTS_REJECT,
    Capability.DOCUMENTS_CORRECT,
    Capability.EDO_READ,
    Capability.EDO_SEND,
    Capability.EDO_ACCEPT,
    Capability.ACCOUNTING_PACKAGE_READ,
    Capability.ACCOUNTING_PACKAGE_PREPARE,
  ],

  /**
   * A signer reviews and signs. Signing itself is not granted here; see
   * NEVER_PROFILE_GRANTED.
   */
  SIGNER: [
    Capability.DEAL_READ,
    Capability.DEAL_COMMERCIAL_READ,
    Capability.DOCUMENTS_READ,
    Capability.ACCOUNTING_PACKAGE_READ,
    Capability.SIGNING_AUTHORITY_READ,
  ],

  VIEWER: [...READ_ONLY_ACCOUNTING],
};

/**
 * Roles that must never receive accounting capabilities regardless of profile.
 * BANK_CALLBACK is a server-derived actor minted after a verified bank
 * callback and is never a human membership.
 */
const ROLES_DENIED_ACCOUNTING_CONTOUR: ReadonlySet<Role> = new Set([
  Role.BANK_CALLBACK,
]);

export type MembershipDelegation = {
  capabilities: readonly string[];
  startsAt: Date;
  endsAt: Date;
  status: string;
};

export type MembershipCapabilityInput = {
  role: Role;
  jobProfile: JobProfile | string | null | undefined;
  membershipStatus: string;
  userStatus?: string;
  /** Delegations received by this membership from another member. */
  delegations?: readonly MembershipDelegation[];
  now?: Date;
};

function activeProfileCapabilities(
  jobProfile: JobProfile | string | null | undefined,
): readonly Capability[] {
  if (!isJobProfile(jobProfile)) {
    return [];
  }
  return PROFILE_CAPABILITIES[jobProfile];
}

function isDelegationActive(d: MembershipDelegation, now: Date): boolean {
  return d.status === 'ACTIVE'
    && d.startsAt.getTime() <= now.getTime()
    && d.endsAt.getTime() > now.getTime();
}

/**
 * Resolve the effective capability set for one membership.
 *
 * Order: deny inactive, deny denied roles, take the profile grant, then union
 * time-bounded delegations. Delegation may only add capabilities that a profile
 * could legitimately grant, and never the ones in NEVER_PROFILE_GRANTED — a
 * delegation is not a route around signing authority.
 */
export function resolveMembershipCapabilities(
  input: MembershipCapabilityInput,
): ReadonlySet<Capability> {
  const denied: ReadonlySet<Capability> = new Set<Capability>();

  if (input.membershipStatus !== 'ACTIVE') {
    return denied;
  }
  if (input.userStatus !== undefined && input.userStatus !== 'ACTIVE') {
    return denied;
  }
  if (ROLES_DENIED_ACCOUNTING_CONTOUR.has(input.role)) {
    return denied;
  }

  const profileGrant = activeProfileCapabilities(input.jobProfile);
  if (profileGrant.length === 0) {
    // Active membership with no recognised job profile: baseline only, and
    // delegations are deliberately not applied. Delegation stands in for
    // someone who already holds a job, so it must not become a side door that
    // hands authority to a membership that was never given one. Returning here
    // rather than falling through keeps that explicit.
    return new Set(BASELINE);
  }

  const effective = new Set<Capability>([...BASELINE, ...profileGrant]);

  const now = input.now ?? new Date();
  for (const delegation of input.delegations ?? []) {
    if (!isDelegationActive(delegation, now)) {
      continue;
    }
    for (const raw of delegation.capabilities) {
      if (!isCapability(raw)) {
        continue;
      }
      if (NEVER_PROFILE_GRANTED.has(raw)) {
        continue;
      }
      effective.add(raw);
    }
  }

  for (const never of NEVER_PROFILE_GRANTED) {
    effective.delete(never);
  }

  return effective;
}

export function hasCapability(
  input: MembershipCapabilityInput,
  capability: Capability,
): boolean {
  return resolveMembershipCapabilities(input).has(capability);
}
