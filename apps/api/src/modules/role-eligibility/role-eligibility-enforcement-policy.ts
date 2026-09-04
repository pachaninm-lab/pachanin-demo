import { sha256, stableJson } from './role-eligibility-security';
import {
  ENFORCEMENT_AUTHORITY_SOURCES,
  ELIGIBILITY_VERDICTS,
  type EligibilityVerdict,
  type EnforcementAuthoritySource,
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
const AUTHORITY_SOURCE_SET = new Set<string>(ENFORCEMENT_AUTHORITY_SOURCES);
const VERDICT_SET = new Set<string>(ELIGIBILITY_VERDICTS);
const CODE = /^[A-Z0-9_:-]{3,120}$/;
const VERSION = /^[A-Za-z0-9._-]{1,64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function uniqueStrings(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string')) return null;
  const normalized = [...new Set(value as string[])];
  return normalized.length === value.length ? normalized : null;
}

function isEnforcementAuthoritySource(value: string): value is EnforcementAuthoritySource {
  return AUTHORITY_SOURCE_SET.has(value);
}

function parseRule(value: unknown): EnforcementRoleRule | null {
  if (!isRecord(value)) return null;
  if (value.mode === 'ADVISORY_ONLY') {
    if (!hasExactKeys(value, ['mode', 'reason'])) return null;
    return typeof value.reason === 'string' && CODE.test(value.reason)
      ? { mode: 'ADVISORY_ONLY', reason: value.reason }
      : null;
  }
  if (value.mode !== 'ENFORCE') return null;
  if (!hasExactKeys(value, ['acceptedVerdicts', 'mode', 'requiredSources', 'requireFreshEvidence', 'requireHealthySource'])) return null;
  const accepted = uniqueStrings(value.acceptedVerdicts);
  const sourceStrings = uniqueStrings(value.requiredSources);
  if (!accepted || !sourceStrings) return null;
  if (accepted.some((item) => !VERDICT_SET.has(item))) return null;
  const sources: EnforcementAuthoritySource[] = [];
  for (const source of sourceStrings) {
    if (!isEnforcementAuthoritySource(source)) return null;
    sources.push(source);
  }
  // Enforcement may depend only on explicitly approved authority sources.
  // Supplementary evidence can enrich shadow/review context but can never become
  // a mandatory admission authority merely by being added to the evidence model.
  if (accepted.length !== 1 || accepted[0] !== 'ELIGIBLE') return null;
  if (value.requireFreshEvidence !== true || value.requireHealthySource !== true) return null;
  return {
    mode: 'ENFORCE',
    acceptedVerdicts: accepted as EligibilityVerdict[],
    requiredSources: sources,
    requireFreshEvidence: true,
    requireHealthySource: true,
  };
}

export function parseRoleEligibilityEnforcementPolicy(value: unknown): RoleEligibilityEnforcementPolicyDocument | null {
  if (!isRecord(value)) return null;
  if (!hasExactKeys(value, ['defaultDecision', 'roles', 'schemaVersion', 'version'])) return null;
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
      acceptedVerdicts: ['ELIGIBLE'] as EligibilityVerdict[],
      requiredSources: ['CBR'] as EnforcementAuthoritySource[],
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
