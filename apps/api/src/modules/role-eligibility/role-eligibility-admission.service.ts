import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleEligibilityEnforcementRepository } from './role-eligibility-enforcement.repository';
import { roleEligibilityEnforcementPolicyHash } from './role-eligibility-enforcement-policy';
import type { RoleEligibilityAdmissionDecision } from './role-eligibility-enforcement.types';
import { RoleEligibilityPolicy } from './role-eligibility-policy';
import { RoleEligibilityRepository } from './role-eligibility.repository';

const EXACT_SHA = /^[0-9a-f]{40}$/;

@Injectable()
export class RoleEligibilityAdmissionService {
  private readonly eligibilityPolicy = new RoleEligibilityPolicy();

  constructor(
    private readonly eligibilityRepository: RoleEligibilityRepository,
    private readonly enforcementRepository: RoleEligibilityEnforcementRepository,
  ) {}

  async decide(applicationId: string, now: Date = new Date()): Promise<RoleEligibilityAdmissionDecision> {
    const candidate = await this.eligibilityRepository.readCandidate(applicationId);
    if (!candidate) throw new NotFoundException({ code: 'ROLE_ELIGIBILITY_APPLICATION_NOT_FOUND' });
    const semanticRole = this.eligibilityPolicy.resolveSemanticRole(candidate);
    const state = await this.enforcementRepository.state();
    const runtimeRequested = String(process.env.ROLE_ELIGIBILITY_ENFORCEMENT || 'false').toLowerCase() === 'true';

    if (!runtimeRequested) {
      return {
        decision: 'ADVISORY_ONLY',
        enforcementApplied: false,
        semanticRole,
        policyVersion: state.policyVersion,
        verdict: null,
        reasonCodes: ['ROLE_ELIGIBILITY_ENFORCEMENT_DISABLED'],
      };
    }
    if (!state.enabled) {
      return {
        decision: 'ADVISORY_ONLY',
        enforcementApplied: false,
        semanticRole,
        policyVersion: state.policyVersion,
        verdict: null,
        reasonCodes: ['ROLE_ELIGIBILITY_POSTGRES_ENFORCEMENT_DISABLED'],
      };
    }

    const releaseSha = String(process.env.ROLE_ELIGIBILITY_RELEASE_SHA || '').trim().toLowerCase();
    if (!EXACT_SHA.test(releaseSha) || state.exactSha !== releaseSha) {
      return this.review(semanticRole, state.policyVersion, null, 'ROLE_ELIGIBILITY_EXACT_SHA_MISMATCH');
    }
    if (!state.policyDocument || !state.policyHash || !state.policyVersion || state.policyDocument.version !== state.policyVersion) {
      return this.review(semanticRole, state.policyVersion, null, 'ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_UNAVAILABLE');
    }
    if (roleEligibilityEnforcementPolicyHash(state.policyDocument) !== state.policyHash) {
      return this.review(semanticRole, state.policyVersion, null, 'ROLE_ELIGIBILITY_ENFORCEMENT_POLICY_HASH_MISMATCH');
    }

    const rule = state.policyDocument.roles[semanticRole];
    if (!rule || rule.mode === 'ADVISORY_ONLY') {
      return {
        decision: 'ADVISORY_ONLY',
        enforcementApplied: false,
        semanticRole,
        policyVersion: state.policyVersion,
        verdict: null,
        reasonCodes: [rule?.reason || 'ROLE_ELIGIBILITY_ROLE_NOT_ENFORCED'],
      };
    }

    const current = await this.enforcementRepository.currentVerdict(
      candidate.applicationId,
      candidate.applicationVersion,
      candidate.requestedRole,
    );
    if (!current) return this.review(semanticRole, state.policyVersion, null, 'ROLE_ELIGIBILITY_CURRENT_VERDICT_MISSING');
    if (!rule.acceptedVerdicts.includes(current.verdict)) {
      return this.review(semanticRole, state.policyVersion, current.verdict, 'ROLE_ELIGIBILITY_VERDICT_NOT_ACCEPTED');
    }

    const sources = await this.enforcementRepository.verdictSources(current.id);
    for (const requiredSource of rule.requiredSources) {
      const matching = sources.filter((item) => item.source === requiredSource);
      if (!matching.length) {
        return this.review(semanticRole, state.policyVersion, current.verdict, `ROLE_ELIGIBILITY_SOURCE_PROVENANCE_MISSING:${requiredSource}`);
      }
      if (rule.requireFreshEvidence && matching.some((item) => item.evidenceFreshUntil.getTime() <= now.getTime())) {
        return this.review(semanticRole, state.policyVersion, current.verdict, `ROLE_ELIGIBILITY_EVIDENCE_STALE:${requiredSource}`);
      }
      if (rule.requireHealthySource && matching.some((item) => item.healthStatus !== 'HEALTHY')) {
        return this.review(semanticRole, state.policyVersion, current.verdict, `ROLE_ELIGIBILITY_SOURCE_NOT_HEALTHY:${requiredSource}`);
      }
      if (rule.requireHealthySource && matching.some((item) => !item.sourceFreshUntil || item.sourceFreshUntil.getTime() <= now.getTime())) {
        return this.review(semanticRole, state.policyVersion, current.verdict, `ROLE_ELIGIBILITY_SOURCE_STALE:${requiredSource}`);
      }
    }

    return {
      decision: 'ALLOW',
      enforcementApplied: true,
      semanticRole,
      policyVersion: state.policyVersion,
      verdict: current.verdict,
      reasonCodes: ['ROLE_ELIGIBILITY_ELIGIBLE_PROVENANCE_ACCEPTED'],
    };
  }

  private review(
    semanticRole: RoleEligibilityAdmissionDecision['semanticRole'],
    policyVersion: string | null,
    verdict: RoleEligibilityAdmissionDecision['verdict'],
    reasonCode: string,
  ): RoleEligibilityAdmissionDecision {
    return {
      decision: 'REVIEW_REQUIRED',
      enforcementApplied: true,
      semanticRole,
      policyVersion,
      verdict,
      reasonCodes: [reasonCode],
    };
  }
}
