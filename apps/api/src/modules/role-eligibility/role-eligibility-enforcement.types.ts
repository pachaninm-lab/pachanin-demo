import type { EligibilitySource, EligibilityVerdict, SemanticEligibilityRole } from './role-eligibility.types';

export const ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_SCHEMA = 'role-eligibility-enforcement-policy.v1' as const;

export type EnforcedRoleRule = {
  mode: 'ENFORCE';
  acceptedVerdicts: EligibilityVerdict[];
  requiredSources: EligibilitySource[];
  requireFreshEvidence: boolean;
  requireHealthySource: boolean;
};

export type AdvisoryRoleRule = {
  mode: 'ADVISORY_ONLY';
  reason: string;
};

export type EnforcementRoleRule = EnforcedRoleRule | AdvisoryRoleRule;

export type RoleEligibilityEnforcementPolicyDocument = {
  schemaVersion: typeof ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_SCHEMA;
  version: string;
  defaultDecision: 'ADVISORY_ONLY';
  roles: Record<SemanticEligibilityRole, EnforcementRoleRule>;
};

export type RoleEligibilityEnforcementState = {
  enabled: boolean;
  generation: bigint;
  exactSha: string | null;
  policyId: string | null;
  policyVersion: string | null;
  policyHash: string | null;
  policyDocument: RoleEligibilityEnforcementPolicyDocument | null;
};

export type RoleEligibilityVerdictSourceSnapshot = {
  source: EligibilitySource;
  evidenceFreshUntil: Date;
  healthStatus: string | null;
  sourceFreshUntil: Date | null;
};

export type RoleEligibilityAdmissionDecision = {
  decision: 'ALLOW' | 'REVIEW_REQUIRED' | 'ADVISORY_ONLY';
  enforcementApplied: boolean;
  semanticRole: SemanticEligibilityRole;
  policyVersion: string | null;
  verdict: EligibilityVerdict | null;
  reasonCodes: string[];
};
