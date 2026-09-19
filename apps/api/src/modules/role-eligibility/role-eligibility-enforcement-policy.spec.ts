import {
  parseRoleEligibilityEnforcementPolicy,
  ROLE_ELIGIBILITY_READINESS_POLICY_V1,
  roleEligibilityEnforcementPolicyHash,
} from './role-eligibility-enforcement-policy';

const clone = (): any => JSON.parse(JSON.stringify(ROLE_ELIGIBILITY_READINESS_POLICY_V1));

describe('RoleEligibilityEnforcementPolicy', () => {
  it('parses the bounded readiness policy and hashes it deterministically', () => {
    const parsed = parseRoleEligibilityEnforcementPolicy(clone());
    expect(parsed).not.toBeNull();
    expect(parsed?.roles.BANK).toEqual({
      mode: 'ENFORCE',
      acceptedVerdicts: ['ELIGIBLE'],
      requiredSources: ['CBR'],
      requireFreshEvidence: true,
      requireHealthySource: true,
    });
    expect(roleEligibilityEnforcementPolicyHash(parsed!)).toBe(roleEligibilityEnforcementPolicyHash(parsed!));
  });

  it('rejects unknown root and role fields instead of silently accepting ambiguous semantics', () => {
    const root = clone();
    root.unknownAuthority = true;
    expect(parseRoleEligibilityEnforcementPolicy(root)).toBeNull();

    const rule = clone();
    rule.roles.BANK.allowReviewRequired = true;
    expect(parseRoleEligibilityEnforcementPolicy(rule)).toBeNull();
  });

  it('allows entitlement only from ELIGIBLE and never from ambiguous or negative verdicts', () => {
    for (const verdict of ['REVIEW_REQUIRED', 'APPARENT_MISMATCH', 'SOURCE_UNAVAILABLE', 'STALE', 'NOT_APPLICABLE', 'ERROR']) {
      const document = clone();
      document.roles.BANK.acceptedVerdicts = [verdict];
      expect(parseRoleEligibilityEnforcementPolicy(document)).toBeNull();
    }
  });

  it('requires fresh healthy authoritative provenance for every enforced role', () => {
    const noSource = clone();
    noSource.roles.BANK.requiredSources = [];
    expect(parseRoleEligibilityEnforcementPolicy(noSource)).toBeNull();

    const staleAllowed = clone();
    staleAllowed.roles.BANK.requireFreshEvidence = false;
    expect(parseRoleEligibilityEnforcementPolicy(staleAllowed)).toBeNull();

    const unhealthyAllowed = clone();
    unhealthyAllowed.roles.BANK.requireHealthySource = false;
    expect(parseRoleEligibilityEnforcementPolicy(unhealthyAllowed)).toBeNull();
  });

  it('never accepts supplementary FNS RSMP evidence as a mandatory enforcement authority', () => {
    const document = clone();
    document.roles.BANK.requiredSources = ['FNS_RSMP'];
    expect(parseRoleEligibilityEnforcementPolicy(document)).toBeNull();
  });

  it('requires an explicit rule for all nine semantic roles', () => {
    const document = clone();
    delete document.roles.ELEVATOR;
    expect(parseRoleEligibilityEnforcementPolicy(document)).toBeNull();
  });
});
