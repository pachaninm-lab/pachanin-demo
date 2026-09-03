import { RoleEligibilityAdmissionService } from './role-eligibility-admission.service';
import {
  ROLE_ELIGIBILITY_READINESS_POLICY_V1,
  roleEligibilityEnforcementPolicyHash,
} from './role-eligibility-enforcement-policy';
import { RoleEligibilityPolicy } from './role-eligibility-policy';
import { sourceManifestHash } from './role-eligibility-security';

const RELEASE_SHA = 'a'.repeat(40);
const NOW = new Date('2026-09-03T12:00:00.000Z');
const SOURCE_PUBLISHED_AT = new Date('2026-09-03T00:00:00.000Z');
const FRESH_UNTIL = new Date('2026-09-04T00:00:00.000Z');

const bankCandidate = {
  applicationId: 'app-bank-1',
  applicationVersion: 7n,
  applicationStatus: 'ORGANIZATION_VERIFICATION_PENDING',
  organizationId: 'org-bank-1',
  tenantId: 'tenant-bank-1',
  requestedWorkspace: 'bank',
  requestedRole: 'ACCOUNTING',
  inn: '7707083893',
  ogrn: '1027700132195',
  kpp: '773601001',
  legalName: 'АО Тестовый Банк',
  submittedAt: new Date('2026-09-03T09:00:00.000Z'),
};

const source = {
  source: 'CBR' as const,
  generation: 'cbr-2026-09-03',
  evidenceId: 'ele-cbr-1',
  evidenceHash: 'b'.repeat(64),
  sourcePublishedAt: SOURCE_PUBLISHED_AT,
  parserVersion: 'cbr-registry-v1',
  evidenceFreshUntil: FRESH_UNTIL,
  healthStatus: 'HEALTHY',
  sourceFreshUntil: FRESH_UNTIL,
};

const manifestHash = sourceManifestHash([{
  source: source.source,
  generation: source.generation,
  evidenceId: source.evidenceId,
  evidenceHash: source.evidenceHash,
  sourcePublishedAt: source.sourcePublishedAt.toISOString(),
  parserVersion: source.parserVersion,
}]);

const policyDocument = JSON.parse(JSON.stringify(ROLE_ELIGIBILITY_READINESS_POLICY_V1));
const enforcementState = {
  enabled: true,
  generation: 1n,
  exactSha: RELEASE_SHA,
  policyId: 'rep-2026-09-03-v1',
  policyVersion: policyDocument.version,
  policyHash: roleEligibilityEnforcementPolicyHash(policyDocument),
  policyDocument,
};

describe('RoleEligibilityAdmissionService', () => {
  const originalEnforcement = process.env.ROLE_ELIGIBILITY_ENFORCEMENT;
  const originalReleaseSha = process.env.ROLE_ELIGIBILITY_RELEASE_SHA;
  const originalPolicyVersion = process.env.ROLE_ELIGIBILITY_POLICY_VERSION;

  let eligibilityRepository: { readCandidate: jest.Mock };
  let enforcementRepository: {
    state: jest.Mock;
    currentVerdict: jest.Mock;
    verdictSources: jest.Mock;
  };

  beforeEach(() => {
    process.env.ROLE_ELIGIBILITY_POLICY_VERSION = '2026-09-02.v1';
    process.env.ROLE_ELIGIBILITY_RELEASE_SHA = RELEASE_SHA;
    process.env.ROLE_ELIGIBILITY_ENFORCEMENT = 'true';
    eligibilityRepository = { readCandidate: jest.fn().mockResolvedValue(bankCandidate) };
    enforcementRepository = {
      state: jest.fn().mockResolvedValue(enforcementState),
      currentVerdict: jest.fn(),
      verdictSources: jest.fn(),
    };
  });

  afterAll(() => {
    if (originalEnforcement === undefined) delete process.env.ROLE_ELIGIBILITY_ENFORCEMENT;
    else process.env.ROLE_ELIGIBILITY_ENFORCEMENT = originalEnforcement;
    if (originalReleaseSha === undefined) delete process.env.ROLE_ELIGIBILITY_RELEASE_SHA;
    else process.env.ROLE_ELIGIBILITY_RELEASE_SHA = originalReleaseSha;
    if (originalPolicyVersion === undefined) delete process.env.ROLE_ELIGIBILITY_POLICY_VERSION;
    else process.env.ROLE_ELIGIBILITY_POLICY_VERSION = originalPolicyVersion;
  });

  const createService = () => new RoleEligibilityAdmissionService(
    eligibilityRepository as any,
    enforcementRepository as any,
  );

  const currentEligibleVerdict = () => {
    const eligibilityPolicy = new RoleEligibilityPolicy('2026-09-02.v1');
    return {
      id: 'elv-bank-1',
      verdict: 'ELIGIBLE' as const,
      policyVersion: eligibilityPolicy.version,
      policyHash: eligibilityPolicy.hash,
      sourceManifestHash: manifestHash,
    };
  };

  it('does not read enforcement state at all while runtime enforcement is disabled', async () => {
    process.env.ROLE_ELIGIBILITY_ENFORCEMENT = 'false';
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result).toMatchObject({
      decision: 'ADVISORY_ONLY',
      enforcementApplied: false,
      semanticRole: 'BANK',
      reasonCodes: ['ROLE_ELIGIBILITY_ENFORCEMENT_DISABLED'],
    });
    expect(enforcementRepository.state).not.toHaveBeenCalled();
    expect(enforcementRepository.currentVerdict).not.toHaveBeenCalled();
  });

  it('fails closed to review if PostgreSQL enforcement state cannot be read', async () => {
    enforcementRepository.state.mockRejectedValue(new Error('relation eligibility.enforcement_state does not exist'));
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result).toMatchObject({
      decision: 'REVIEW_REQUIRED',
      enforcementApplied: true,
      reasonCodes: ['ROLE_ELIGIBILITY_ENFORCEMENT_STATE_UNAVAILABLE'],
    });
  });

  it('requires runtime and PostgreSQL enforcement authority to agree', async () => {
    enforcementRepository.state.mockResolvedValue({ ...enforcementState, enabled: false });
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result).toMatchObject({
      decision: 'ADVISORY_ONLY',
      enforcementApplied: false,
      reasonCodes: ['ROLE_ELIGIBILITY_POSTGRES_ENFORCEMENT_DISABLED'],
    });
    expect(enforcementRepository.currentVerdict).not.toHaveBeenCalled();
  });

  it('fails closed when exact release SHA does not match PostgreSQL authority', async () => {
    enforcementRepository.state.mockResolvedValue({ ...enforcementState, exactSha: 'c'.repeat(40) });
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result.reasonCodes).toEqual(['ROLE_ELIGIBILITY_EXACT_SHA_MISMATCH']);
    expect(result.decision).toBe('REVIEW_REQUIRED');
  });

  it('keeps unproven role paths advisory even if the global enforcement state is enabled', async () => {
    eligibilityRepository.readCandidate.mockResolvedValue({
      ...bankCandidate,
      requestedWorkspace: 'buyer',
      requestedRole: 'BUYER',
    });
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result).toMatchObject({
      decision: 'ADVISORY_ONLY',
      enforcementApplied: false,
      semanticRole: 'BUYER',
      reasonCodes: ['FNS_MACHINE_CONTRACT_UNPROVEN'],
    });
    expect(enforcementRepository.currentVerdict).not.toHaveBeenCalled();
  });

  it('fails closed when the immutable verdict was produced by a different eligibility policy', async () => {
    enforcementRepository.currentVerdict.mockResolvedValue({
      ...currentEligibleVerdict(),
      policyHash: 'd'.repeat(64),
    });
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result.reasonCodes).toEqual(['ROLE_ELIGIBILITY_VERDICT_POLICY_MISMATCH']);
    expect(result.decision).toBe('REVIEW_REQUIRED');
  });

  it('fails closed when source-manifest provenance no longer matches the verdict', async () => {
    enforcementRepository.currentVerdict.mockResolvedValue(currentEligibleVerdict());
    enforcementRepository.verdictSources.mockResolvedValue([{ ...source, evidenceHash: 'e'.repeat(64) }]);
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result.reasonCodes).toEqual(['ROLE_ELIGIBILITY_SOURCE_MANIFEST_MISMATCH']);
    expect(result.decision).toBe('REVIEW_REQUIRED');
  });

  it('fails closed when required authoritative evidence or source health is stale', async () => {
    enforcementRepository.currentVerdict.mockResolvedValue(currentEligibleVerdict());
    enforcementRepository.verdictSources.mockResolvedValue([{
      ...source,
      evidenceFreshUntil: new Date('2026-09-03T11:59:59.000Z'),
    }]);
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result.reasonCodes).toEqual(['ROLE_ELIGIBILITY_EVIDENCE_STALE:CBR']);
    expect(result.decision).toBe('REVIEW_REQUIRED');
  });

  it('allows BANK only with current policy, intact manifest, fresh evidence and healthy CBR provenance', async () => {
    enforcementRepository.currentVerdict.mockResolvedValue(currentEligibleVerdict());
    enforcementRepository.verdictSources.mockResolvedValue([source]);
    const result = await createService().decide(bankCandidate.applicationId, NOW);
    expect(result).toMatchObject({
      decision: 'ALLOW',
      enforcementApplied: true,
      semanticRole: 'BANK',
      verdict: 'ELIGIBLE',
      reasonCodes: ['ROLE_ELIGIBILITY_ELIGIBLE_PROVENANCE_ACCEPTED'],
    });
  });
});
