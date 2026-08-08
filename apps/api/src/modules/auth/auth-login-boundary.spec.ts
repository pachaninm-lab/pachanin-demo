import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import type { MembershipIdentityRow } from './persistent-auth.repository';

const PASSWORD = 'Correct-Horse-9!';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

function membership(
  membershipId = 'membership-a',
  organizationId = 'org-a',
): MembershipIdentityRow {
  return {
    user_id: 'user-a',
    email: 'a@example.test',
    full_name: 'Alice',
    phone: null,
    user_status: 'ACTIVE',
    membership_id: membershipId,
    role: 'BUYER',
    is_org_admin: false,
    membership_status: 'ACTIVE',
    organization_id: organizationId,
    organization_name: `Organization ${organizationId}`,
    organization_status: 'VERIFIED',
    tenant_id: `tenant-${organizationId}`,
  };
}

function repositoryHarness() {
  const calls: string[] = [];
  const repository: any = {
    prisma: { kind: 'auth-client' },
    transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ kind: 'tx' }),
    findLoginCredentialByEmail: jest.fn(async () => {
      calls.push('credential');
      return {
        user_id: 'user-a',
        email: 'a@example.test',
        password_hash: PASSWORD_HASH,
      };
    }),
    findIdentitiesByUser: jest.fn(async () => {
      calls.push('memberships');
      return [membership()];
    }),
    ensureLoginThrottle: jest.fn(async () => undefined),
    getLoginThrottle: jest.fn(async () => null),
    setLoginThrottle: jest.fn(async () => undefined),
    clearLoginThrottle: jest.fn(async () => undefined),
    ensureCredentialState: jest.fn(async () => undefined),
    getCredentialState: jest.fn(async () => ({
      user_id: 'user-a',
      credential_version: 1,
      failed_login_count: 0,
      locked_until: null,
      password_changed_at: null,
      last_login_at: null,
      mfa_enabled: true,
      mfa_secret_ciphertext: 'already-enrolled',
      mfa_key_version: 'v1',
      mfa_backup_hashes: [],
      consent_version: '1.2',
      consent_at: new Date(),
    })),
    markLoginSuccess: jest.fn(async () => undefined),
    createMembershipSelectionChallenge: jest.fn(async () => undefined),
    createSession: jest.fn(async () => undefined),
    createMfaChallenge: jest.fn(async () => undefined),
    setMfaSecret: jest.fn(async () => undefined),
    latestAuditChainPosition: jest.fn(async () => ({
      chainKey: 'user:user-a',
      prevHash: null,
      nextSequence: 1n,
    })),
    insertAudit: jest.fn(async () => undefined),
  };
  return { repository, calls };
}

describe('password-first multi-membership login boundary', () => {
  it('never resolves membership or tenant context for an invalid password', async () => {
    const { repository, calls } = repositoryHarness();
    const service = new AuthService(repository);

    await expect(service.login({
      email: 'a@example.test',
      password: 'definitely-wrong',
    } as any)).rejects.toThrow(/invalid credentials/i);

    expect(repository.findLoginCredentialByEmail).toHaveBeenCalledTimes(1);
    expect(repository.findIdentitiesByUser).not.toHaveBeenCalled();
    expect(repository.createMembershipSelectionChallenge).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
    expect(repository.createMfaChallenge).not.toHaveBeenCalled();
    expect(calls).toEqual(['credential']);
  });

  it('starts membership projection only after password proof and transactional credential re-read', async () => {
    const { repository, calls } = repositoryHarness();
    const service = new AuthService(repository);

    await service.login({ email: 'a@example.test', password: PASSWORD } as any);

    expect(calls).toEqual(['credential', 'credential', 'memberships']);
    expect(repository.findLoginCredentialByEmail).toHaveBeenNthCalledWith(
      1,
      repository.prisma,
      'a@example.test',
    );
    expect(repository.findLoginCredentialByEmail.mock.calls[1][0]).toEqual({ kind: 'tx' });
  });

  it('rejects a password-change race before membership lookup or session creation', async () => {
    const { repository, calls } = repositoryHarness();
    repository.findLoginCredentialByEmail
      .mockResolvedValueOnce({
        user_id: 'user-a', email: 'a@example.test', password_hash: PASSWORD_HASH,
      })
      .mockImplementationOnce(async () => {
        calls.push('credential');
        return {
          user_id: 'user-a',
          email: 'a@example.test',
          password_hash: bcrypt.hashSync('Replacement-Password-8!', 4),
        };
      });
    const service = new AuthService(repository);

    await expect(service.login({
      email: 'a@example.test',
      password: PASSWORD,
    } as any)).rejects.toThrow(/invalid credentials/i);

    expect(repository.findIdentitiesByUser).not.toHaveBeenCalled();
    expect(repository.createMembershipSelectionChallenge).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
    expect(repository.createMfaChallenge).not.toHaveBeenCalled();
    expect(calls).toEqual(['credential']);
  });

  it('creates only a one-time selection challenge for multiple memberships', async () => {
    const { repository } = repositoryHarness();
    repository.findIdentitiesByUser.mockResolvedValue([
      membership('membership-a', 'org-a'),
      membership('membership-b', 'org-b'),
    ]);
    const service = new AuthService(repository);

    const result = await service.login({
      email: 'a@example.test',
      password: PASSWORD,
    } as any) as any;

    expect(result).toMatchObject({
      membershipSelectionRequired: true,
      memberships: [
        { membershipId: 'membership-a', organizationId: 'org-a' },
        { membershipId: 'membership-b', organizationId: 'org-b' },
      ],
    });
    expect(result.challengeToken).toMatch(/^ms_/);
    expect(repository.createMembershipSelectionChallenge).toHaveBeenCalledTimes(1);
    expect(repository.createSession).not.toHaveBeenCalled();
    expect(repository.createMfaChallenge).not.toHaveBeenCalled();
  });

  it('keeps tenant, organization and membership out of the MFA-pending response', async () => {
    const { repository } = repositoryHarness();
    const service = new AuthService(repository);

    const result = await service.login({
      email: 'a@example.test',
      password: PASSWORD,
    } as any) as any;

    expect(repository.createSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-a',
        membershipId: 'membership-a',
        organizationId: 'org-a',
        tenantId: 'tenant-org-a',
        status: 'MFA_PENDING',
      }),
    );
    expect(result.mfaRequired).toBe(true);
    expect(result.challengeToken).toMatch(/^mc_/);
    expect(result.user).toEqual({ email: 'a@example.test', role: 'BUYER' });
    expect(result.user).not.toHaveProperty('orgId');
    expect(result.user).not.toHaveProperty('tenantId');
    expect(result.user).not.toHaveProperty('membershipId');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });
});
