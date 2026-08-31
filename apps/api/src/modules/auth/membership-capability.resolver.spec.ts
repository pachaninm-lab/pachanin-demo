import { Role } from '../../common/types/request-user';
import { JobProfile, ORGANIZATION_JOB_PROFILES } from './organization-job-profile';
import {
  ALL_CAPABILITIES,
  Capability,
  type MembershipCapabilityInput,
  type MembershipDelegation,
  hasCapability,
  isCapability,
  resolveMembershipCapabilities,
} from './membership-capability.resolver';

const NOW = new Date('2026-08-15T12:00:00.000Z');

function membership(
  overrides: Partial<MembershipCapabilityInput> = {},
): MembershipCapabilityInput {
  return {
    role: Role.GUEST,
    jobProfile: JobProfile.ACCOUNTANT,
    membershipStatus: 'ACTIVE',
    userStatus: 'ACTIVE',
    now: NOW,
    ...overrides,
  };
}

function delegation(
  overrides: Partial<MembershipDelegation> = {},
): MembershipDelegation {
  return {
    capabilities: [Capability.ACCOUNTING_PACKAGE_CLOSE],
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: new Date('2026-09-01T00:00:00.000Z'),
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('membership capability resolver', () => {
  describe('vocabulary', () => {
    it('exposes the forty-two contract capabilities', () => {
      expect(ALL_CAPABILITIES).toHaveLength(42);
      expect(new Set(ALL_CAPABILITIES).size).toBe(42);
    });

    it('rejects unknown capability strings', () => {
      expect(isCapability('documents.sign')).toBe(true);
      expect(isCapability('documents.destroy')).toBe(false);
      expect(isCapability('*')).toBe(false);
      expect(isCapability('')).toBe(false);
      expect(isCapability(null)).toBe(false);
    });
  });

  describe('deny by default', () => {
    it('grants nothing to a revoked membership', () => {
      const result = resolveMembershipCapabilities(
        membership({ membershipStatus: 'REVOKED', jobProfile: JobProfile.OWNER }),
      );
      expect(result.size).toBe(0);
    });

    it('grants nothing to a pending membership', () => {
      const result = resolveMembershipCapabilities(
        membership({ membershipStatus: 'PENDING', jobProfile: JobProfile.OWNER }),
      );
      expect(result.size).toBe(0);
    });

    it('grants nothing when the user account is not active', () => {
      const result = resolveMembershipCapabilities(
        membership({ userStatus: 'BLOCKED', jobProfile: JobProfile.OWNER }),
      );
      expect(result.size).toBe(0);
    });

    it('grants only the baseline when no job profile is set', () => {
      const result = resolveMembershipCapabilities(membership({ jobProfile: null }));
      expect([...result].sort()).toEqual([
        Capability.ORGANIZATION_READ,
        Capability.SECURITY_SESSION_READ_OWN,
        Capability.SECURITY_SESSION_REVOKE_OWN,
      ].sort());
    });

    it('grants only the baseline for a forged job profile', () => {
      const result = resolveMembershipCapabilities(
        membership({ jobProfile: 'SUPERUSER' }),
      );
      expect(result.has(Capability.DOCUMENTS_PREPARE)).toBe(false);
      expect(result.size).toBe(3);
    });

    it('ignores a prototype-borrowed profile name', () => {
      const result = resolveMembershipCapabilities(
        membership({ jobProfile: 'constructor' }),
      );
      expect(result.size).toBe(3);
    });
  });

  describe('signing is never minted by a profile', () => {
    it.each(ORGANIZATION_JOB_PROFILES)(
      'denies documents.sign to %s',
      (profile) => {
        const result = resolveMembershipCapabilities(
          membership({ jobProfile: profile }),
        );
        expect(result.has(Capability.DOCUMENTS_SIGN)).toBe(false);
      },
    );

    it('denies documents.sign even to the owner', () => {
      expect(
        hasCapability(
          membership({ jobProfile: JobProfile.OWNER }),
          Capability.DOCUMENTS_SIGN,
        ),
      ).toBe(false);
    });

    it('denies documents.sign to the signer profile itself', () => {
      const result = resolveMembershipCapabilities(
        membership({ jobProfile: JobProfile.SIGNER }),
      );
      expect(result.has(Capability.SIGNING_AUTHORITY_READ)).toBe(true);
      expect(result.has(Capability.DOCUMENTS_SIGN)).toBe(false);
    });

    it('cannot be granted through a delegation', () => {
      const result = resolveMembershipCapabilities(
        membership({
          jobProfile: JobProfile.SIGNER,
          delegations: [delegation({ capabilities: [Capability.DOCUMENTS_SIGN] })],
        }),
      );
      expect(result.has(Capability.DOCUMENTS_SIGN)).toBe(false);
    });
  });

  describe('role axis is never a widening input', () => {
    it('gives the bank role no accounting capabilities without a profile', () => {
      const result = resolveMembershipCapabilities(
        membership({ role: Role.ACCOUNTING, jobProfile: null }),
      );
      expect(result.has(Capability.ACCOUNTING_DASHBOARD_READ)).toBe(false);
      expect(result.has(Capability.PAYMENTS_RECONCILE)).toBe(false);
      expect(result.size).toBe(3);
    });

    it('denies the whole contour to the server-derived bank callback actor', () => {
      const result = resolveMembershipCapabilities(
        membership({ role: Role.BANK_CALLBACK, jobProfile: JobProfile.OWNER }),
      );
      expect(result.size).toBe(0);
    });

    it('resolves identically for every market role given the same profile', () => {
      const roles = [
        Role.FARMER,
        Role.BUYER,
        Role.LOGISTICIAN,
        Role.DRIVER,
        Role.ELEVATOR,
        Role.LAB,
        Role.SURVEYOR,
        Role.ACCOUNTING,
        Role.GUEST,
      ];
      const baseline = [
        ...resolveMembershipCapabilities(
          membership({ role: Role.GUEST, jobProfile: JobProfile.ACCOUNTANT }),
        ),
      ].sort();

      for (const role of roles) {
        const result = [
          ...resolveMembershipCapabilities(
            membership({ role, jobProfile: JobProfile.ACCOUNTANT }),
          ),
        ].sort();
        expect(result).toEqual(baseline);
      }
    });

    it('supports the contract compatibility pairing of GUEST with ACCOUNTANT', () => {
      expect(
        hasCapability(
          membership({ role: Role.GUEST, jobProfile: JobProfile.ACCOUNTANT }),
          Capability.DOCUMENTS_PREPARE,
        ),
      ).toBe(true);
    });
  });

  describe('least privilege between bookkeeping profiles', () => {
    it('lets a chief accountant close a period but not a plain accountant', () => {
      expect(
        hasCapability(
          membership({ jobProfile: JobProfile.CHIEF_ACCOUNTANT }),
          Capability.ACCOUNTING_PACKAGE_CLOSE,
        ),
      ).toBe(true);
      expect(
        hasCapability(
          membership({ jobProfile: JobProfile.ACCOUNTANT }),
          Capability.ACCOUNTING_PACKAGE_CLOSE,
        ),
      ).toBe(false);
    });

    it('withholds period close, reconciliation and provider config from an external accountant', () => {
      const external = resolveMembershipCapabilities(
        membership({ jobProfile: JobProfile.EXTERNAL_ACCOUNTANT }),
      );
      expect(external.has(Capability.ACCOUNTING_PACKAGE_CLOSE)).toBe(false);
      expect(external.has(Capability.PAYMENTS_RECONCILE)).toBe(false);
      expect(external.has(Capability.INTEGRATIONS_CONFIGURE)).toBe(false);
      expect(external.has(Capability.ONE_C_CONFIGURE)).toBe(false);
      expect(external.has(Capability.EDO_CONFIGURE)).toBe(false);
      expect(external.has(Capability.ORGANIZATION_TEAM_MANAGE)).toBe(false);
    });

    it('still lets an external accountant do daily bookkeeping', () => {
      const external = resolveMembershipCapabilities(
        membership({ jobProfile: JobProfile.EXTERNAL_ACCOUNTANT }),
      );
      expect(external.has(Capability.DOCUMENTS_PREPARE)).toBe(true);
      expect(external.has(Capability.EDO_SEND)).toBe(true);
      expect(external.has(Capability.ONE_C_SYNC)).toBe(true);
      expect(external.has(Capability.PAYMENTS_MATCH)).toBe(true);
    });

    it('keeps a viewer read-only', () => {
      const viewer = resolveMembershipCapabilities(
        membership({ jobProfile: JobProfile.VIEWER }),
      );
      const mutating = [
        Capability.DOCUMENTS_PREPARE,
        Capability.DOCUMENTS_SEND,
        Capability.DOCUMENTS_CORRECT,
        Capability.EDO_SEND,
        Capability.ONE_C_SYNC,
        Capability.PAYMENTS_MATCH,
        Capability.ACCOUNTING_TASK_MANAGE,
        Capability.ORGANIZATION_TEAM_MANAGE,
      ];
      for (const capability of mutating) {
        expect(viewer.has(capability)).toBe(false);
      }
      expect(viewer.has(Capability.DOCUMENTS_READ)).toBe(true);
    });

    it('does not let sales or logistics staff into the document pipeline', () => {
      for (const profile of [JobProfile.SALES_MANAGER, JobProfile.LOGISTICS_MANAGER]) {
        const result = resolveMembershipCapabilities(membership({ jobProfile: profile }));
        expect(result.has(Capability.DOCUMENTS_PREPARE)).toBe(false);
        expect(result.has(Capability.EDO_SEND)).toBe(false);
        expect(result.has(Capability.ONE_C_SYNC)).toBe(false);
      }
    });

    it('reserves signing authority management for owner and director', () => {
      const allowed = ORGANIZATION_JOB_PROFILES.filter((profile) =>
        resolveMembershipCapabilities(membership({ jobProfile: profile })).has(
          Capability.SIGNING_AUTHORITY_MANAGE,
        ),
      );
      expect(allowed.sort()).toEqual([JobProfile.DIRECTOR, JobProfile.OWNER].sort());
    });

    it('reserves team management for owner and director', () => {
      const allowed = ORGANIZATION_JOB_PROFILES.filter((profile) =>
        resolveMembershipCapabilities(membership({ jobProfile: profile })).has(
          Capability.ORGANIZATION_TEAM_MANAGE,
        ),
      );
      expect(allowed.sort()).toEqual([JobProfile.DIRECTOR, JobProfile.OWNER].sort());
    });
  });

  describe('delegation', () => {
    it('adds a delegated capability inside its window', () => {
      const result = resolveMembershipCapabilities(
        membership({ delegations: [delegation()] }),
      );
      expect(result.has(Capability.ACCOUNTING_PACKAGE_CLOSE)).toBe(true);
    });

    it('ignores a delegation that has not started', () => {
      const result = resolveMembershipCapabilities(
        membership({
          delegations: [
            delegation({ startsAt: new Date('2026-09-01T00:00:00.000Z') }),
          ],
        }),
      );
      expect(result.has(Capability.ACCOUNTING_PACKAGE_CLOSE)).toBe(false);
    });

    it('ignores an expired delegation', () => {
      const result = resolveMembershipCapabilities(
        membership({
          delegations: [delegation({ endsAt: new Date('2026-08-01T00:00:00.000Z') })],
        }),
      );
      expect(result.has(Capability.ACCOUNTING_PACKAGE_CLOSE)).toBe(false);
    });

    it('treats the end of the window as exclusive', () => {
      const result = resolveMembershipCapabilities(
        membership({ delegations: [delegation({ endsAt: NOW })] }),
      );
      expect(result.has(Capability.ACCOUNTING_PACKAGE_CLOSE)).toBe(false);
    });

    it('ignores a revoked delegation', () => {
      const result = resolveMembershipCapabilities(
        membership({ delegations: [delegation({ status: 'REVOKED' })] }),
      );
      expect(result.has(Capability.ACCOUNTING_PACKAGE_CLOSE)).toBe(false);
    });

    it('drops unknown capability strings inside a delegation', () => {
      const result = resolveMembershipCapabilities(
        membership({
          delegations: [delegation({ capabilities: ['*', 'admin', 'documents.destroy'] })],
        }),
      );
      expect(result.has('*' as Capability)).toBe(false);
      expect(result.has('admin' as Capability)).toBe(false);
    });

    it('is not applied to a membership that has no job profile', () => {
      const result = resolveMembershipCapabilities(
        membership({
          jobProfile: null,
          delegations: [delegation({ capabilities: [Capability.DOCUMENTS_PREPARE] })],
        }),
      );
      expect(result.has(Capability.DOCUMENTS_PREPARE)).toBe(false);
      expect(result.size).toBe(3);
    });

    it('is not applied when the job profile is unrecognised', () => {
      const result = resolveMembershipCapabilities(
        membership({
          jobProfile: 'SUPERUSER',
          delegations: [delegation({ capabilities: [Capability.DOCUMENTS_PREPARE] })],
        }),
      );
      expect(result.has(Capability.DOCUMENTS_PREPARE)).toBe(false);
      expect(result.size).toBe(3);
    });

    it('cannot revive a revoked membership', () => {
      const result = resolveMembershipCapabilities(
        membership({
          membershipStatus: 'REVOKED',
          delegations: [delegation()],
        }),
      );
      expect(result.size).toBe(0);
    });
  });

  describe('owner breadth', () => {
    it('receives every capability except the ones signing authority gates', () => {
      const owner = resolveMembershipCapabilities(
        membership({ jobProfile: JobProfile.OWNER }),
      );
      expect(owner.size).toBe(ALL_CAPABILITIES.length - 1);
      expect(owner.has(Capability.DOCUMENTS_SIGN)).toBe(false);
    });
  });
});
