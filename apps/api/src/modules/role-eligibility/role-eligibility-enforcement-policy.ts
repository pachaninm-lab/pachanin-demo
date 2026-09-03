import { sha256, stableJson } from './role-eligibility-security';
import {
  ELIGIBILITY_SOURCES,
  ELIGIBILITY_VERDICTS,
  type EligibilitySource,
  type EligibilityVerdict,
  type SemanticEligibilityRole,
} from './role-eligibility.types';
import {
  ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_SCHEMA,
  type EnforcementRoleRule,
  type RoleEligibilityEnforcementPolicyDocument,
} from './role-eligibility-enforcement.types';

const SEMANTIC_ROLES: readonly SemanticEligibilityRole[] = [
  'FARMER',
  'BUYER',
  'LOGISTICS',
  'ELEVATOR',
  'LABORATORY',
  'SURVEYOR',
  'BANK',
  'DRIVER',
  'EMPLOYEE',
];
const SOURCE_SET = new Set<string>(ELIGIBILITY_SOURCES);
const VERDICT_SET = new Set<string>(ELIGIBILITY_VERDICTS);
const CODE = /^[A-Z0-9_:-]{3,120}$/;
const VERSION = /^[A-Za-z0-9._-]{1,64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

function uniqueStrings(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string')) return null;
  const normalized = [...new Set(value as string[])];
  return normalized.length === value.length ? normalized : null;
}

function parseRule(value: unknown): EnforcementRoleRule | null {
  if (!isRecord(value)) return null;
  if (value.mode === 'ADVISORY_ONLY') {
    return typeof value.reason === 'string' && CODE.test(value.reason)
      ? { mode: 'ADVISORY_ONLY', reason: value.reason }
      : null;
  }
  if (value.mode !== 'ENFORCE') return null;
  const accepted = uniqueStrings(value.acceptedVerdicts);
  const sources = uniqueStrings(value.requiredSources);
  if (!accepted || !sources) return null;
  if (accepted.some((item) => !VERDICT_SET.has(item)) || sources.some((item) => !SOURCE_SET.has(item))) return null;
  // The first cutover contract never turns ambiguous/negative states into an
  // automatic legal rejection. A role entitlement can only be granted from an
  // immutable ELIGIBLE verdict with fresh, healthy authoritative provenance.
  if (accepted.length !== 1 || accepted[0] !== 'ELIGIBLE') return null;
  if (value.requireFreshEvidence !== true || value.requireHealthySource !== true) return null;
  return {
    mode: 'ENFORCE',
    acceptedVerdicts: accepted as EligibilityVerdict[],
    requiredSources: sources as EligibilitySource[],
    requireFreshEvidence: true,
    requireHealthySource: true,
  };
}

export function parseRoleEligibilityEnforcementPolicy(value: unknown): RoleEligibilityEnforcementPolicyDocument | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_SCHEMA) return null;
  if (typeof value.version !== 'string' || !VERSION.test(value.version)) return null;
  if (value.defaultDecision !== 'ADVISORY_ONLY' || !isRecord(value.roles)) return null;
  const roleKeys = Object.keys(value.roles).sort();
  if (roleKeys.join('\u001f') !== [...SEMANTIC_ROLES].sort().join('\u001f')) return null;

  const roles = {} as Record<SemanticEligibilityRole, EnforcementRoleRule>;
  for (const role of SEMANTIC_ROLES) {
    const rule = parseRule(value.roles[role]);
    if (!rule) return null;
    roles[role] = rule;
  }
  return {
    schemaVersion: ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_SCHEMA,
    version: value.version,
    defaultDecision: 'ADVISORY_ONLY',
    roles,
  };
}

export function roleEligibilityEnforcementPolicyHash(document: RoleEligibilityEnforcementPolicyDocument): string {
  return sha256(stableJson(document));
}

export const ROLE_ELIGIBILITY_READINESS_POLICY_V1: Readonly<RoleEligibilityEnforcementPolicyDocument> = Object.freeze({
  schemaVersion: ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_SCHEMA,
  version: '2026-09-03.v1',
  defaultDecision: 'ADVISORY_ONLY',
  roles: Object.freeze({
    BANK: Object.freeze({
      mode: 'ENFORCE',
      acceptedVerdicts: ['ELIGIBLE'],
      requiredSources: ['CBR'],
      requireFreshEvidence: true,
      requireHealthySource: true,
    }),
    BUYER: Object.freeze({ mode: 'ADVISORY_ONLY', reason: 'FNS_MACHINE_CONTRACT_UNPROVEN' }),
    DRIVER: Object.freeze({ mode: 'ADVISORY_ONLY', reason: 'NOT_APPLICABLE' }),
    ELEVATOR: Object.freeze({ mode: 'ADVISORY_ONLY', reason: 'FGIS_GRAIN_MACHINE_CONTRACT_UNAVAILABLE' }),
    EMPLOYEE: Object.freeze({ mode: 'ADVISORY_ONLY', reason: 'NOT_APPLICABLE' }),
    FARMER: Object.freeze({ mode: 'ADVISORY_ONLY', reason: 'FNS_MACHINE_CONTRACT_UNPROVEN' }),
    LABORATORY: Object.freeze({ mode: 'ADVISORY_ONLY', reason: 'ROSACCREDITATION_MACHINE_CONTRACT_UNPROVEN' }),
    LOGISTICS: Object.freeze({ mode: 'ADVISORY_ONLY', reason: 'FNS_MACHINE_CONTRACT_UNPROVEN' }),
    SURVEYOR: Object.freeze({ mode: 'ADVISORY_ONLY', reason: 'SPECIALIST_AUTHORITY_UNPROVEN' }),
  }),
});
