import { RoleEligibilityPolicy } from './role-eligibility-policy';
import type { EligibilityPolicyInput, RoleEligibilityCandidate, SemanticEligibilityRole } from './role-eligibility.types';

const candidate = (workspace: string, role: string): RoleEligibilityCandidate => ({
  applicationId: 'app-specialized',
  applicationVersion: 1n,
  applicationStatus: 'ORGANIZATION_VERIFICATION_PENDING',
  organizationId: 'org-specialized',
  tenantId: 'tenant-specialized',
  requestedWorkspace: workspace,
  requestedRole: role,
  inn: '7707083893',
  ogrn: '1027700132195',
  kpp: '773601001',
  legalName: 'ООО Тест',
  submittedAt: new Date('2026-09-02T00:00:00Z'),
});

const base = (semanticRole: SemanticEligibilityRole): EligibilityPolicyInput => ({
  candidate: candidate('buyer', 'BUYER'),
  semanticRole,
  facts: {
    identity: { exists: false, active: false, innMatch: false, ogrnMatch: null },
    cbr: { present: false, active: false, creditOrganization: false, licenseValid: false },
    fgisGrain: { present: false, active: false, elevatorRecord: false },
    accreditation: { present: false, active: false, scopeRelevant: false },
    logistics: { transportProfile: false, governmentEvidence: false },
  },
  sourceStates: {},
  evidenceSources: [],
});

describe('RoleEligibilityPolicy specialized authorities', () => {
  const policy = new RoleEligibilityPolicy('2026-09-02.specialized-test');

  it('allows FGIS elevator authority to decide independently of FNS availability', () => {
    const input: EligibilityPolicyInput = {
      ...base('ELEVATOR'),
      candidate: candidate('elevator', 'ELEVATOR'),
      sourceStates: { FNS: 'UNAVAILABLE', FGIS_GRAIN: 'HEALTHY' },
      evidenceSources: ['FGIS_GRAIN'],
      facts: {
        ...base('ELEVATOR').facts,
        fgisGrain: { present: true, active: true, elevatorRecord: true },
      },
    };
    expect(policy.evaluate(input)).toEqual({
      verdict: 'ELIGIBLE',
      reasonCodes: ['FGIS_GRAIN_ACTIVE_IDENTITY_MATCH_ELEVATOR_RECORD'],
    });
  });

  it('does not turn missing FGIS elevator evidence into automatic rejection', () => {
    const input: EligibilityPolicyInput = {
      ...base('ELEVATOR'),
      candidate: candidate('elevator', 'ELEVATOR'),
      sourceStates: { FGIS_GRAIN: 'HEALTHY' },
      evidenceSources: [],
    };
    expect(policy.evaluate(input).verdict).toBe('REVIEW_REQUIRED');
  });

  it('allows matching active accreditation evidence without requiring FNS', () => {
    const input: EligibilityPolicyInput = {
      ...base('LABORATORY'),
      candidate: candidate('lab', 'LAB'),
      sourceStates: { FNS: 'UNAVAILABLE', ROSACCREDITATION: 'HEALTHY' },
      evidenceSources: ['ROSACCREDITATION'],
      facts: {
        ...base('LABORATORY').facts,
        accreditation: {
          present: true,
          active: true,
          accreditedPersonType: 'Испытательная лаборатория',
          scopeRelevant: true,
        },
      },
    };
    expect(policy.evaluate(input)).toEqual({
      verdict: 'ELIGIBLE',
      reasonCodes: ['ACCREDITATION_ACTIVE_IDENTITY_MATCH_SCOPE_RELEVANT'],
    });
  });

  it('keeps laboratory fail-closed when safe official adapter is unavailable', () => {
    const input: EligibilityPolicyInput = {
      ...base('LABORATORY'),
      candidate: candidate('lab', 'LAB'),
      sourceStates: { ROSACCREDITATION: 'UNAVAILABLE' },
    };
    expect(policy.evaluate(input).verdict).toBe('REVIEW_REQUIRED');
  });
});
