import { Capability } from './membership-capability.resolver';
import {
  AuthorityCommandDenyReason as Deny,
  type CommandActor,
  type CommandTarget,
  type DelegationGrant,
  type SecondApproval,
  type SigningAuthorityGrant,
  evaluateCreateDelegation,
  evaluateGrantSigningAuthority,
  evaluateRevokeDelegation,
  evaluateRevokeSigningAuthority,
} from './accounting-authority-command.policy';

const NOW = new Date('2026-08-15T12:00:00.000Z');
const FRESH = new Date(NOW.getTime() - 60_000);

function actor(overrides: Partial<CommandActor> = {}): CommandActor {
  return {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    membershipId: 'm-director',
    userId: 'u-director',
    membershipStatus: 'ACTIVE',
    userStatus: 'ACTIVE',
    capabilities: new Set([
      Capability.SIGNING_AUTHORITY_MANAGE,
      Capability.ORGANIZATION_TEAM_MANAGE,
      Capability.ACCOUNTING_PACKAGE_CLOSE,
      Capability.DOCUMENTS_PREPARE,
    ]),
    mfaVerifiedAt: FRESH,
    ...overrides,
  };
}

function target(overrides: Partial<CommandTarget> = {}): CommandTarget {
  return {
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    membershipId: 'm-signer',
    userId: 'u-signer',
    membershipStatus: 'ACTIVE',
    ...overrides,
  };
}

function secondApproval(overrides: Partial<SecondApproval> = {}): SecondApproval {
  return {
    membershipId: 'm-owner',
    userId: 'u-owner',
    capabilities: new Set([Capability.SIGNING_AUTHORITY_MANAGE]),
    mfaVerifiedAt: FRESH,
    ...overrides,
  };
}

function grant(overrides: Partial<SigningAuthorityGrant> = {}): SigningAuthorityGrant {
  return {
    authorityType: 'ORGANIZATION_HEAD',
    mchdReference: null,
    validFrom: new Date('2026-08-01T00:00:00.000Z'),
    validTo: new Date('2027-08-01T00:00:00.000Z'),
    allowedDocumentTypes: ['UPD'],
    allowedSigningModes: ['PROVIDER_UI'],
    amountLimitKopecks: 100_000_000n,
    ...overrides,
  };
}

function delegation(overrides: Partial<DelegationGrant> = {}): DelegationGrant {
  return {
    capabilities: [Capability.ACCOUNTING_PACKAGE_CLOSE],
    startsAt: new Date('2026-08-14T00:00:00.000Z'),
    endsAt: new Date('2026-08-30T00:00:00.000Z'),
    ...overrides,
  };
}

describe('granting a signing authority', () => {
  it('allows a director with a second approver', () => {
    const d = evaluateGrantSigningAuthority({
      actor: actor(), target: target(), grant: grant(),
      secondApproval: secondApproval(), now: NOW,
    });
    expect(d.reasons).toEqual([]);
    expect(d.allowed).toBe(true);
  });

  describe('self-approval', () => {
    it('refuses granting an authority to yourself', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target({ userId: 'u-director', membershipId: 'm-director' }),
        grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.SELF_APPROVAL_FORBIDDEN);
    });

    it('refuses when the actor wears a second membership but is the same person', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(),
        target: target({ membershipId: 'm-director-alt', userId: 'u-director' }),
        grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.SELF_APPROVAL_FORBIDDEN);
    });
  });

  describe('second approval', () => {
    it('refuses without one', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(), grant: grant(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.SECOND_APPROVAL_REQUIRED);
    });

    it('refuses when the second approver is the granter', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(), grant: grant(),
        secondApproval: secondApproval({ userId: 'u-director' }), now: NOW,
      });
      expect(d.reasons).toContain(Deny.SECOND_APPROVER_SAME_PERSON);
    });

    it('refuses when the second approver is the beneficiary', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(), grant: grant(),
        secondApproval: secondApproval({ userId: 'u-signer' }), now: NOW,
      });
      expect(d.reasons).toContain(Deny.SECOND_APPROVER_SAME_PERSON);
    });

    it('refuses a second approver who cannot manage signing authority', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(), grant: grant(),
        secondApproval: secondApproval({ capabilities: new Set([Capability.DOCUMENTS_READ]) }),
        now: NOW,
      });
      expect(d.reasons).toContain(Deny.SECOND_APPROVAL_REQUIRED);
    });

    it('refuses a second approver without MFA', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(), grant: grant(),
        secondApproval: secondApproval({ mfaVerifiedAt: null }), now: NOW,
      });
      expect(d.reasons).toContain(Deny.SECOND_APPROVAL_REQUIRED);
    });
  });

  describe('actor state', () => {
    it('refuses without the manage capability', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor({ capabilities: new Set([Capability.DOCUMENTS_READ]) }),
        target: target(), grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.CAPABILITY_REQUIRED);
    });

    it('refuses stale MFA', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor({ mfaVerifiedAt: new Date(NOW.getTime() - 3_600_000) }),
        target: target(), grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.MFA_STALE);
    });

    it('refuses a revoked actor membership', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor({ membershipStatus: 'REVOKED' }),
        target: target(), grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.ACTOR_MEMBERSHIP_NOT_ACTIVE);
    });

    it('refuses while a security hold is in place', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor({ securityHold: true }),
        target: target(), grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.SECURITY_HOLD);
    });

    it('refuses a target in another organization', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target({ organizationId: 'org-2' }),
        grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.ORGANIZATION_MISMATCH);
    });

    it('refuses a target in another tenant', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target({ tenantId: 'tenant-2' }),
        grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.TENANT_MISMATCH);
    });

    it('refuses a target whose membership is not active', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target({ membershipStatus: 'PENDING' }),
        grant: grant(), secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.TARGET_MEMBERSHIP_NOT_ACTIVE);
    });
  });

  describe('grant shape', () => {
    it('refuses an inverted window', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(),
        grant: grant({ validTo: new Date('2026-07-01T00:00:00.000Z') }),
        secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.WINDOW_INVALID);
    });

    it('refuses a window that has already closed', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(),
        grant: grant({
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          validTo: new Date('2026-02-01T00:00:00.000Z'),
        }),
        secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.WINDOW_ALREADY_PAST);
    });

    it('refuses an empty document type list', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(), grant: grant({ allowedDocumentTypes: [] }),
        secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.DOCUMENT_TYPES_EMPTY);
    });

    it('refuses an empty signing mode list', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(), grant: grant({ allowedSigningModes: [] }),
        secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.SIGNING_MODES_EMPTY);
    });

    it('refuses a negative ceiling', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(), grant: grant({ amountLimitKopecks: -1n }),
        secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.AMOUNT_LIMIT_NEGATIVE);
    });

    it('refuses a delegated authority with no power of attorney', () => {
      const d = evaluateGrantSigningAuthority({
        actor: actor(), target: target(),
        grant: grant({ authorityType: 'MCHD_DELEGATED', mchdReference: '  ' }),
        secondApproval: secondApproval(), now: NOW,
      });
      expect(d.reasons).toContain(Deny.MCHD_REFERENCE_REQUIRED);
    });
  });
});

describe('revoking a signing authority', () => {
  it('lets the holder retire its own authority with fresh MFA alone', () => {
    const d = evaluateRevokeSigningAuthority({
      actor: actor({
        membershipId: 'm-signer',
        capabilities: new Set([Capability.DOCUMENTS_READ]),
      }),
      authorityHolderMembershipId: 'm-signer',
      authorityOrganizationId: 'org-1',
      authorityTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.reasons).toEqual([]);
    expect(d.allowed).toBe(true);
  });

  it('lets a manager revoke somebody else', () => {
    const d = evaluateRevokeSigningAuthority({
      actor: actor(),
      authorityHolderMembershipId: 'm-signer',
      authorityOrganizationId: 'org-1',
      authorityTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.allowed).toBe(true);
  });

  it('refuses a bystander with neither role', () => {
    const d = evaluateRevokeSigningAuthority({
      actor: actor({
        membershipId: 'm-other',
        capabilities: new Set([Capability.DOCUMENTS_READ]),
      }),
      authorityHolderMembershipId: 'm-signer',
      authorityOrganizationId: 'org-1',
      authorityTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.NOT_PERMITTED_TO_REVOKE);
  });

  it('refuses across an organization boundary', () => {
    const d = evaluateRevokeSigningAuthority({
      actor: actor(),
      authorityHolderMembershipId: 'm-signer',
      authorityOrganizationId: 'org-2',
      authorityTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.ORGANIZATION_MISMATCH);
  });

  it('still demands fresh MFA', () => {
    const d = evaluateRevokeSigningAuthority({
      actor: actor({ membershipId: 'm-signer', mfaVerifiedAt: null }),
      authorityHolderMembershipId: 'm-signer',
      authorityOrganizationId: 'org-1',
      authorityTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.MFA_REQUIRED);
  });

  it('needs no second approval, unlike granting', () => {
    const d = evaluateRevokeSigningAuthority({
      actor: actor(),
      authorityHolderMembershipId: 'm-signer',
      authorityOrganizationId: 'org-1',
      authorityTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.reasons).not.toContain(Deny.SECOND_APPROVAL_REQUIRED);
  });
});

describe('creating a delegation', () => {
  it('allows delegating a capability the delegator holds', () => {
    const d = evaluateCreateDelegation({
      actor: actor(), target: target(), delegation: delegation(), now: NOW,
    });
    expect(d.reasons).toEqual([]);
    expect(d.allowed).toBe(true);
  });

  it('refuses delegating a capability the delegator does not hold', () => {
    const d = evaluateCreateDelegation({
      actor: actor({ capabilities: new Set([Capability.DOCUMENTS_READ]) }),
      target: target(),
      delegation: delegation({ capabilities: [Capability.ACCOUNTING_PACKAGE_CLOSE] }),
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.DELEGATION_EXCEEDS_DELEGATOR);
  });

  it('refuses delegating the signing capability, whatever the delegator holds', () => {
    const d = evaluateCreateDelegation({
      actor: actor({
        capabilities: new Set([
          Capability.SIGNING_AUTHORITY_MANAGE,
          Capability.DOCUMENTS_SIGN,
        ]),
      }),
      target: target(),
      delegation: delegation({ capabilities: [Capability.DOCUMENTS_SIGN] }),
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.DELEGATION_CAPABILITY_FORBIDDEN);
  });

  it('refuses an unknown capability string', () => {
    const d = evaluateCreateDelegation({
      actor: actor(), target: target(),
      delegation: delegation({ capabilities: ['*'] }),
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.DELEGATION_CAPABILITY_UNKNOWN);
  });

  it('refuses an empty delegation', () => {
    const d = evaluateCreateDelegation({
      actor: actor(), target: target(),
      delegation: delegation({ capabilities: [] }), now: NOW,
    });
    expect(d.reasons).toContain(Deny.DELEGATION_EMPTY);
  });

  it('refuses delegating to yourself', () => {
    const d = evaluateCreateDelegation({
      actor: actor(), target: target({ membershipId: 'm-director' }),
      delegation: delegation(), now: NOW,
    });
    expect(d.reasons).toContain(Deny.SELF_APPROVAL_FORBIDDEN);
  });

  it('refuses a window that has already closed', () => {
    const d = evaluateCreateDelegation({
      actor: actor(), target: target(),
      delegation: delegation({
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.WINDOW_ALREADY_PAST);
  });

  it('refuses across an organization boundary', () => {
    const d = evaluateCreateDelegation({
      actor: actor(), target: target({ organizationId: 'org-2' }),
      delegation: delegation(), now: NOW,
    });
    expect(d.reasons).toContain(Deny.ORGANIZATION_MISMATCH);
  });

  it('cannot be used to escalate through a chain', () => {
    // The delegate holds only what was delegated, and tries to pass on more.
    const delegate = actor({
      membershipId: 'm-signer',
      userId: 'u-signer',
      capabilities: new Set([Capability.ACCOUNTING_PACKAGE_CLOSE]),
    });
    const d = evaluateCreateDelegation({
      actor: delegate,
      target: target({ membershipId: 'm-third', userId: 'u-third' }),
      delegation: delegation({
        capabilities: [
          Capability.ACCOUNTING_PACKAGE_CLOSE,
          Capability.SIGNING_AUTHORITY_MANAGE,
        ],
      }),
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.DELEGATION_EXCEEDS_DELEGATOR);
  });
});

describe('revoking a delegation', () => {
  it('lets the granter end it', () => {
    const d = evaluateRevokeDelegation({
      actor: actor(),
      delegationFromMembershipId: 'm-director',
      delegationToMembershipId: 'm-signer',
      delegationOrganizationId: 'org-1',
      delegationTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.allowed).toBe(true);
  });

  it('lets the recipient hand it back', () => {
    const d = evaluateRevokeDelegation({
      actor: actor({
        membershipId: 'm-signer',
        capabilities: new Set([Capability.DOCUMENTS_READ]),
      }),
      delegationFromMembershipId: 'm-director',
      delegationToMembershipId: 'm-signer',
      delegationOrganizationId: 'org-1',
      delegationTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.reasons).toEqual([]);
    expect(d.allowed).toBe(true);
  });

  it('refuses an unrelated member without team management', () => {
    const d = evaluateRevokeDelegation({
      actor: actor({
        membershipId: 'm-other',
        capabilities: new Set([Capability.DOCUMENTS_READ]),
      }),
      delegationFromMembershipId: 'm-director',
      delegationToMembershipId: 'm-signer',
      delegationOrganizationId: 'org-1',
      delegationTenantId: 'tenant-1',
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.NOT_PERMITTED_TO_REVOKE);
  });

  it('refuses across a tenant boundary', () => {
    const d = evaluateRevokeDelegation({
      actor: actor(),
      delegationFromMembershipId: 'm-director',
      delegationToMembershipId: 'm-signer',
      delegationOrganizationId: 'org-1',
      delegationTenantId: 'tenant-2',
      now: NOW,
    });
    expect(d.reasons).toContain(Deny.TENANT_MISMATCH);
  });
});
