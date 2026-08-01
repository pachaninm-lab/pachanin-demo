import { UnauthorizedException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  encryptMfaSecret,
  generateTotpSecret,
  hashAuthMaterial,
  makeOpaqueToken,
} from './auth-crypto';
import { AuthService } from './auth.service';
import type { CredentialStateRow, MfaChallengeRow, SessionContextRow } from './persistent-auth.repository';

const actor: RequestUser = {
  id: 'user-1', email: 'admin@example.test', orgId: 'org-1', tenantId: 'tenant-1',
  membershipId: 'membership-1', role: Role.FARMER, sessionId: 'session-1', isOrgAdmin: true,
};

function session(): SessionContextRow {
  return {
    user_id: actor.id, email: actor.email, password_hash: 'unused', full_name: 'Admin', phone: null,
    user_status: 'ACTIVE', membership_id: actor.membershipId as string, role: actor.role,
    is_org_admin: true, membership_status: 'ACTIVE', organization_id: actor.orgId,
    organization_status: 'VERIFIED', tenant_id: actor.tenantId as string, session_id: actor.sessionId as string,
    session_status: 'ACTIVE', refresh_family_id: 'family-1', session_credential_version: 1,
    mfa_level: 'TOTP', mfa_verified_at: new Date(Date.now() - 60 * 60_000),
    session_expires_at: new Date(Date.now() + 60_000), revoked_at: null, revocation_reason: null,
    current_credential_version: 1, current_mfa_enabled: true,
  };
}

function credential(backupCode = 'ABCD-1234-EF56'): CredentialStateRow {
  return {
    user_id: actor.id, credential_version: 1, failed_login_count: 0, locked_until: null,
    password_changed_at: null, last_login_at: null, mfa_enabled: true,
    mfa_secret_ciphertext: encryptMfaSecret(generateTotpSecret()).ciphertext,
    mfa_key_version: 'v1', mfa_backup_hashes: [hashAuthMaterial(backupCode)],
    consent_version: null, consent_at: null,
  };
}

function repository() {
  return {
    prisma: {},
    transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    getSessionContext: jest.fn().mockResolvedValue(session()),
    ensureCredentialState: jest.fn(),
    getCredentialState: jest.fn().mockResolvedValue(credential()),
    expirePendingMfaChallenges: jest.fn(),
    createMfaChallenge: jest.fn(),
    getMfaChallengeForUpdate: jest.fn(),
    recordMfaFailure: jest.fn(),
    revokeSession: jest.fn(),
    activateMfaStepUp: jest.fn().mockResolvedValue(new Date('2026-08-01T12:00:00.000Z')),
    latestAuditHash: jest.fn().mockResolvedValue(null),
    insertAudit: jest.fn(),
  };
}

describe('active-session MFA step-up', () => {
  it('locks the live session and replaces any pending step-up challenge', async () => {
    const repo = repository();
    const result = await new AuthService(repo as never).startMfaStepUp(actor);

    expect(repo.getSessionContext).toHaveBeenCalledWith(expect.anything(), actor.sessionId, actor.id, true);
    expect(repo.expirePendingMfaChallenges).toHaveBeenCalledWith(expect.anything(), actor.sessionId, 'STEP_UP');
    expect(repo.createMfaChallenge).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      sessionId: actor.sessionId, userId: actor.id, type: 'STEP_UP',
    }));
    expect(result).toMatchObject({ ok: true, methods: ['totp', 'backup_code'] });
  });

  it('rejects a valid token bound to a different active session', async () => {
    const repo = repository();
    const token = makeOpaqueToken('mc');
    repo.getMfaChallengeForUpdate.mockResolvedValue({
      ...session(), challenge_id: token.id, challenge_token_hash: token.hash, challenge_type: 'STEP_UP',
      challenge_status: 'PENDING', challenge_attempts: 0, challenge_max_attempts: 5,
      challenge_expires_at: new Date(Date.now() + 60_000), session_id: 'session-other',
    } satisfies MfaChallengeRow);

    await expect(new AuthService(repo as never).verifyMfaStepUp(actor, {
      challengeToken: token.token, code: 'ABCD-1234-EF56',
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.activateMfaStepUp).not.toHaveBeenCalled();
  });

  it('consumes a backup code once and refreshes MFA only on the bound session', async () => {
    const repo = repository();
    const token = makeOpaqueToken('mc');
    repo.getMfaChallengeForUpdate.mockResolvedValue({
      ...session(), challenge_id: token.id, challenge_token_hash: token.hash, challenge_type: 'STEP_UP',
      challenge_status: 'PENDING', challenge_attempts: 0, challenge_max_attempts: 5,
      challenge_expires_at: new Date(Date.now() + 60_000),
    } satisfies MfaChallengeRow);

    const result = await new AuthService(repo as never).verifyMfaStepUp(actor, {
      challengeToken: token.token, code: 'ABCD-1234-EF56',
    });

    expect(repo.activateMfaStepUp).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      challengeId: token.id, sessionId: actor.sessionId, userId: actor.id, method: 'BACKUP', backupHashes: [],
    }));
    expect(result).toEqual({ ok: true, mfaVerified: true, mfaVerifiedAt: '2026-08-01T12:00:00.000Z' });
  });

  it('does not revoke an active session when a consumed login challenge is replayed', async () => {
    const repo = repository();
    const token = makeOpaqueToken('mc');
    repo.getMfaChallengeForUpdate.mockResolvedValue({
      ...session(), challenge_id: token.id, challenge_token_hash: token.hash, challenge_type: 'TOTP_VERIFY',
      challenge_status: 'VERIFIED', challenge_attempts: 1, challenge_max_attempts: 5,
      challenge_expires_at: new Date(Date.now() + 60_000),
    } satisfies MfaChallengeRow);

    await expect(new AuthService(repo as never).verifyMfa({
      challengeToken: token.token, code: 'ABCD-1234-EF56',
    })).rejects.toBeInstanceOf(UnauthorizedException);

    expect(repo.revokeSession).not.toHaveBeenCalled();
    expect(repo.recordMfaFailure).not.toHaveBeenCalled();
  });

  it('keeps a STEP_UP token out of the unauthenticated login-MFA verifier', async () => {
    const repo = repository();
    const token = makeOpaqueToken('mc');
    repo.getMfaChallengeForUpdate.mockResolvedValue({
      ...session(), challenge_id: token.id, challenge_token_hash: token.hash, challenge_type: 'STEP_UP',
      challenge_status: 'PENDING', challenge_attempts: 0, challenge_max_attempts: 5,
      challenge_expires_at: new Date(Date.now() + 60_000),
    } satisfies MfaChallengeRow);

    await expect(new AuthService(repo as never).verifyMfa({
      challengeToken: token.token, code: 'ABCD-1234-EF56',
    })).rejects.toBeInstanceOf(UnauthorizedException);

    expect(repo.revokeSession).not.toHaveBeenCalled();
    expect(repo.recordMfaFailure).not.toHaveBeenCalled();
  });

  it('does not increment a verified step-up challenge on replay', async () => {
    const repo = repository();
    const token = makeOpaqueToken('mc');
    repo.getMfaChallengeForUpdate.mockResolvedValue({
      ...session(), challenge_id: token.id, challenge_token_hash: token.hash, challenge_type: 'STEP_UP',
      challenge_status: 'VERIFIED', challenge_attempts: 0, challenge_max_attempts: 5,
      challenge_expires_at: new Date(Date.now() + 60_000),
    } satisfies MfaChallengeRow);

    await expect(new AuthService(repo as never).verifyMfaStepUp(actor, {
      challengeToken: token.token, code: 'ABCD-1234-EF56',
    })).rejects.toBeInstanceOf(UnauthorizedException);

    expect(repo.recordMfaFailure).not.toHaveBeenCalled();
  });
});
