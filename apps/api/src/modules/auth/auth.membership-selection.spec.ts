import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/types/request-user';
import { makeOpaqueToken } from './auth-crypto';
import { AuthService } from './auth.service';
import type { CredentialStateRow, IdentityRow, MembershipIdentityRow } from './persistent-auth.repository';

const PASSWORD = 'Correct-Horse-9!';

function identity(membershipId: string, organizationId: string, organizationName: string): MembershipIdentityRow {
  return {
    user_id: 'user-1',
    email: 'multi@example.test',
    password_hash: '',
    full_name: 'Multi User',
    phone: null,
    user_status: 'ACTIVE',
    membership_id: membershipId,
    role: Role.BUYER,
    is_org_admin: false,
    membership_status: 'ACTIVE',
    organization_id: organizationId,
    organization_name: organizationName,
    organization_status: 'VERIFIED',
    tenant_id: `tenant-${organizationId}`,
  };
}

function credential(): CredentialStateRow {
  return {
    user_id: 'user-1', credential_version: 1, failed_login_count: 0, locked_until: null,
    password_changed_at: null, last_login_at: null, mfa_enabled: false,
    mfa_secret_ciphertext: null, mfa_key_version: null, mfa_backup_hashes: null,
    consent_version: null, consent_at: null,
  };
}

function repository() {
  const repo = {
    prisma: {},
    transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    findIdentityByEmail: jest.fn(),
    findIdentitiesByUser: jest.fn(),
    findIdentityByUserAndMembership: jest.fn(),
    ensureLoginThrottle: jest.fn(),
    getLoginThrottle: jest.fn().mockResolvedValue(null),
    setLoginThrottle: jest.fn(),
    clearLoginThrottle: jest.fn(),
    markLoginSuccess: jest.fn(),
    ensureCredentialState: jest.fn(),
    getCredentialState: jest.fn().mockResolvedValue(credential()),
    createMembershipSelectionChallenge: jest.fn(),
    getMembershipSelectionChallengeForUpdate: jest.fn(),
    recordMembershipSelectionFailure: jest.fn(),
    consumeMembershipSelectionChallenge: jest.fn(),
    createSession: jest.fn(),
    createRefreshToken: jest.fn(),
    createMfaChallenge: jest.fn(),
    setMfaSecret: jest.fn(),
    latestAuditHash: jest.fn().mockResolvedValue(null),
    insertAudit: jest.fn(),
  };
  return repo;
}

describe('safe multi-membership login selection', () => {
  it('creates no session until one of the password-verified memberships is selected', async () => {
    const repo = repository();
    const first = identity('membership-a', 'org-a', 'Organization A');
    first.password_hash = await bcrypt.hash(PASSWORD, 4);
    const second = { ...identity('membership-b', 'org-b', 'Organization B'), password_hash: first.password_hash };
    repo.findIdentityByEmail.mockResolvedValue(first);
    repo.findIdentitiesByUser.mockResolvedValue([first, second]);

    const result = await new AuthService(repo as never).login({ email: first.email, password: PASSWORD });

    expect(repo.findIdentityByEmail).toHaveBeenCalledWith(expect.anything(), first.email, true);
    expect(result).toMatchObject({
      membershipSelectionRequired: true,
      memberships: [
        { membershipId: 'membership-a', organizationId: 'org-a' },
        { membershipId: 'membership-b', organizationId: 'org-b' },
      ],
    });
    expect(repo.createMembershipSelectionChallenge).toHaveBeenCalledTimes(1);
    expect(repo.createSession).not.toHaveBeenCalled();
    expect(repo.createRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects a membership that is not bound to the challenge user', async () => {
    const repo = repository();
    const token = makeOpaqueToken('ms');
    repo.getMembershipSelectionChallengeForUpdate.mockResolvedValue({
      id: token.id,
      user_id: 'user-1',
      token_hash: token.hash,
      status: 'PENDING',
      credential_version: 1,
      current_credential_version: 1,
      user_status: 'ACTIVE',
      attempts: 0,
      max_attempts: 5,
      expires_at: new Date(Date.now() + 60_000),
    });
    repo.findIdentityByUserAndMembership.mockResolvedValue(null);

    await expect(new AuthService(repo as never).selectMembership({
      challengeToken: token.token,
      membershipId: 'membership-from-another-user',
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.recordMembershipSelectionFailure).toHaveBeenCalledWith(expect.anything(), token.id, false);
    expect(repo.consumeMembershipSelectionChallenge).not.toHaveBeenCalled();
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it('reloads the selected membership from PostgreSQL and consumes the challenge once', async () => {
    const repo = repository();
    const token = makeOpaqueToken('ms');
    const selected = identity('membership-b', 'org-b', 'Organization B') as IdentityRow;
    repo.getMembershipSelectionChallengeForUpdate.mockResolvedValue({
      id: token.id,
      user_id: selected.user_id,
      token_hash: token.hash,
      status: 'PENDING',
      credential_version: 1,
      current_credential_version: 1,
      user_status: 'ACTIVE',
      attempts: 0,
      max_attempts: 5,
      expires_at: new Date(Date.now() + 60_000),
    });
    repo.findIdentityByUserAndMembership.mockResolvedValue(selected);

    const result = await new AuthService(repo as never).selectMembership({
      challengeToken: token.token,
      membershipId: selected.membership_id,
    });

    expect(result).toMatchObject({
      mfaRequired: false,
      user: { membershipId: 'membership-b', orgId: 'org-b', role: Role.BUYER },
    });
    expect(repo.consumeMembershipSelectionChallenge).toHaveBeenCalledTimes(1);
    expect(repo.createSession).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      membershipId: 'membership-b', organizationId: 'org-b', tenantId: 'tenant-org-b',
    }));
    expect(repo.createRefreshToken).toHaveBeenCalledTimes(1);
  });
});
