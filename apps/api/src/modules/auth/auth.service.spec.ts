import fs from 'node:fs';
import path from 'node:path';
import {
  AuthService,
  requiresRecentFinancialMfa,
  requiresRoleMfa,
} from './auth.service';
import {
  FINANCIAL_MFA_THRESHOLD_KOPECKS,
  Role,
} from '../../common/types/request-user';

const authSource = fs.readFileSync(path.join(process.cwd(), 'src/modules/auth/auth.service.ts'), 'utf8');

describe('persistent auth policy', () => {
  it('contains no direct registration or synthetic identity authority', () => {
    expect(authSource).not.toContain('async register(');
    expect(authSource).not.toContain('registerSyntheticSeedUser');
    expect(authSource).not.toContain('SEED_CANONICAL_TEST_DEAL');
    expect(authSource).not.toContain('seedCompatibilityUsers');
  });

  it('keeps account export and anonymization behind named PostgreSQL functions', () => {
    expect(authSource).toContain('this.repository.accountDataExport(');
    expect(authSource).toContain('this.repository.anonymizeAccountIdentity(');
    expect(authSource).not.toContain('this.repository.prisma.user.findUnique(');
    expect(authSource).not.toContain('tx.user.findUnique(');
    expect(authSource).not.toContain('tx.user.update(');
  });

  it('re-reads and locks the password authority inside the login transaction', () => {
    expect(authSource).toContain('findLoginCredentialByEmail(tx, email)');
    expect(authSource).toContain('findLoginCredentialByEmail(\n      this.repository.prisma');
    expect(authSource).toContain('secureEqual(currentLoginCredential.password_hash, loginCredential.password_hash)');
    expect(authSource.indexOf('findIdentitiesByUser(')).toBeGreaterThan(
      authSource.indexOf('secureEqual(currentLoginCredential.password_hash, loginCredential.password_hash)'),
    );
  });

  it('hides inactive accounts while retaining authenticated context denials and the audit reason', () => {
    expect(authSource).toContain("this.identityInvalidReason(memberships[0]) ?? 'NO_ACTIVE_MEMBERSHIP'");
    expect(authSource).toContain("outcome: 'DENIED'");
    expect(authSource).toContain("if (result.reason === 'USER_NOT_ACTIVE') {");
    expect(authSource).toContain("throw new UnauthorizedException('Invalid credentials');");
    expect(authSource).toContain('throw new ForbiddenException(result.reason);');
  });

  it.each([
    Role.ADMIN,
    Role.COMPLIANCE_OFFICER,
    Role.ARBITRATOR,
  ])('requires MFA before activating privileged role %s', (role) => {
    expect(requiresRoleMfa(role)).toBe(true);
  });

  it('requires recent MFA at the exact financial threshold', () => {
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS - 1)).toBe(false);
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS)).toBe(true);
    expect(requiresRecentFinancialMfa(FINANCIAL_MFA_THRESHOLD_KOPECKS + 1)).toBe(true);
  });
});

describe('session-bound account lifecycle', () => {
  const requestUser = {
    id: 'user-account',
    email: 'account@example.test',
    orgId: 'org-account',
    tenantId: 'tenant-account',
    membershipId: 'membership-account',
    sessionId: 'session-account',
    role: Role.FARMER,
  } as const;

  it('maps the bounded PostgreSQL export without direct identity reads', async () => {
    const repository = {
      prisma: {},
      accountDataExport: jest.fn().mockResolvedValue({
        user_id: requestUser.id,
        email: requestUser.email,
        full_name: 'Account Owner',
        phone: '+79990000000',
        created_at: new Date('2026-08-01T10:00:00.000Z'),
        consent_version: '2026-07-31',
        consent_at: new Date('2026-08-01T10:01:00.000Z'),
        mfa_enabled: true,
        credential_version: 4,
        membership_data: [{
          membershipId: requestUser.membershipId,
          role: Role.FARMER,
          status: 'ACTIVE',
          organizationId: requestUser.orgId,
          organizationName: 'Account Farm',
          tenantId: requestUser.tenantId,
          organizationStatus: 'VERIFIED',
        }],
      }),
    };
    const service = new AuthService(repository as never);

    const result = await service.getUserData(requestUser);

    expect(repository.accountDataExport).toHaveBeenCalledWith(repository.prisma, {
      userId: requestUser.id,
      sessionId: requestUser.sessionId,
      membershipId: requestUser.membershipId,
      organizationId: requestUser.orgId,
      tenantId: requestUser.tenantId,
    });
    expect(result).toMatchObject({
      profile: { id: requestUser.id, email: requestUser.email },
      memberships: [{
        membershipId: requestUser.membershipId,
        organizationId: requestUser.orgId,
        tenantId: requestUser.tenantId,
      }],
      consent: { version: '2026-07-31' },
      security: { mfaEnabled: true, credentialVersion: 4 },
    });
  });

  it('anonymizes atomically through the session-bound authority and audits the tuple', async () => {
    const transactionClient = {};
    const anonymizedAt = new Date('2026-08-08T08:00:00.000Z');
    const repository = {
      prisma: {},
      transaction: jest.fn(async (work: (client: object) => Promise<unknown>) => work(transactionClient)),
      anonymizeAccountIdentity: jest.fn().mockResolvedValue({ applied: true, anonymized_at: anonymizedAt }),
      latestAuditChainPosition: jest.fn().mockResolvedValue({
        chainKey: requestUser.sessionId,
        prevHash: null,
        nextSequence: 1n,
      }),
      insertAudit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(repository as never);

    await expect(service.anonymizeUser(requestUser)).resolves.toEqual({
      success: true,
      anonymizedAt: anonymizedAt.toISOString(),
    });
    expect(repository.anonymizeAccountIdentity).toHaveBeenCalledWith(transactionClient, {
      userId: requestUser.id,
      sessionId: requestUser.sessionId,
      membershipId: requestUser.membershipId,
      organizationId: requestUser.orgId,
      tenantId: requestUser.tenantId,
    });
    expect(repository.insertAudit).toHaveBeenCalledWith(transactionClient, expect.objectContaining({
      userId: requestUser.id,
      sessionId: requestUser.sessionId,
      membershipId: requestUser.membershipId,
      organizationId: requestUser.orgId,
      tenantId: requestUser.tenantId,
      action: 'auth.account.anonymize',
      outcome: 'SUCCESS',
    }));
  });
});
