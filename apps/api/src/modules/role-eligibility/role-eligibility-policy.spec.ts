import { RoleEligibilityPolicy } from './role-eligibility-policy';
import type { EligibilityPolicyInput, RoleEligibilityCandidate, SemanticEligibilityRole } from './role-eligibility.types';

const candidate = (workspace: string, role: string): RoleEligibilityCandidate => ({
  applicationId: 'app-1',
  applicationVersion: 1n,
  applicationStatus: 'ORGANIZATION_VERIFICATION_PENDING',
  organizationId: 'org-1',
  tenantId: 'tenant-1',
  requestedWorkspace: workspace,
  requestedRole: role,
  inn: '7707083893',
  ogrn: '1027700132195',
  kpp: '773601001',
  legalName: 'ООО Тест',
  submittedAt: new Date('2026-09-02T00:00:00Z'),
});

const input = (semanticRole: SemanticEligibilityRole, overrides: Partial<EligibilityPolicyInput> = {}): EligibilityPolicyInput => ({
  candidate: candidate('buyer', 'BUYER'),
  semanticRole,
  facts: {
    identity: { exists: true, active: true, innMatch: true, ogrnMatch: true },
    cbr: { present: false, active: false, creditOrganization: false, licenseValid: false },
    fgisGrain: { present: false, active: false, elevatorRecord: false },
    accreditation: { present: false, active: false, scopeRelevant: false },
    logistics: { transportProfile: false, governmentEvidence: false },
  },
  sourceStates: {},
  evidenceSources: ['FNS'],
  ...overrides,
});

describe('RoleEligibilityPolicy', () => {
  const policy = new RoleEligibilityPolicy('2026-09-02.test');

  it('preserves registration role mapping instead of trusting a semantic role from the client', () => {
    expect(policy.resolveSemanticRole(candidate('bank', 'ACCOUNTING'))).toBe('BANK');
    expect(() => policy.resolveSemanticRole(candidate('bank', 'BANK'))).toThrow('ROLE_ELIGIBILITY_REGISTRATION_ROLE_CONTRACT_MISMATCH');
  });

  it('ordinary LLC is never automatically eligible as BANK', () => {
    const result = policy.evaluate(input('BANK', {
      candidate: candidate('bank', 'ACCOUNTING'),
      evidenceSources: ['CBR'],
    }));
    expect(result.verdict).toBe('APPARENT_MISMATCH');
  });

  it('word Bank in a legal name is irrelevant without CBR authority', () => {
    const result = policy.evaluate(input('BANK', {
      candidate: { ...candidate('bank', 'ACCOUNTING'), legalName: 'ООО Банк Урожай' },
      evidenceSources: ['CBR'],
    }));
    expect(result.verdict).not.toBe('ELIGIBLE');
  });

  it('hairdresser is not FARMER eligible on active identity alone', () => {
    const result = policy.evaluate(input('FARMER', {
      candidate: candidate('seller', 'FARMER'),
      facts: {
        ...input('FARMER').facts,
        okved: { primary: '96.02', additional: [] },
      },
    }));
    expect(result.verdict).toBe('REVIEW_REQUIRED');
  });

  it('agricultural primary or additional OKVED is evidence but only after authoritative identity', () => {
    const result = policy.evaluate(input('FARMER', {
      candidate: candidate('seller', 'FARMER'),
      facts: {
        ...input('FARMER').facts,
        okved: { primary: '46.21', additional: ['01.11'] },
      },
    }));
    expect(result.verdict).toBe('ELIGIBLE');
  });

  it('transport OKVED/profile alone is not absolute logistics proof', () => {
    const result = policy.evaluate(input('LOGISTICS', {
      candidate: candidate('logistics', 'LOGISTICIAN'),
      facts: {
        ...input('LOGISTICS').facts,
        logistics: { transportProfile: true, governmentEvidence: false },
      },
    }));
    expect(result.verdict).toBe('REVIEW_REQUIRED');
  });

  it('laboratory name is irrelevant without accreditation evidence', () => {
    const result = policy.evaluate(input('LABORATORY', {
      candidate: { ...candidate('lab', 'LAB'), legalName: 'ООО Лаборатория' },
      evidenceSources: [],
      sourceStates: { ROSACCREDITATION: 'UNAVAILABLE' },
    }));
    expect(result.verdict).toBe('REVIEW_REQUIRED');
  });

  it('driver and employee are NOT_APPLICABLE', () => {
    expect(policy.evaluate(input('DRIVER')).verdict).toBe('NOT_APPLICABLE');
    expect(policy.evaluate(input('EMPLOYEE')).verdict).toBe('NOT_APPLICABLE');
  });

  it('fails closed on stale or unavailable required authoritative source', () => {
    expect(policy.evaluate(input('BUYER', { sourceStates: { FNS: 'STALE' } })).verdict).toBe('STALE');
    expect(policy.evaluate(input('BUYER', { sourceStates: { FNS: 'UNAVAILABLE' } })).verdict).toBe('SOURCE_UNAVAILABLE');
    expect(policy.evaluate(input('BUYER', { sourceStates: { FNS: 'SCHEMA_CHANGED' } })).verdict).toBe('SOURCE_UNAVAILABLE');
  });
});
