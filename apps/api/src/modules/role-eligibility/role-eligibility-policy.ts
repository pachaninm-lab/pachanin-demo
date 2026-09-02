import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type EligibilityPolicyDecision,
  type EligibilityPolicyInput,
  type EligibilitySource,
  REGISTRATION_ROLE_CONTRACT,
  type RoleEligibilityCandidate,
  type SemanticEligibilityRole,
  WORKSPACE_ELIGIBILITY_ROLE,
} from './role-eligibility.types';
import { sha256, stableJson } from './role-eligibility-security';

type FarmerOkvedDictionary = {
  version: string;
  dictionary: string;
  semantics: string;
  matching: 'prefix-hierarchy';
  prefixes: string[];
  deprecatedOrReplaced: Record<string, string>;
  notes: string[];
};

const POLICY_RULESET = Object.freeze({
  farmer: 'active FNS identity + agricultural evidence + no strong contradiction',
  buyer: 'active matching FNS identity',
  logistics: 'active identity + transport profile + profile government evidence',
  elevator: 'active matching FGIS Grain elevator record',
  laboratory: 'active matching Rosaccreditation record with relevant scope',
  surveyor: 'manual review until strong official specialized authority is configured',
  bank: 'active matching CBR credit organization with valid license/status',
  driver: 'organization eligibility not applicable',
  employee: 'organization eligibility not applicable',
  legalSafety: 'APPARENT_MISMATCH is advisory and never a registration rejection',
});

function loadFarmerDictionary(): FarmerOkvedDictionary {
  const path = join(process.cwd(), 'config', 'eligibility', 'farmer-okved-v1.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as FarmerOkvedDictionary;
  if (
    parsed?.version !== 'farmer-okved-v1'
    || parsed.matching !== 'prefix-hierarchy'
    || !Array.isArray(parsed.prefixes)
    || parsed.prefixes.length === 0
    || parsed.prefixes.some((value) => !/^\d{2}(?:\.\d+)?$/.test(value))
  ) {
    throw new Error('ROLE_ELIGIBILITY_FARMER_OKVED_DICTIONARY_INVALID');
  }
  return Object.freeze({
    ...parsed,
    prefixes: Object.freeze([...parsed.prefixes]) as unknown as string[],
    deprecatedOrReplaced: Object.freeze({ ...parsed.deprecatedOrReplaced }),
    notes: Object.freeze([...(parsed.notes || [])]) as unknown as string[],
  });
}

function normalizeOkved(code: string | null | undefined): string | null {
  const normalized = String(code || '').trim().replace(/[^0-9.]/g, '');
  return normalized && /^\d{2}(?:\.\d+)*$/.test(normalized) ? normalized : null;
}

function dictionaryMatch(code: string, dictionary: FarmerOkvedDictionary): boolean {
  const canonical = dictionary.deprecatedOrReplaced[code] || code;
  return dictionary.prefixes.some((prefix) => canonical === prefix || canonical.startsWith(`${prefix}.`));
}

function agriculturalOkvedEvidence(input: EligibilityPolicyInput, dictionary: FarmerOkvedDictionary): boolean {
  const primary = normalizeOkved(input.facts.okved?.primary);
  const additional = (input.facts.okved?.additional || []).map(normalizeOkved).filter(Boolean) as string[];
  return [primary, ...additional].filter(Boolean).some((code) => dictionaryMatch(code as string, dictionary));
}

function sourceFailure(
  input: EligibilityPolicyInput,
  source: EligibilitySource,
): EligibilityPolicyDecision | null {
  const state = input.sourceStates[source];
  if (state === 'STALE') return { verdict: 'STALE', reasonCodes: [`${source}_EVIDENCE_STALE`] };
  if (state === 'UNAVAILABLE') return { verdict: 'SOURCE_UNAVAILABLE', reasonCodes: [`${source}_UNAVAILABLE`] };
  if (state === 'SCHEMA_CHANGED') return { verdict: 'SOURCE_UNAVAILABLE', reasonCodes: [`${source}_SCHEMA_CHANGED`] };
  return null;
}

function requireSourceEvidence(
  input: EligibilityPolicyInput,
  source: EligibilitySource,
): EligibilityPolicyDecision | null {
  const failure = sourceFailure(input, source);
  if (failure) return failure;
  if (!input.evidenceSources.includes(source)) {
    return { verdict: 'REVIEW_REQUIRED', reasonCodes: [`${source}_AUTHORITATIVE_EVIDENCE_INSUFFICIENT`] };
  }
  return null;
}

function identityMismatch(input: EligibilityPolicyInput): EligibilityPolicyDecision | null {
  const identity = input.facts.identity;
  if (input.facts.strongContradiction) {
    return { verdict: 'APPARENT_MISMATCH', reasonCodes: ['STRONG_AUTHORITATIVE_CONTRADICTION'] };
  }
  if (identity.exists && (!identity.active || !identity.innMatch || identity.ogrnMatch === false)) {
    return { verdict: 'APPARENT_MISMATCH', reasonCodes: ['ORGANIZATION_IDENTITY_OR_STATUS_MISMATCH'] };
  }
  return null;
}

export class RoleEligibilityPolicy {
  readonly version: string;
  readonly hash: string;
  readonly farmerDictionary: FarmerOkvedDictionary;

  constructor(version = String(process.env.ROLE_ELIGIBILITY_POLICY_VERSION || '2026-09-02.v1').trim()) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(version)) throw new Error('ROLE_ELIGIBILITY_POLICY_VERSION_INVALID');
    this.version = version;
    this.farmerDictionary = loadFarmerDictionary();
    this.hash = sha256(stableJson({
      version: this.version,
      ruleset: POLICY_RULESET,
      farmerDictionary: this.farmerDictionary,
    }));
  }

  resolveSemanticRole(candidate: RoleEligibilityCandidate): SemanticEligibilityRole {
    const workspace = String(candidate.requestedWorkspace || '').trim().toLowerCase();
    const expectedInternalRole = REGISTRATION_ROLE_CONTRACT[workspace];
    const semanticRole = WORKSPACE_ELIGIBILITY_ROLE[workspace];
    if (!expectedInternalRole || !semanticRole) throw new Error('ROLE_ELIGIBILITY_WORKSPACE_UNSUPPORTED');
    if (candidate.requestedRole !== expectedInternalRole) {
      throw new Error('ROLE_ELIGIBILITY_REGISTRATION_ROLE_CONTRACT_MISMATCH');
    }
    return semanticRole;
  }

  evaluate(input: EligibilityPolicyInput): EligibilityPolicyDecision {
    if (input.semanticRole === 'DRIVER') {
      return { verdict: 'NOT_APPLICABLE', reasonCodes: ['DRIVER_ORGANIZATION_ELIGIBILITY_NOT_APPLICABLE'] };
    }
    if (input.semanticRole === 'EMPLOYEE') {
      return { verdict: 'NOT_APPLICABLE', reasonCodes: ['EMPLOYEE_ORGANIZATION_ELIGIBILITY_NOT_APPLICABLE'] };
    }

    if (input.semanticRole === 'SURVEYOR') {
      return { verdict: 'REVIEW_REQUIRED', reasonCodes: ['SURVEYOR_SPECIALIZED_AUTHORITY_NOT_CONFIGURED'] };
    }

    if (input.semanticRole === 'LABORATORY') {
      const sourceFailureDecision = sourceFailure(input, 'ROSACCREDITATION');
      if (sourceFailureDecision && !input.evidenceSources.includes('ROSACCREDITATION')) {
        return { verdict: 'REVIEW_REQUIRED', reasonCodes: ['LAB_SAFE_OFFICIAL_ADAPTER_NOT_PROVEN'] };
      }
      const source = requireSourceEvidence(input, 'ROSACCREDITATION');
      if (source) return source;
      const mismatch = identityMismatch(input);
      if (mismatch) return mismatch;
      const accreditation = input.facts.accreditation;
      if (
        input.facts.identity.exists
        && input.facts.identity.active
        && accreditation?.present
        && accreditation.active
        && accreditation.scopeRelevant
      ) {
        return { verdict: 'ELIGIBLE', reasonCodes: ['ACCREDITATION_ACTIVE_SCOPE_RELEVANT'] };
      }
      return { verdict: 'REVIEW_REQUIRED', reasonCodes: ['ACCREDITATION_RECORD_INSUFFICIENT'] };
    }

    if (input.semanticRole === 'BANK') {
      const source = requireSourceEvidence(input, 'CBR');
      if (source) return source;
      const bank = input.facts.cbr;
      if (bank?.present && bank.active && bank.creditOrganization && bank.licenseValid) {
        return { verdict: 'ELIGIBLE', reasonCodes: ['CBR_ACTIVE_CREDIT_ORGANIZATION_LICENSE_VALID'] };
      }
      return { verdict: 'APPARENT_MISMATCH', reasonCodes: ['CBR_BANK_AUTHORITY_NOT_CONFIRMED'] };
    }

    const fns = requireSourceEvidence(input, 'FNS');
    if (fns) return fns;
    const mismatch = identityMismatch(input);
    if (mismatch) return mismatch;
    if (!input.facts.identity.exists) {
      return { verdict: 'REVIEW_REQUIRED', reasonCodes: ['FNS_ENTITY_IDENTITY_NOT_CONFIRMED'] };
    }
    if (!input.facts.identity.active || !input.facts.identity.innMatch || input.facts.identity.ogrnMatch === false) {
      return { verdict: 'APPARENT_MISMATCH', reasonCodes: ['FNS_ENTITY_NOT_ACTIVE_OR_IDENTITY_MISMATCH'] };
    }

    if (input.semanticRole === 'BUYER') {
      return { verdict: 'ELIGIBLE', reasonCodes: ['ACTIVE_ENTITY_IDENTITY_MATCH'] };
    }

    if (input.semanticRole === 'FARMER') {
      if (agriculturalOkvedEvidence(input, this.farmerDictionary)) {
        return { verdict: 'ELIGIBLE', reasonCodes: ['ACTIVE_ENTITY_AGRICULTURAL_ACTIVITY_EVIDENCE'] };
      }
      return { verdict: 'REVIEW_REQUIRED', reasonCodes: ['AGRICULTURAL_ACTIVITY_EVIDENCE_AMBIGUOUS'] };
    }

    if (input.semanticRole === 'LOGISTICS') {
      if (input.facts.logistics?.transportProfile && input.facts.logistics.governmentEvidence) {
        return { verdict: 'ELIGIBLE', reasonCodes: ['ACTIVE_ENTITY_LOGISTICS_PROFILE_GOVERNMENT_EVIDENCE'] };
      }
      return { verdict: 'REVIEW_REQUIRED', reasonCodes: ['TRANSPORT_OKVED_ALONE_NOT_ABSOLUTE_PROOF'] };
    }

    if (input.semanticRole === 'ELEVATOR') {
      const source = requireSourceEvidence(input, 'FGIS_GRAIN');
      if (source) return source;
      const elevator = input.facts.fgisGrain;
      if (elevator?.present && elevator.active && elevator.elevatorRecord) {
        return { verdict: 'ELIGIBLE', reasonCodes: ['FGIS_GRAIN_ACTIVE_ELEVATOR_RECORD'] };
      }
      return { verdict: 'REVIEW_REQUIRED', reasonCodes: ['FGIS_GRAIN_SPECIALIZED_RECORD_NOT_CONFIRMED'] };
    }

    return { verdict: 'ERROR', reasonCodes: ['POLICY_ROLE_UNREACHABLE'] };
  }
}
