import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const PASSWORD = 'Correct-Horse-9!';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

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
    findDefaultLoginMembershipId: jest.fn(async () => {
      calls.push('membership');
      return 'membership-a';
    }),
    findIdentityByUserAndMembership: jest.fn(async () => {
      calls.push('context');
      return {
        user_id: 'user-a',
        email: 'a@example.test',
        password_hash: PASSWORD_HASH,
        full_name: 'Alice',
        phone: null,
        user_status: 'ACTIVE',
        membership_id: 'membership-a',
        role: 'BUYER',
        organization_id: 'org-a',
        organization_status: 'VERIFIED',
        tenant_id: 'tenant-a',
      };
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
      // Login only checks presence here. The secret is decrypted later by the
      // MFA verification endpoint, never by the password step.
      mfa_secret_ciphertext: 'already-enrolled',
      mfa_key_version: 'v1',
      mfa_backup_hashes: [],
      consent_version: '1.2',
      consent_at: new Date(),
    })),
    markLoginSuccess: jest.fn(async () => undefined),
    createSession: jest.fn(async () => undefined),
    createMfaChallenge: jest.fn(async () => undefined),
    latestAuditHash: jest.fn(async () => null),
    insertAudit: jest.fn(async () => undefined),
  };
  return { repository, calls };
}

describe('minimal login bootstrap boundary', () => {
  it('never resolves membership or tenant context for an invalid password', async () => {
    const { repository, calls } = repositoryHarness();
    const service = new AuthService(repository);

    await expect(service.login({
      email: 'a@example.test',
      password: 'definitely-wrong',
    } as any)).rejects.toThrow(/invalid credentials/i);

    expect(repository.findLoginCredentialByEmail).toHaveBeenCalledTimes(1);
    expect(repository.findDefaultLoginMembershipId).not.toHaveBeenCalled();
    expect(repository.findIdentityByUserAndMembership).not.toHaveBeenCalled();
    expect(calls).toEqual(['credential']);
  });

  it('resolves context only after password proof and keeps it out of MFA-pending response', async () => {
    const { repository, calls } = repositoryHarness();
    const service = new AuthService(repository);

    const result = await service.login({
      email: 'a@example.test',
      password: PASSWORD,
    } as any) as any;

    // One three-field credential read precedes bcrypt and a second occurs inside
    // the serializable transaction to reject a password-change race. Only then
    // is membership/context authority exercised.
    expect(calls).toEqual(['credential', 'credential', 'membership', 'context']);
    expect(repository.createSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-a',
        membershipId: 'membership-a',
        organizationId: 'org-a',
        tenantId: 'tenant-a',
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
