import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role, type RequestUser } from '../../common/types/request-user';
import { hashAuthMaterial, makeOpaqueToken, stableJson } from './auth-crypto';
import { OrganizationInvitationService } from './organization-invitation.service';

const ACTOR: RequestUser = {
  id: 'admin-user',
  email: 'admin@example.test',
  role: Role.BUYER,
  orgId: 'org-a',
  tenantId: 'tenant-a',
  membershipId: 'membership-admin',
  isOrgAdmin: true,
  mfaVerified: true,
  mfaVerifiedAt: new Date().toISOString(),
};

const ADMIN = {
  id: 'membership-admin',
  role: Role.BUYER,
  version: 1n,
  organizationId: 'org-a',
  organization: { tenantId: 'tenant-a', status: 'VERIFIED', name: 'Organization A' },
};

function sqlText(query: unknown) {
  const candidate = query as { strings?: readonly string[] };
  return candidate.strings?.join('?') || String(query);
}

function invitationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'iv-row',
    organization_id: 'org-a',
    tenant_id: 'tenant-a',
    organization_name: 'Organization A',
    organization_status: 'VERIFIED',
    invited_email: 'employee@example.test',
    invited_email_hash: 'email-hash',
    role: Role.BUYER,
    status: 'PENDING',
    token_hash: 'token-hash',
    request_hash: 'request-hash',
    correlation_id: 'corr-1',
    expires_at: new Date(Date.now() + 60_000),
    version: 0n,
    ...overrides,
  };
}

function serviceWith(queryHandler: (sql: string) => unknown = () => []) {
  const tx = {
    $queryRaw: jest.fn(async (query: unknown) => queryHandler(sqlText(query))),
    $executeRaw: jest.fn(async () => 1),
    userOrg: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  };
  const prisma = {
    userOrg: { findFirst: jest.fn().mockResolvedValue(ADMIN) },
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const repository = {
    ensureCredentialState: jest.fn(),
    latestAuditHash: jest.fn().mockResolvedValue(null),
    insertAudit: jest.fn(),
    revokeAllUserSessions: jest.fn(),
  };
  return {
    service: new OrganizationInvitationService(prisma as never, repository as never),
    prisma,
    tx,
    repository,
  };
}

describe('organization invitation authority', () => {
  const originalDeliveryKey = process.env.ORGANIZATION_INVITATION_DELIVERY_KEY;

  beforeEach(() => {
    process.env.ORGANIZATION_INVITATION_DELIVERY_KEY = 'organization-invitation-delivery-key-for-tests';
  });

  afterAll(() => {
    if (originalDeliveryKey === undefined) delete process.env.ORGANIZATION_INVITATION_DELIVERY_KEY;
    else process.env.ORGANIZATION_INVITATION_DELIVERY_KEY = originalDeliveryKey;
  });

  it('never returns a new raw token for an idempotent resend replay', async () => {
    const row = invitationRow();
    const { service } = serviceWith((sql) => {
      if (sql.includes('organization_invitation_events')) return [{ invitation_id: row.id }];
      if (sql.includes('FROM auth.organization_invitations invitation')) return [row];
      return [];
    });

    const result = await service.resend(
      ACTOR,
      row.id,
      'Requested by organization administrator',
      'idempotency-resend-0001',
      'corr-resend',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    );

    expect(result).toMatchObject({ invitationId: row.id, replayed: true });
    expect(result.emailDelivery).toBeUndefined();
  });

  it('rejects a role outside the administrator permission ceiling before any write', async () => {
    const { service, prisma } = serviceWith();
    await expect(service.create(
      ACTOR,
      'employee@example.test',
      Role.FARMER,
      'idempotency-create-0001',
      'corr-create',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create an invitation when the email already has any membership in the organization', async () => {
    const { service, tx } = serviceWith();
    tx.userOrg.findFirst.mockResolvedValueOnce({ id: 'membership-revoked' } as never);

    await expect(service.create(
      ACTOR,
      'employee@example.test',
      Role.BUYER,
      'idempotency-create-0002',
      'corr-create-duplicate',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    )).rejects.toBeInstanceOf(ConflictException);

    expect(tx.userOrg.create).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('marks an expired pending invitation and never creates membership', async () => {
    const token = makeOpaqueToken('iv');
    const row = invitationRow({
      id: token.id,
      token_hash: token.hash,
      expires_at: new Date(Date.now() - 1_000),
    });
    const { service, tx } = serviceWith((sql) => (
      sql.includes('FROM auth.organization_invitations invitation') ? [row] : []
    ));

    await expect(service.accept({
      token: token.token,
      password: 'Correct-Horse-9!',
      fullName: 'Employee User',
      termsVersion: '2026-07-31',
      privacyVersion: '2026-07-31',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-expired')).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.userOrg.create).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('rejects a consumed invitation without performing a write', async () => {
    const token = makeOpaqueToken('iv');
    const row = invitationRow({ id: token.id, token_hash: token.hash, status: 'ACCEPTED' });
    const { service, tx } = serviceWith((sql) => (
      sql.includes('FROM auth.organization_invitations invitation') ? [row] : []
    ));

    await expect(service.accept({
      token: token.token,
      password: 'Correct-Horse-9!',
      fullName: 'Employee User',
      termsVersion: '2026-07-31',
      privacyVersion: '2026-07-31',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-reuse')).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.userOrg.create).not.toHaveBeenCalled();
  });

  it('rejects a client-invented consent version before touching the invitation', async () => {
    const token = makeOpaqueToken('iv');
    const { service, prisma } = serviceWith();

    await expect(service.accept({
      token: token.token,
      password: 'Correct-Horse-9!',
      fullName: 'Employee User',
      termsVersion: 'future-client-version',
      privacyVersion: '2026-07-31',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-consent')).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a strong password only when the invitation creates a new identity', async () => {
    const token = makeOpaqueToken('iv');
    const row = invitationRow({ id: token.id, token_hash: token.hash });
    const { service, tx } = serviceWith((sql) => (
      sql.includes('FROM auth.organization_invitations invitation') ? [row] : []
    ));

    await expect(service.accept({
      token: token.token,
      password: 'legacy1!',
      fullName: 'Employee User',
      termsVersion: '2026-07-31',
      privacyVersion: '2026-07-31',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-new-weak')).rejects.toMatchObject({ response: { code: 'PASSWORD_POLICY_FAILED' } });

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.userOrg.create).not.toHaveBeenCalled();
  });

  it('allows an existing identity to prove its current legacy password without resetting it', async () => {
    const password = 'legacy1!';
    const token = makeOpaqueToken('iv');
    const row = invitationRow({ id: token.id, token_hash: token.hash });
    const { service, tx, repository } = serviceWith((sql) => (
      sql.includes('FROM auth.organization_invitations invitation') ? [row] : []
    ));
    tx.user.findUnique.mockResolvedValueOnce({
      id: 'existing-user',
      passwordHash: await bcrypt.hash(password, 4),
      status: 'ACTIVE',
      deletedAt: null,
    } as never);

    await expect(service.accept({
      token: token.token,
      password,
      fullName: 'Existing Employee',
      termsVersion: '2026-07-31',
      privacyVersion: '2026-07-31',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-existing-legacy')).resolves.toMatchObject({ ok: true, membershipId: expect.any(String) });

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.userOrg.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'existing-user', organizationId: 'org-a' }),
    }));
    expect(repository.ensureCredentialState).toHaveBeenCalledWith(
      expect.anything(), 'existing-user', '2026-07-31|2026-07-31', expect.any(Date),
    );
  });

  it('does not let an organization administrator initiate global MFA recovery for a cross-organization or staff identity', async () => {
    const { service, tx } = serviceWith((sql) => {
      if (sql.includes('organization_membership_command_events')) return [];
      if (sql.includes('has_other_membership') && sql.includes('FOR UPDATE OF membership, subject')) {
        return [{
          user_id: 'shared-user',
          email: 'shared@example.test',
          has_other_membership: true,
          has_staff_assignment: true,
          mfa_enabled: true,
          has_mfa_secret: true,
        }];
      }
      return [];
    });

    await expect(service.resetMembershipMfa(
      ACTOR,
      'membership-shared',
      2n,
      'Controlled recovery requested by organization administrator',
      'idempotency-mfa-recovery-0001',
      'corr-mfa-shared',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('returns a recovery token only to the delivery boundary and never on an idempotent replay', async () => {
    const reason = 'Controlled recovery requested by organization administrator';
    const fresh = serviceWith((sql) => {
      if (sql.includes('organization_membership_command_events')) return [];
      if (sql.includes('has_other_membership') && sql.includes('FOR UPDATE OF membership, subject')) {
        return [{
          user_id: 'employee-user',
          email: 'employee@example.test',
          has_other_membership: false,
          has_staff_assignment: false,
          mfa_enabled: true,
          has_mfa_secret: true,
        }];
      }
      return [];
    });
    const created = await fresh.service.resetMembershipMfa(
      ACTOR,
      'membership-employee',
      3n,
      reason,
      'idempotency-mfa-recovery-0002',
      'corr-mfa-create',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    );
    expect(created.recoveryDelivery?.token).toMatch(/^mr_[^.]+\.[A-Za-z0-9_-]+$/);

    const withoutBoundary = serviceWith((sql) => {
      if (sql.includes('organization_membership_command_events')) return [];
      if (sql.includes('has_other_membership') && sql.includes('FOR UPDATE OF membership, subject')) {
        return [{
          user_id: 'employee-user-2',
          email: 'employee2@example.test',
          has_other_membership: false,
          has_staff_assignment: false,
          mfa_enabled: true,
          has_mfa_secret: true,
        }];
      }
      return [];
    });
    const hidden = await withoutBoundary.service.resetMembershipMfa(
      ACTOR,
      'membership-employee-2',
      1n,
      reason,
      'idempotency-mfa-recovery-0003',
      'corr-mfa-hidden',
      'wrong-delivery-boundary-key-that-is-long-enough',
    );
    expect(hidden.recoveryDelivery).toBeUndefined();

    const replayMembershipId = 'membership-replay';
    const replayVersion = 5n;
    const replayRequestHash = hashAuthMaterial(stableJson({
      membershipId: replayMembershipId,
      command: 'MFA_RESET',
      version: replayVersion.toString(),
      reason,
    }));
    const recovery = {
      id: 'mr_existing',
      user_id: 'employee-replay',
      membership_id: replayMembershipId,
      organization_id: 'org-a',
      tenant_id: 'tenant-a',
      token_hash: 'stored-hash',
      status: 'PENDING',
      expires_at: new Date(Date.now() + 60_000),
      attempts: 0,
      max_attempts: 5,
      version: 0n,
      email: 'replay@example.test',
    };
    const replayService = serviceWith((sql) => {
      if (sql.includes('organization_membership_command_events')) {
        return [{ membership_id: replayMembershipId, command: 'MFA_RESET', request_hash: replayRequestHash }];
      }
      if (sql.includes('FROM auth.mfa_recovery_challenges')) return [recovery];
      return [];
    });
    const replay = await replayService.service.resetMembershipMfa(
      ACTOR,
      replayMembershipId,
      replayVersion,
      reason,
      'idempotency-mfa-recovery-0004',
      'corr-mfa-replay',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    );
    expect(replay).toMatchObject({ replayed: true, membershipId: replayMembershipId });
    expect(replay.recoveryDelivery).toBeUndefined();
  });

  it('requires the subject current password before consuming MFA recovery and revoking sessions', async () => {
    const token = makeOpaqueToken('mr');
    const passwordHash = await bcrypt.hash('Current-Password-9!', 4);
    const row = {
      id: token.id,
      user_id: 'employee-user',
      membership_id: 'membership-employee',
      organization_id: 'org-a',
      tenant_id: 'tenant-a',
      token_hash: token.hash,
      status: 'PENDING',
      expires_at: new Date(Date.now() + 60_000),
      attempts: 0,
      max_attempts: 5,
      version: 0n,
      email: 'employee@example.test',
      password_hash: passwordHash,
      user_status: 'ACTIVE',
      user_deleted_at: null,
      membership_status: 'ACTIVE',
      organization_status: 'VERIFIED',
      has_other_membership: false,
      has_staff_assignment: false,
    };
    const invalid = serviceWith((sql) => (
      sql.includes('FROM auth.mfa_recovery_challenges challenge') ? [row] : []
    ));
    await expect(invalid.service.confirmMfaRecovery(
      { token: token.token, password: 'Wrong-Password-9!' },
      'corr-mfa-invalid-password',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    )).rejects.toBeInstanceOf(BadRequestException);
    const invalidSql = invalid.tx.$executeRaw.mock.calls
      .map((call) => sqlText((call as unknown[])[0]))
      .join('\n');
    expect(invalidSql).toContain('SET attempts = attempts + 1');
    expect(invalidSql).not.toContain('mfa_secret_ciphertext = NULL');
    expect(invalid.repository.revokeAllUserSessions).not.toHaveBeenCalled();

    const success = serviceWith((sql) => (
      sql.includes('FROM auth.mfa_recovery_challenges challenge') ? [row] : []
    ));
    const result = await success.service.confirmMfaRecovery(
      { token: token.token, password: 'Current-Password-9!' },
      'corr-mfa-success',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    );
    expect(result).toMatchObject({
      ok: true,
      sessionsRevoked: true,
      mfaReenrollmentRequired: true,
      nextAction: 'LOGIN',
    });
    expect(success.repository.revokeAllUserSessions).toHaveBeenCalledWith(
      success.tx,
      row.user_id,
      'CONTROLLED_MFA_RECOVERY',
    );
    const executedSql = success.tx.$executeRaw.mock.calls
      .map((call) => sqlText((call as unknown[])[0]))
      .join('\n');
    expect(executedSql).toContain('mfa_secret_ciphertext = NULL');
    expect(executedSql).toContain("SET status = 'CONSUMED'");
  });

  it('revokes the recovery challenge when the subject password attempt budget is exhausted', async () => {
    const token = makeOpaqueToken('mr');
    const row = {
      id: token.id,
      user_id: 'attempt-user',
      membership_id: 'attempt-membership',
      organization_id: 'org-a',
      tenant_id: 'tenant-a',
      token_hash: token.hash,
      status: 'PENDING',
      expires_at: new Date(Date.now() + 60_000),
      attempts: 4,
      max_attempts: 5,
      version: 4n,
      email: 'attempt@example.test',
      password_hash: await bcrypt.hash('Correct-Password-9!', 4),
      user_status: 'ACTIVE',
      user_deleted_at: null,
      membership_status: 'ACTIVE',
      organization_status: 'VERIFIED',
      has_other_membership: false,
      has_staff_assignment: false,
    };
    const terminal = serviceWith((sql) => (
      sql.includes('FROM auth.mfa_recovery_challenges challenge') ? [row] : []
    ));
    await expect(terminal.service.confirmMfaRecovery(
      { token: token.token, password: 'Wrong-Password-9!' },
      'corr-mfa-attempts-exhausted',
      process.env.ORGANIZATION_INVITATION_DELIVERY_KEY,
    )).rejects.toBeInstanceOf(BadRequestException);
    const executedSql = terminal.tx.$executeRaw.mock.calls
      .map((call) => sqlText((call as unknown[])[0]))
      .join('\n');
    expect(executedSql).toContain("status = CASE WHEN");
    expect(executedSql).toContain('INSERT INTO auth.mfa_recovery_events');
    expect(terminal.repository.revokeAllUserSessions).not.toHaveBeenCalled();
  });
});
