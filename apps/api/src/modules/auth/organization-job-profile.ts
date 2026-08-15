/**
 * Organization job profiles for the PC-CROP federal accounting contour.
 *
 * A job profile answers "what does this person do inside the organization?".
 * It is a separate axis from `user_orgs.role`, which answers "what market
 * function does this membership represent?" and is governed by
 * `organization-role-policy.ts`.
 *
 * The two axes must not be merged. `Role.ACCOUNTING` already means the
 * bank/settlement actor: `registration-application.service.ts` maps the bank
 * applicant onto it and `deal-command.policy.ts` grants it reserve and release
 * commands. Reusing it for the organization bookkeeper would hand money
 * commands to bookkeepers. The bookkeeper is `JobProfile.ACCOUNTANT` instead,
 * and a membership may legitimately carry `role = GUEST` with an accounting
 * job profile.
 *
 * Assigning a job profile grants no legal signing right on its own. Signing is
 * gated by a separate signing authority record and is deliberately absent from
 * every profile below.
 */

export const JobProfile = {
  OWNER: 'OWNER',
  DIRECTOR: 'DIRECTOR',
  CHIEF_ACCOUNTANT: 'CHIEF_ACCOUNTANT',
  ACCOUNTANT: 'ACCOUNTANT',
  EXTERNAL_ACCOUNTANT: 'EXTERNAL_ACCOUNTANT',
  SALES_MANAGER: 'SALES_MANAGER',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  LOGISTICS_MANAGER: 'LOGISTICS_MANAGER',
  DOCUMENT_SPECIALIST: 'DOCUMENT_SPECIALIST',
  SIGNER: 'SIGNER',
  VIEWER: 'VIEWER',
} as const;

export type JobProfile = typeof JobProfile[keyof typeof JobProfile];

export const ORGANIZATION_JOB_PROFILES = Object.freeze(
  Object.values(JobProfile),
) as readonly JobProfile[];

export function isJobProfile(value: unknown): value is JobProfile {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(JobProfile, value);
}

/**
 * Profiles that administer the organization itself. Only these may hand out
 * job profiles, and only within the ceiling below.
 */
const PROFILE_ASSIGNMENT_CEILING: Readonly<
  Record<JobProfile, ReadonlySet<JobProfile>>
> = {
  OWNER: new Set(ORGANIZATION_JOB_PROFILES),
  DIRECTOR: new Set([
    JobProfile.CHIEF_ACCOUNTANT,
    JobProfile.ACCOUNTANT,
    JobProfile.EXTERNAL_ACCOUNTANT,
    JobProfile.SALES_MANAGER,
    JobProfile.PROCUREMENT_MANAGER,
    JobProfile.LOGISTICS_MANAGER,
    JobProfile.DOCUMENT_SPECIALIST,
    JobProfile.SIGNER,
    JobProfile.VIEWER,
  ]),
  CHIEF_ACCOUNTANT: new Set([
    JobProfile.ACCOUNTANT,
    JobProfile.EXTERNAL_ACCOUNTANT,
    JobProfile.DOCUMENT_SPECIALIST,
    JobProfile.VIEWER,
  ]),
  ACCOUNTANT: new Set<JobProfile>(),
  EXTERNAL_ACCOUNTANT: new Set<JobProfile>(),
  SALES_MANAGER: new Set<JobProfile>(),
  PROCUREMENT_MANAGER: new Set<JobProfile>(),
  LOGISTICS_MANAGER: new Set<JobProfile>(),
  DOCUMENT_SPECIALIST: new Set<JobProfile>(),
  SIGNER: new Set<JobProfile>(),
  VIEWER: new Set<JobProfile>(),
};

/**
 * Deny by default. A membership without a job profile cannot assign one, no
 * matter what market role or org-admin flag it carries: administering the
 * accounting contour is itself a job-profile responsibility.
 */
export function canAssignJobProfile(
  assignerProfile: JobProfile | null | undefined,
  requestedProfile: JobProfile,
): boolean {
  if (!isJobProfile(assignerProfile)) {
    return false;
  }
  if (!isJobProfile(requestedProfile)) {
    return false;
  }
  return PROFILE_ASSIGNMENT_CEILING[assignerProfile].has(requestedProfile);
}

/**
 * Profiles an organization may hold more than once. Owner and director are
 * singular by intent; duplicating them silently splits accountability for
 * signing and for granting authority.
 */
const SINGULAR_PROFILES: ReadonlySet<JobProfile> = new Set([
  JobProfile.OWNER,
  JobProfile.DIRECTOR,
]);

export function isSingularJobProfile(profile: JobProfile): boolean {
  return SINGULAR_PROFILES.has(profile);
}
