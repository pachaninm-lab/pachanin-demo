import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from './password-hashing';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthController } from './auth.controller';
import { PUBLIC_ROUTE } from '../../common/decorators/public.decorator';
import { RATE_LIMIT_OPTIONS } from '../../common/decorators/rate-limit.decorator';
import { RequestUser, Role } from '../../common/types/request-user';

/**
 * OWASP ASVS 5.0 V6.2.2 and V6.2.3.
 *
 * These run the real AuthService.changeOwnPassword against a recording
 * repository, rather than asserting that the source contains a check. The
 * property under test is what the service DOES with a wrong current password,
 * and a test that reads the file cannot tell.
 */

const USER: RequestUser = {
  id: 'u-1',
  email: 'owner@example.test',
  fullName: 'Owner',
  role: Role.FARMER,
  orgId: 'org-1',
  tenantId: 'tenant-1',
  membershipId: 'm-1',
  isOrgAdmin: false,
  sessionId: 's-1',
} as RequestUser;

type Call = { name: string; args: unknown[] };

function repositoryFor(storedHash: string | null, options: { changeSucceeds?: boolean; userId?: string } = {}) {
  const calls: Call[] = [];
  const record = (name: string) => (...args: unknown[]) => { calls.push({ name, args }); };
  return {
    calls,
    repository: {
      prisma: {},
      transaction: async (work: (tx: unknown) => Promise<unknown>) => work({}),
      findLoginCredentialByEmail: async () => (storedHash === null ? null : {
        user_id: options.userId ?? USER.id,
        email: USER.email,
        password_hash: storedHash,
      }),
      changeOwnPassword: async (...args: unknown[]) => {
        calls.push({ name: 'changeOwnPassword', args });
        return options.changeSucceeds === false ? null : USER.email;
      },
      revokeAllUserSessions: async (...args: unknown[]) => { record('revokeAllUserSessions')(...args); },
    },
  };
}

function serviceWith(repository: unknown): AuthService {
  const { AuthService: Real } = jest.requireActual('./auth.service');
  const service = Object.create(Real.prototype) as AuthService;
  Object.defineProperty(service, 'repository', { value: repository, writable: true });
  return service;
}

const audits: Array<{ action: string; outcome: string; reason?: string | null }> = [];
jest.mock('./auth-audit', () => ({
  appendAuthAudit: jest.fn(async (_repo: unknown, _tx: unknown, input: { action: string; outcome: string; reason?: string | null }) => {
    audits.push(input);
  }),
}));

const dto = (currentPassword: string, newPassword: string): ChangePasswordDto =>
  ({ currentPassword, newPassword }) as ChangePasswordDto;

describe('changing your own password', () => {
  const CURRENT = 'Curr3nt-Passw0rd!';
  const NEXT = 'N3xt-Passw0rd-Str0ng!';
  let storedHash: string;

  beforeAll(async () => { storedHash = await hashPassword(CURRENT); });
  beforeEach(() => { audits.length = 0; });

  it('replaces the password when the current one is proved', async () => {
    const { repository, calls } = repositoryFor(storedHash);
    const result = await serviceWith(repository).changeOwnPassword(USER, dto(CURRENT, NEXT));

    expect(result).toEqual({ success: true, sessionsRevoked: true });
    const change = calls.find((c) => c.name === 'changeOwnPassword');
    expect(change).toBeDefined();
    // The stored hash is passed down as the expected value, so the database
    // compare-and-sets on it rather than trusting the check above.
    expect(change!.args[3]).toBe(storedHash);
    // What is written is a hash OF the new password - asserted by verifying it,
    // not by checking that it looks unlike the plaintext. An earlier version of
    // this test only required the value to differ from the password and to be
    // long enough, and a mutation storing `password + padding` walked straight
    // past both.
    const written = String(change!.args[2]);
    expect(written).not.toContain(NEXT);
    expect(await verifyPassword(NEXT, written)).toBe(true);
    expect(await verifyPassword(CURRENT, written)).toBe(false);
    expect(audits.map((a) => [a.action, a.outcome])).toContainEqual(['auth.password.change', 'SUCCESS']);
  });

  it('refuses when the current password is wrong, and says so only to the audit trail', async () => {
    const { repository, calls } = repositoryFor(storedHash);
    await expect(serviceWith(repository).changeOwnPassword(USER, dto('not-the-password', NEXT)))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(calls.find((c) => c.name === 'changeOwnPassword')).toBeUndefined();
    expect(audits).toContainEqual(expect.objectContaining({
      action: 'auth.password.change', outcome: 'DENIED', reason: 'CURRENT_PASSWORD_INCORRECT',
    }));
  });

  it('does not reveal which of the two reasons refused it', async () => {
    const wrongPassword = repositoryFor(storedHash);
    const noCredential = repositoryFor(null);
    const first = await serviceWith(wrongPassword.repository)
      .changeOwnPassword(USER, dto('wrong', NEXT)).catch((e: BadRequestException) => e.getResponse());
    const second = await serviceWith(noCredential.repository)
      .changeOwnPassword(USER, dto(CURRENT, NEXT)).catch((e: BadRequestException) => e.getResponse());
    expect(first).toEqual(second);
  });

  it('refuses a session whose account is not the one the credential belongs to', async () => {
    // The session names the account. An email that now resolves elsewhere must
    // not let this session change that other account's password.
    const { repository, calls } = repositoryFor(storedHash, { userId: 'someone-else' });
    await expect(serviceWith(repository).changeOwnPassword(USER, dto(CURRENT, NEXT)))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(calls.find((c) => c.name === 'changeOwnPassword')).toBeUndefined();
    expect(audits).toContainEqual(expect.objectContaining({ reason: 'CREDENTIAL_NOT_RESOLVED' }));
  });

  it('refuses to set the password to the one already in use', async () => {
    const { repository, calls } = repositoryFor(storedHash);
    await expect(serviceWith(repository).changeOwnPassword(USER, dto(CURRENT, CURRENT)))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(calls.find((c) => c.name === 'changeOwnPassword')).toBeUndefined();
  });

  it('refuses when the stored credential moved between the check and the write', async () => {
    // The database compare-and-set is the authority, and it can refuse after the
    // service has already verified. A concurrent change must not read as success.
    const { repository } = repositoryFor(storedHash, { changeSucceeds: false });
    await expect(serviceWith(repository).changeOwnPassword(USER, dto(CURRENT, NEXT)))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(audits).toContainEqual(expect.objectContaining({ reason: 'CREDENTIAL_CHANGED_CONCURRENTLY' }));
  });

  it('revokes every session once the password has changed', async () => {
    const { repository, calls } = repositoryFor(storedHash);
    await serviceWith(repository).changeOwnPassword(USER, dto(CURRENT, NEXT));
    const revoke = calls.find((c) => c.name === 'revokeAllUserSessions');
    expect(revoke).toBeDefined();
    expect(revoke!.args[2]).toBe('PASSWORD_CHANGED');
    // Ordering matters: revoking before the write would sign the user out of a
    // change that then failed.
    expect(calls.findIndex((c) => c.name === 'changeOwnPassword'))
      .toBeLessThan(calls.findIndex((c) => c.name === 'revokeAllUserSessions'));
  });
});

describe('how the route is exposed', () => {
  const handler = AuthController.prototype.changePassword;

  it('exists and is not public', () => {
    expect(typeof handler).toBe('function');
    expect(Reflect.getMetadata(PUBLIC_ROUTE, handler)).toBeFalsy();
  });

  it('is bounded per account, because the value being guessed is the password', () => {
    const limit = Reflect.getMetadata(RATE_LIMIT_OPTIONS, handler);
    expect(limit).toBeDefined();
    expect(limit.scope).toBe('user');
    expect(limit.limit).toBeLessThanOrEqual(10);
  });
});
