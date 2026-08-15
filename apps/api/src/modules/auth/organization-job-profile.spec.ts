import { ORGANIZATION_HUMAN_ROLES } from './organization-role-policy';
import {
  JobProfile,
  ORGANIZATION_JOB_PROFILES,
  canAssignJobProfile,
  isJobProfile,
  isSingularJobProfile,
} from './organization-job-profile';

describe('organization job profile', () => {
  it('exposes exactly the eleven contract profiles', () => {
    expect([...ORGANIZATION_JOB_PROFILES].sort()).toEqual(
      [
        'ACCOUNTANT',
        'CHIEF_ACCOUNTANT',
        'DIRECTOR',
        'DOCUMENT_SPECIALIST',
        'EXTERNAL_ACCOUNTANT',
        'LOGISTICS_MANAGER',
        'OWNER',
        'PROCUREMENT_MANAGER',
        'SALES_MANAGER',
        'SIGNER',
        'VIEWER',
      ].sort(),
    );
  });

  describe('separation from the market role axis', () => {
    it('shares no identifier with the nine market roles', () => {
      const roles = new Set<string>(ORGANIZATION_HUMAN_ROLES);
      const collisions = ORGANIZATION_JOB_PROFILES.filter((p) => roles.has(p));
      expect(collisions).toEqual([]);
    });

    it('does not define an ACCOUNTING profile, which stays the bank role', () => {
      expect(isJobProfile('ACCOUNTING')).toBe(false);
      expect(ORGANIZATION_HUMAN_ROLES).toContain('ACCOUNTING');
    });
  });

  describe('isJobProfile', () => {
    it.each(ORGANIZATION_JOB_PROFILES)('accepts %s', (profile) => {
      expect(isJobProfile(profile)).toBe(true);
    });

    it.each([
      null,
      undefined,
      '',
      'owner',
      'GUEST',
      'FARMER',
      'toString',
      'constructor',
      '__proto__',
      42,
      {},
    ])('rejects %p', (value) => {
      expect(isJobProfile(value)).toBe(false);
    });
  });

  describe('canAssignJobProfile', () => {
    it('lets the owner assign every profile', () => {
      for (const profile of ORGANIZATION_JOB_PROFILES) {
        expect(canAssignJobProfile(JobProfile.OWNER, profile)).toBe(true);
      }
    });

    it('does not let a director create another owner', () => {
      expect(canAssignJobProfile(JobProfile.DIRECTOR, JobProfile.OWNER)).toBe(false);
    });

    it('does not let a director appoint another director', () => {
      expect(canAssignJobProfile(JobProfile.DIRECTOR, JobProfile.DIRECTOR)).toBe(false);
    });

    it('lets a chief accountant onboard bookkeeping staff only', () => {
      expect(canAssignJobProfile(JobProfile.CHIEF_ACCOUNTANT, JobProfile.ACCOUNTANT)).toBe(true);
      expect(canAssignJobProfile(JobProfile.CHIEF_ACCOUNTANT, JobProfile.EXTERNAL_ACCOUNTANT)).toBe(true);
      expect(canAssignJobProfile(JobProfile.CHIEF_ACCOUNTANT, JobProfile.SIGNER)).toBe(false);
      expect(canAssignJobProfile(JobProfile.CHIEF_ACCOUNTANT, JobProfile.DIRECTOR)).toBe(false);
    });

    it('denies every assignment from non-administrative profiles', () => {
      const nonAdmin = [
        JobProfile.ACCOUNTANT,
        JobProfile.EXTERNAL_ACCOUNTANT,
        JobProfile.SALES_MANAGER,
        JobProfile.PROCUREMENT_MANAGER,
        JobProfile.LOGISTICS_MANAGER,
        JobProfile.DOCUMENT_SPECIALIST,
        JobProfile.SIGNER,
        JobProfile.VIEWER,
      ];
      for (const assigner of nonAdmin) {
        for (const requested of ORGANIZATION_JOB_PROFILES) {
          expect(canAssignJobProfile(assigner, requested)).toBe(false);
        }
      }
    });

    it('denies assignment when the assigner has no profile', () => {
      expect(canAssignJobProfile(null, JobProfile.VIEWER)).toBe(false);
      expect(canAssignJobProfile(undefined, JobProfile.VIEWER)).toBe(false);
    });

    it('denies a forged requested profile even from the owner', () => {
      expect(canAssignJobProfile(JobProfile.OWNER, 'SUPERUSER' as JobProfile)).toBe(false);
      expect(canAssignJobProfile(JobProfile.OWNER, '__proto__' as JobProfile)).toBe(false);
    });

    it('cannot be widened through prototype pollution of the ceiling', () => {
      expect(canAssignJobProfile('toString' as JobProfile, JobProfile.OWNER)).toBe(false);
    });
  });

  describe('singular profiles', () => {
    it('treats owner and director as singular', () => {
      expect(isSingularJobProfile(JobProfile.OWNER)).toBe(true);
      expect(isSingularJobProfile(JobProfile.DIRECTOR)).toBe(true);
    });

    it('allows several bookkeepers', () => {
      expect(isSingularJobProfile(JobProfile.ACCOUNTANT)).toBe(false);
      expect(isSingularJobProfile(JobProfile.EXTERNAL_ACCOUNTANT)).toBe(false);
    });
  });
});
