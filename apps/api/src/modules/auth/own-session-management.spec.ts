import 'reflect-metadata';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { hashPassword } from './password-hashing';
import { RATE_LIMIT_OPTIONS, type RateLimitOptions } from '../../common/decorators/rate-limit.decorator';
import { PUBLIC_ROUTE } from '../../common/decorators/public.decorator';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * ASVS 5.0 V7.5.2: users can view and - having authenticated again with at
 * least one factor - terminate any or all of their active sessions.
 *
 * Staff already had this; ordinary members had nothing. The only
 * session-termination route on the user-facing surface was ADMIN-only, so the
 * person who had lost control of a session was the one person who could not
 * end it.
 *
 * The properties worth testing are not the happy path. They are that the
 * caller's own user id bounds what can be ended, and that a wrong password
 * changes nothing.
 */

const PASSWORD = 'correct horse battery staple';

const user: RequestUser = {
  id: 'user-1',
  email: 'Member@Example.Test',
  role: Role.FARMER,
  orgId: 'org-1',
  sessionId: 'session-current',
} as RequestUser;

type Calls = {
  revokeOwn: Array<{ userId: string; sessionId: string }>;
  revokeOthers: Array<{ userId: string; keep: string }>;
  audits: Array<{ outcome: string; reason?: string }>;
};

async function service(overrides: { storedHash?: string; credentialUserId?: string } = {}) {
  const storedHash = overrides.storedHash ?? (await hashPassword(PASSWORD));
  const calls: Calls = { revokeOwn: [], revokeOthers: [], audits: [] };

  const repository = {
    prisma: {},
    transaction: jest.fn().mockImplementation(async (work: Function) => work({})),
    findLoginCredentialByEmail: jest.fn().mockResolvedValue({
      user_id: overrides.credentialUserId ?? 'user-1',
      email: 'member@example.test',
      password_hash: storedHash,
    }),
    listActiveUserSessions: jest.fn().mockResolvedValue([
      {
        id: 'session-current',
        created_at: new Date('2026-09-01T10:00:00Z'),
        last_seen_at: new Date('2026-09-15T09:00:00Z'),
        expires_at: new Date('2026-09-30T10:00:00Z'),
        mfa_level: 'TOTP',
      },
      {
        id: 'session-other',
        created_at: new Date('2026-08-20T10:00:00Z'),
        last_seen_at: new Date('2026-09-14T09:00:00Z'),
        expires_at: new Date('2026-09-29T10:00:00Z'),
        mfa_level: 'NONE',
      },
    ]),
    revokeOwnSession: jest.fn().mockImplementation((_tx: unknown, userId: string, sessionId: string) => {
      calls.revokeOwn.push({ userId, sessionId });
      return Promise.resolve(1);
    }),
    revokeOtherUserSessions: jest.fn().mockImplementation((_tx: unknown, userId: string, keep: string) => {
      calls.revokeOthers.push({ userId, keep });
      return Promise.resolve(3);
    }),
    writeAuditEvent: jest.fn().mockImplementation((_tx: unknown, event: { outcome: string; reason?: string }) => {
      calls.audits.push({ outcome: event.outcome, reason: event.reason });
      return Promise.resolve();
    }),
  };

  const { AuthService } = await import('./auth.service');
  const instance = Object.create(AuthService.prototype) as InstanceType<typeof AuthService>;
  Object.assign(instance, { repository });
  // audit() is private and writes through the repository; route it there.
  Object.assign(instance, {
    audit: (tx: unknown, event: { outcome: string; reason?: string }) => repository.writeAuditEvent(tx, event),
  });
  return { instance, repository, calls };
}

const options = (handler: string): RateLimitOptions | undefined => new Reflector().getAllAndOverride<RateLimitOptions>(
  RATE_LIMIT_OPTIONS,
  [(AuthController.prototype as never as Record<string, never>)[handler], AuthController],
);

describe('a user can see their own sessions', () => {
  it('lists them, marking the one asking', async () => {
    const { instance } = await service();
    const result = await instance.listOwnSessions(user);
    expect(result.sessions.map((s) => [s.id, s.current])).toEqual([
      ['session-current', true],
      ['session-other', false],
    ]);
  });

  it('asks only for its own rows', async () => {
    const { instance, repository } = await service();
    await instance.listOwnSessions(user);
    expect(repository.listActiveUserSessions).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  it('returns no device or address fingerprint', async () => {
    // The table stores only hashes of those, which name no device a person
    // would recognise and would let sessions be correlated for nothing.
    const { instance } = await service();
    const [first] = (await instance.listOwnSessions(user)).sessions;
    expect(Object.keys(first).sort()).toEqual(
      ['createdAt', 'current', 'expiresAt', 'id', 'lastSeenAt', 'mfaLevel'],
    );
  });
});

describe('ending a session needs the password', () => {
  it('ends the named session when the password is right', async () => {
    const { instance, calls } = await service();
    await expect(instance.revokeOwnSessions(user, { password: PASSWORD, sessionId: 'session-other' }))
      .resolves.toEqual({ revoked: 1 });
    expect(calls.revokeOwn).toEqual([{ userId: 'user-1', sessionId: 'session-other' }]);
  });

  it('refuses a wrong password and ends nothing', async () => {
    const { instance, calls } = await service();
    await expect(instance.revokeOwnSessions(user, { password: 'wrong', sessionId: 'session-other' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(calls.revokeOwn).toEqual([]);
    expect(calls.revokeOthers).toEqual([]);
  });

  it('records the refusal, because an attempt on somebody"s sessions is worth seeing', async () => {
    const { instance, calls } = await service();
    await expect(instance.revokeOwnSessions(user, { password: 'wrong', others: true })).rejects.toThrow();
    expect(calls.audits).toEqual([{ outcome: 'DENIED', reason: 'REAUTHENTICATION_FAILED' }]);
  });

  it('refuses when the credential resolves to a different account', async () => {
    // A correct password for somebody else is still not re-authentication of
    // the caller.
    const { instance, calls } = await service({ credentialUserId: 'user-2' });
    await expect(instance.revokeOwnSessions(user, { password: PASSWORD, sessionId: 'session-other' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(calls.revokeOwn).toEqual([]);
  });
});

describe('what a caller can reach', () => {
  it('ends every other session while keeping the one asking', async () => {
    const { instance, calls } = await service();
    await expect(instance.revokeOwnSessions(user, { password: PASSWORD, others: true }))
      .resolves.toEqual({ revoked: 3 });
    expect(calls.revokeOthers).toEqual([{ userId: 'user-1', keep: 'session-current' }]);
  });

  it('always passes its own user id, so a foreign session id reaches nothing', async () => {
    const { instance, calls } = await service();
    await instance.revokeOwnSessions(user, { password: PASSWORD, sessionId: 'somebody-elses-session' });
    expect(calls.revokeOwn).toEqual([{ userId: 'user-1', sessionId: 'somebody-elses-session' }]);
    // The repository scopes the UPDATE by user_id, so this ends nothing; what
    // matters here is that the service never widens beyond the caller.
  });

  it('refuses a request that names neither a session nor the others', async () => {
    const { instance } = await service();
    await expect(instance.revokeOwnSessions(user, { password: PASSWORD }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('the routes themselves', () => {
  it('are not public', () => {
    for (const handler of ['listOwnSessions', 'revokeOwnSessions']) {
      const target = (AuthController.prototype as never as Record<string, unknown>)[handler];
      expect([handler, Reflect.getMetadata(PUBLIC_ROUTE, target as object) === true]).toEqual([handler, false]);
    }
  });

  it('are bounded per account, and the one carrying a password more tightly', () => {
    expect(options('listOwnSessions')?.scope).toBe('user');
    const revoke = options('revokeOwnSessions');
    expect(revoke?.scope).toBe('user');
    expect(revoke?.limit).toBeLessThanOrEqual(10);
    expect(revoke?.windowSeconds).toBeGreaterThanOrEqual(300);
  });
});

/**
 * The service passing its own user id is only half of it. The scoping that
 * actually stops one account ending another's session is in the SQL, and the
 * tests above mock the repository away. These read the statements themselves.
 */
describe('the statements are scoped by the caller, not by the id they sent', () => {
  const captured: Array<{ sql: string; values: unknown[] }> = [];
  const client = {
    $executeRaw: jest.fn().mockImplementation((query: { sql: string; values: unknown[] }) => {
      captured.push({ sql: query.sql, values: query.values });
      return Promise.resolve(1);
    }),
    $queryRaw: jest.fn().mockImplementation((query: { sql: string; values: unknown[] }) => {
      captured.push({ sql: query.sql, values: query.values });
      return Promise.resolve([]);
    }),
  };

  const repository = () => {
    const { PersistentAuthRepository } = jest.requireActual('./persistent-auth.repository');
    return Object.create(PersistentAuthRepository.prototype);
  };

  beforeEach(() => { captured.length = 0; });

  it('bounds a single revoke by user_id and by platform scope', async () => {
    await repository().revokeOwnSession(client, 'user-1', 'session-x', 'USER_SESSION_REVOKE');
    const sessions = captured.find((c) => c.sql.includes('UPDATE auth.sessions'));
    expect(sessions).toBeDefined();
    expect(sessions!.sql).toMatch(/user_id\s*=\s*\$?\??/u);
    expect(sessions!.sql).toContain("scope = 'PLATFORM'");
    expect(sessions!.values).toEqual(expect.arrayContaining(['user-1', 'session-x']));
  });

  it('bounds the refresh tokens it revokes by the same user', async () => {
    await repository().revokeOwnSession(client, 'user-1', 'session-x', 'USER_SESSION_REVOKE');
    const tokens = captured.find((c) => c.sql.includes('auth.refresh_tokens'));
    expect(tokens).toBeDefined();
    expect(tokens!.sql).toMatch(/s\.user_id\s*=\s*\$?\??/u);
    expect(tokens!.values).toEqual(expect.arrayContaining(['user-1']));
  });

  it('keeps the caller"s own session when ending the others', async () => {
    await repository().revokeOtherUserSessions(client, 'user-1', 'session-current', 'USER_SESSION_REVOKE');
    const sessions = captured.find((c) => c.sql.includes('UPDATE auth.sessions'));
    expect(sessions!.sql).toMatch(/id\s*<>\s*\$?\??/u);
    expect(sessions!.values).toEqual(expect.arrayContaining(['user-1', 'session-current']));
  });

  it('lists only live platform sessions of that user', async () => {
    await repository().listActiveUserSessions(client, 'user-1');
    const listed = captured.find((c) => c.sql.includes('FROM auth.sessions'));
    expect(listed!.sql).toContain("scope = 'PLATFORM'");
    expect(listed!.sql).toContain("status = 'ACTIVE'");
    expect(listed!.sql).toContain('expires_at > NOW()');
    expect(listed!.values).toEqual(['user-1']);
  });

  it('never selects the stored user agent or address hashes', async () => {
    await repository().listActiveUserSessions(client, 'user-1');
    const listed = captured.find((c) => c.sql.includes('FROM auth.sessions'));
    expect(listed!.sql).not.toContain('user_agent_hash');
    expect(listed!.sql).not.toContain('ip_hash');
  });
});
