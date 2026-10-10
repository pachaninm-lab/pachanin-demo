import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  hashAuthMaterial,
  stableJson,
} from './auth-crypto';
import { OrganizationInvitationService } from './organization-invitation.service';
import { makeOpaqueToken } from './opaque-token-authority';

const ACTOR: RequestUser = {
  id: 'admin-user',
  email: 'admin@example.test',
  role: Role.BUYER,
  orgId: 'org-a',
  tenantId: 'tenant-a',
  membershipId: 'membership-admin',
  sessionId: 'session-admin',
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

function acceptanceCredential(row: ReturnType<typeof invitationRow>, overrides: Record<string, unknown> = {}) {
  return {
    invitation_id: row.id,
    organization_id: row.organization_id,
    tenant_id: row.tenant_id,
    organization_name: row.organization_name,
    organization_status: row.organization_status,
    invited_email: row.invited_email,
    role: row.role,
    invitation_status: row.status,
    expires_at: row.expires_at,
    invitation_version: row.version,
    existing_user_id: null,
    existing_password_hash: null,
    existing_user_status: null,
    existing_user_deleted_at: null,
    ...overrides,
  };
}

function acceptedInvitation(row: ReturnType<typeof invitationRow>, userId: string) {
  return {
    accepted: true,
    user_id: userId,
    membership_id: 'membership-accepted',
    organization_id: row.organization_id,
    tenant_id: row.tenant_id,
    organization_name: row.organization_name,
    role: row.role,
    invitation_version: row.version + 1n,
  };
}

function resolvedAdmin() {
  return [{
    membership_id: ADMIN.id,
    role: ADMIN.role,
    membership_version: ADMIN.version,
    organization_id: ADMIN.organizationId,
    tenant_id: ADMIN.organization.tenantId,
    organization_status: ADMIN.organization.status,
    organization_name: ADMIN.organization.name,
  }];
}

function serviceWith(queryHandler: (sql: string) => unknown = () => []) {
  const tx = {
    $queryRaw: jest.fn(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes('resolve_organization_admin_session')) return resolvedAdmin();
      if (sql.includes("set_config('app.current_user_id'")) return [{}];
      return queryHandler(sql);
    }),
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
    $queryRaw: jest.fn(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes('resolve_organization_admin_session')) {
        return resolvedAdmin();
      }
      return queryHandler(sql);
    }),
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const repository = {
    ensureCredentialState: jest.fn(),
    latestAuditChainPosition: jest.fn().mockResolvedValue({ chainKey: 'auth-global', prevHash: null, nextSequence: 1n }),
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
    const { service, tx } = serviceWith((sql) => (
      sql.includes('organization_membership_exists_for_email')
        ? [{ membership_exists: true }]
        : []
    ));

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
      token_hash: token.digest,
      expires_at: new Date(Date.now() - 1_000),
    });
    const { service, tx } = serviceWith((sql) => (
      sql.includes('resolve_invitation_acceptance_credential')
        ? [acceptanceCredential(row)]
        : []
    ));

    await expect(service.accept({
      token: token.token,
      password: 'Correct-Horse-9!',
      fullName: 'Employee User',
      termsVersion: '2026-09-03',
      privacyVersion: '2026-09-03',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-expired')).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.userOrg.create).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('rejects a consumed invitation without performing a write', async () => {
    const token = makeOpaqueToken('iv');
    const row = invitationRow({ id: token.id, token_hash: token.digest, status: 'ACCEPTED' });
    const { service, tx } = serviceWith((sql) => (
      sql.includes('resolve_invitation_acceptance_credential')
        ? [acceptanceCredential(row)]
        : []
    ));

    await expect(service.accept({
      token: token.token,
      password: 'Correct-Horse-9!',
      fullName: 'Employee User',
      termsVersion: '2026-09-03',
      privacyVersion: '2026-09-03',
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
      privacyVersion: '2026-09-03',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-consent')).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a strong password only when the invitation creates a new identity', async () => {
    const token = makeOpaqueToken('iv');
    const row = invitationRow({ id: token.id, token_hash: token.digest });
    const { service, tx } = serviceWith((sql) => (
      sql.includes('resolve_invitation_acceptance_credential')
        ? [acceptanceCredential(row)]
        : []
    ));

    await expect(service.accept({
      token: token.token,
      password: 'legacy1!',
      fullName: 'Employee User',
      termsVersion: '2026-09-03',
      privacyVersion: '2026-09-03',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-new-weak')).rejects.toMatchObject({ response: { code: 'PASSWORD_POLICY_FAILED' } });

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.userOrg.create).not.toHaveBeenCalled();
  });

  it('allows an existing identity to prove its current legacy password without resetting it', async () => {
    const password = 'legacy1!';
    const token = makeOpaqueToken('iv');
    const row = invitationRow({ id: token.id, token_hash: token.digest });
    const existingPasswordHash = await bcrypt.hash(password, 4);
    const { service, tx, repository } = serviceWith((sql) => {
      if (sql.includes('resolve_invitation_acceptance_credential')) {
        return [acceptanceCredential(row, {
          existing_user_id: 'existing-user',
          existing_password_hash: existingPasswordHash,
          existing_user_status: 'ACTIVE',
          existing_user_deleted_at: null,
        })];
      }
      if (sql.includes('accept_organization_invitation_identity')) {
        return [acceptedInvitation(row, 'existing-user')];
      }
      return [];
    });

    await expect(service.accept({
      token: token.token,
      password,
      fullName: 'Existing Employee',
      termsVersion: '2026-09-03',
      privacyVersion: '2026-09-03',
      acceptTerms: true,
      acceptPrivacy: true,
    }, 'corr-existing-legacy')).resolves.toMatchObject({ ok: true, membershipId: expect.any(String) });

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.userOrg.create).not.toHaveBeenCalled();
    expect(tx.$queryRaw.mock.calls
      .map((call) => sqlText((call as unknown[])[0]))
      .join('\n')).toContain('accept_organization_invitation_identity');
    expect(repository.ensureCredentialState).toHaveBeenCalledWith(
      expect.anything(), 'existing-user', '2026-09-03|2026-09-03', expect.any(Date),
    );
  });

  it('does not let an organization administrator initiate global MFA recovery for a cross-organization or staff identity', async () => {
    const { service, tx } = serviceWith((sql) => {
      if (sql.includes('organization_membership_command_events')) return [];
      if (sql.includes('prepare_organization_mfa_recovery_target')) {
        return [{
          prepared: true,
          user_id: 'shared-user',
          email: 'shared@example.test',
          has_other_membership: true,
          has_staff_assignment: true,
          mfa_enabled: true,
          has_mfa_secret: true,
          new_version: 3n,
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
      if (sql.includes('prepare_organization_mfa_recovery_target')) {
        return [{
          prepared: true,
          user_id: 'employee-user',
          email: 'employee@example.test',
          has_other_membership: false,
          has_staff_assignment: false,
          mfa_enabled: true,
          has_mfa_secret: true,
          new_version: 4n,
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
      if (sql.includes('prepare_organization_mfa_recovery_target')) {
        return [{
          prepared: true,
          user_id: 'employee-user-2',
          email: 'employee2@example.test',
          has_other_membership: false,
          has_staff_assignment: false,
          mfa_enabled: true,
          has_mfa_secret: true,
          new_version: 2n,
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
    // Membership, actor, purpose and the server-issued request key. No
    // credential material: the recovery token is minted separately and never
    // reaches this hash.
    const replayRequestHash = hashAuthMaterial(stableJson({
      purpose: 'auth.membership.mfa_reset',
      membershipId: replayMembershipId,
      actorId: ACTOR.id,
      requestId: 'idempotency-mfa-recovery-0004',
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
      if (sql.includes('organization_mfa_recovery_snapshot')) return [recovery];
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
      token_hash: token.digest,
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
      sql.includes('resolve_mfa_recovery_identity') ? [row] : []
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

    const success = serviceWith((sql) => {
      if (sql.includes('resolve_mfa_recovery_identity')) return [row];
      if (sql.includes('finalize_mfa_recovery_identity')) {
        return [{
          user_id: row.user_id,
          membership_id: row.membership_id,
          organization_id: row.organization_id,
          tenant_id: row.tenant_id,
          email: row.email,
        }];
      }
      return [];
    });
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
    expect(executedSql).not.toContain('mfa_secret_ciphertext = NULL');
    expect(executedSql).not.toContain("SET status = 'CONSUMED'");
    const authoritySql = success.tx.$queryRaw.mock.calls
      .map((call) => sqlText((call as unknown[])[0]))
      .join('\n');
    expect(authoritySql).toContain('resolve_mfa_recovery_identity');
    expect(authoritySql).toContain('finalize_mfa_recovery_identity');
  });

  it('revokes the recovery challenge when the subject password attempt budget is exhausted', async () => {
    const token = makeOpaqueToken('mr');
    const row = {
      id: token.id,
      user_id: 'attempt-user',
      membership_id: 'attempt-membership',
      organization_id: 'org-a',
      tenant_id: 'tenant-a',
      token_hash: token.digest,
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
      sql.includes('resolve_mfa_recovery_identity') ? [row] : []
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
