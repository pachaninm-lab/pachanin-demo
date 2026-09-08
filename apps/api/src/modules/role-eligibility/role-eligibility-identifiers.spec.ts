import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RoleEligibilityAdmissionService } from './role-eligibility-admission.service';
import { isValidRussianInn } from './role-eligibility-policy';
import { RoleEligibilityService } from './role-eligibility.service';

const validBankCandidate = {
  applicationId: 'app-bank-valid',
  applicationVersion: 1n,
  applicationStatus: 'ORGANIZATION_VERIFICATION_PENDING',
  organizationId: 'org-bank-valid',
  tenantId: 'tenant-bank-valid',
  requestedWorkspace: 'bank',
  requestedRole: 'ACCOUNTING',
  inn: '7707083893',
  ogrn: '1027700132195',
  kpp: '773601001',
  legalName: 'АО Банк',
  submittedAt: new Date('2026-09-05T00:00:00.000Z'),
};

const invalidBankCandidate = { ...validBankCandidate, applicationId: 'app-bank-invalid', inn: '7707083894' };

describe('Role Eligibility authoritative identifier admission', () => {
  const originalEnabled = process.env.ROLE_ELIGIBILITY_ENABLED;
  const originalShadow = process.env.ROLE_ELIGIBILITY_SHADOW_MODE;
  const originalEnforcement = process.env.ROLE_ELIGIBILITY_ENFORCEMENT;
  const originalPolicyVersion = process.env.ROLE_ELIGIBILITY_POLICY_VERSION;

  beforeEach(() => {
    process.env.ROLE_ELIGIBILITY_ENABLED = 'true';
    process.env.ROLE_ELIGIBILITY_SHADOW_MODE = 'true';
    process.env.ROLE_ELIGIBILITY_ENFORCEMENT = 'false';
    process.env.ROLE_ELIGIBILITY_POLICY_VERSION = '2026-09-02.v1';
  });

  afterAll(() => {
    if (originalEnabled === undefined) delete process.env.ROLE_ELIGIBILITY_ENABLED;
    else process.env.ROLE_ELIGIBILITY_ENABLED = originalEnabled;
    if (originalShadow === undefined) delete process.env.ROLE_ELIGIBILITY_SHADOW_MODE;
    else process.env.ROLE_ELIGIBILITY_SHADOW_MODE = originalShadow;
    if (originalEnforcement === undefined) delete process.env.ROLE_ELIGIBILITY_ENFORCEMENT;
    else process.env.ROLE_ELIGIBILITY_ENFORCEMENT = originalEnforcement;
    if (originalPolicyVersion === undefined) delete process.env.ROLE_ELIGIBILITY_POLICY_VERSION;
    else process.env.ROLE_ELIGIBILITY_POLICY_VERSION = originalPolicyVersion;
  });

  it('implements both Russian 10-digit and 12-digit INN checksum contracts', () => {
    expect(isValidRussianInn('7707083893')).toBe(true);
    expect(isValidRussianInn('500100732259')).toBe(true);
    expect(isValidRussianInn('7707083894')).toBe(false);
    expect(isValidRussianInn('500100732258')).toBe(false);
    expect(isValidRussianInn('123')).toBe(false);
    expect(isValidRussianInn('770708389A')).toBe(false);
  });

  it('keeps automatic discovery bounded to checksum-valid identifiers before LIMIT with format-guarded SQL casts', () => {
    const source = readFileSync(join(process.cwd(), 'src/modules/role-eligibility/role-eligibility-worker.repository.ts'), 'utf8');
    expect(source).toContain('VALID_RUSSIAN_INN_SQL');
    expect(source).toContain("WHEN candidate.inn ~ '^[0-9]{10}$' THEN");
    expect(source).toContain("WHEN candidate.inn ~ '^[0-9]{12}$' THEN");
    expect(source).toContain('ELSE FALSE');
    expect(source).toMatch(/AND \$\{VALID_RUSSIAN_INN_SQL\}[\s\S]*LIMIT \$\{safeLimit\}/);
  });

  it('rejects a manual shadow recheck before creating a new check for an invalid identifier', async () => {
    const repository = {
      readCandidate: jest.fn().mockResolvedValue(invalidBankCandidate),
      activeGenerationFingerprint: jest.fn(),
      latestCheck: jest.fn(),
      createOrGetCheck: jest.fn(),
    };
    const service = new RoleEligibilityService(repository as any);

    await expect(service.recheck(
      invalidBankCandidate.applicationId,
      {} as any,
      'role-eligibility-recheck-0001',
    )).rejects.toMatchObject({
      response: { code: 'ROLE_ELIGIBILITY_IDENTIFIER_CHECKSUM_INVALID' },
    });
    expect(repository.activeGenerationFingerprint).not.toHaveBeenCalled();
    expect(repository.createOrGetCheck).not.toHaveBeenCalled();
  });

  it('fails closed before enforcement-state reads when an invalid identifier reaches admission', async () => {
    process.env.ROLE_ELIGIBILITY_ENFORCEMENT = 'true';
    const eligibilityRepository = { readCandidate: jest.fn().mockResolvedValue(invalidBankCandidate) };
    const enforcementRepository = {
      state: jest.fn(),
      currentVerdict: jest.fn(),
      verdictSources: jest.fn(),
    };
    const service = new RoleEligibilityAdmissionService(
      eligibilityRepository as any,
      enforcementRepository as any,
    );

    await expect(service.decide(invalidBankCandidate.applicationId)).resolves.toMatchObject({
      decision: 'REVIEW_REQUIRED',
      enforcementApplied: true,
      semanticRole: 'BANK',
      reasonCodes: ['ROLE_ELIGIBILITY_IDENTIFIER_CHECKSUM_INVALID'],
    });
    expect(enforcementRepository.state).not.toHaveBeenCalled();
    expect(enforcementRepository.currentVerdict).not.toHaveBeenCalled();
  });
});
