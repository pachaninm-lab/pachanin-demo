import { PersistentAuthRepository } from './persistent-auth.repository';
import {
  MAX_CONCURRENT_SESSIONS,
  MAX_CONCURRENT_SESSIONS_PRIVILEGED,
  PLATFORM_SESSION_SCOPE,
  concurrentSessionLimitForRole,
} from './auth.service';
import { Role } from '../../common/types/request-user';

/**
 * OWASP ASVS 5.0 V7.1.2: a documented number of concurrent sessions, and a
 * documented behaviour when it is reached.
 *
 * The number and the behaviour are both choices, so these tests pin the
 * behaviour rather than the number wherever the number is not the point - a
 * later operator changing 5 to 4 should not have to edit a test that was really
 * about "the newest session survives".
 */

const audits: Array<{ action: string; outcome: string; reason?: string | null; metadata?: unknown }> = [];
jest.mock('./auth-audit', () => ({
  appendAuthAudit: jest.fn(async (_r: unknown, _t: unknown, input: never) => { audits.push(input); }),
}));

describe('how many sessions an account may hold', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it('is smaller for a privileged role than for an ordinary one', () => {
    // The tiering reuses ROLES_REQUIRING_MFA rather than inventing a second
    // notion of "privileged" - the inconsistency V6.3.4 is about.
    expect(concurrentSessionLimitForRole(Role.FARMER)).toBe(MAX_CONCURRENT_SESSIONS);
    expect(concurrentSessionLimitForRole(Role.ADMIN)).toBe(MAX_CONCURRENT_SESSIONS_PRIVILEGED);
    expect(concurrentSessionLimitForRole(Role.COMPLIANCE_OFFICER)).toBe(MAX_CONCURRENT_SESSIONS_PRIVILEGED);
    expect(MAX_CONCURRENT_SESSIONS_PRIVILEGED).toBeLessThan(MAX_CONCURRENT_SESSIONS);
  });

  it('treats an unknown role as ordinary rather than as unlimited', () => {
    expect(concurrentSessionLimitForRole('NOT_A_ROLE')).toBe(MAX_CONCURRENT_SESSIONS);
    expect(concurrentSessionLimitForRole(undefined)).toBe(MAX_CONCURRENT_SESSIONS);
    expect(concurrentSessionLimitForRole(null)).toBe(MAX_CONCURRENT_SESSIONS);
  });

  it('can be retuned by an operator without a deploy', () => {
    process.env.MAX_CONCURRENT_SESSIONS = '2';
    process.env.MAX_CONCURRENT_SESSIONS_PRIVILEGED = '1';
    expect(concurrentSessionLimitForRole(Role.FARMER)).toBe(2);
    expect(concurrentSessionLimitForRole(Role.ADMIN)).toBe(1);
  });

  it('ignores a value that is not a usable limit instead of obeying it', () => {
    // A typo must not silently remove the bound. Zero and negative are the
    // dangerous ones: read literally they would evict every session, and
    // "unlimited" is what this control exists to end.
    for (const bad of ['0', '-1', '', 'many', '2.5', 'Infinity']) {
      process.env.MAX_CONCURRENT_SESSIONS = bad;
      expect([bad, concurrentSessionLimitForRole(Role.FARMER)]).toEqual([bad, MAX_CONCURRENT_SESSIONS]);
    }
  });
});

describe('what the eviction query is asked to do', () => {
  const repository = () => {
    const { PersistentAuthRepository: Real } = jest.requireActual('./persistent-auth.repository');
    return Object.create(Real.prototype) as PersistentAuthRepository;
  };

  function capture() {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    return {
      statements,
      client: {
        $executeRaw: async (q: { sql: string; values: unknown[] }) => {
          statements.push({ sql: q.sql, values: q.values });
          return statements.length === 1 ? 2 : 0;
        },
      } as never,
    };
  }

  it('keeps the NEWEST sessions and ends the oldest', async () => {
    const { statements, client } = capture();
    await repository().revokeSessionsBeyondLimit(client, 'u-1', PLATFORM_SESSION_SCOPE, 5, 'CONCURRENT_SESSION_LIMIT');
    const [evict] = statements;
    // created_at DESC with an OFFSET means the rows skipped are the newest and
    // the rows updated are the oldest.
    expect(evict.sql).toMatch(/order\s+by\s+created_at\s+desc/iu);
    expect(evict.sql).toMatch(/offset/iu);
    expect(evict.sql).toMatch(/status\s+in\s*\(\s*'ACTIVE'\s*,\s*'MFA_PENDING'\s*\)/iu);
    expect(evict.values).toContain(5);
  });

  it('orders by age, not by idleness', async () => {
    // Ordering by last_seen_at would let an attacker keep a stolen session alive
    // by touching it and have the owner's real sessions evicted instead.
    const { statements, client } = capture();
    await repository().revokeSessionsBeyondLimit(client, 'u-1', PLATFORM_SESSION_SCOPE, 5, 'r');
    expect(statements[0].sql).not.toMatch(/order\s+by[^)]*last_seen_at/iu);
  });

  it('is confined to one session scope, so a product session is not evicted by a platform login', async () => {
    const { statements, client } = capture();
    await repository().revokeSessionsBeyondLimit(client, 'u-1', PLATFORM_SESSION_SCOPE, 5, 'r');
    expect(statements[0].sql).toMatch(/scope\s*=/iu);
    expect(statements[0].values).toContain(PLATFORM_SESSION_SCOPE);
  });

  it('is confined to one account', async () => {
    const { statements, client } = capture();
    await repository().revokeSessionsBeyondLimit(client, 'u-1', PLATFORM_SESSION_SCOPE, 5, 'r');
    expect(statements[0].sql).toMatch(/user_id\s*=/iu);
    expect(statements[0].values).toContain('u-1');
  });

  it('revokes the refresh tokens of what it ended, because otherwise it ended nothing', async () => {
    const { statements, client } = capture();
    const evicted = await repository().revokeSessionsBeyondLimit(client, 'u-1', PLATFORM_SESSION_SCOPE, 5, 'r');
    expect(evicted).toBe(2);
    expect(statements).toHaveLength(2);
    expect(statements[1].sql).toMatch(/auth\.refresh_tokens/iu);
  });

  it('does not touch refresh tokens when it evicted nothing', async () => {
    const statements: Array<unknown> = [];
    const client = { $executeRaw: async (q: unknown) => { statements.push(q); return 0; } } as never;
    const evicted = await repository().revokeSessionsBeyondLimit(client, 'u-1', PLATFORM_SESSION_SCOPE, 5, 'r');
    expect(evicted).toBe(0);
    expect(statements).toHaveLength(1);
  });

  it('refuses a limit that is not a positive integer rather than running it', async () => {
    // OFFSET 0 would revoke every session the account has. This must be an
    // error, not an eviction.
    const { client } = capture();
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await expect(repository().revokeSessionsBeyondLimit(client, 'u-1', PLATFORM_SESSION_SCOPE, bad, 'r'))
        .rejects.toThrow(/positive integer/iu);
    }
  });
});

describe('the limit as the login path actually applies it', () => {
  /**
   * The failure this guards against has happened in this codebase before: a
   * complete policy that nothing calls (see V6.4.6's note on a reset token that
   * was issued and connected to nothing). A limit that is never applied is
   * indistinguishable from no limit, so this drives the real login path.
   */
  function loginWith(role: string) {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const repository = {
      createSession: async (...args: unknown[]) => { calls.push({ name: 'createSession', args }); },
      revokeSessionsBeyondLimit: async (...args: unknown[]) => {
        calls.push({ name: 'revokeSessionsBeyondLimit', args });
        return 2;
      },
      setMfaSecret: async () => undefined,
      createMfaChallenge: async () => undefined,
      // The non-MFA branch goes on to issue tokens; without this the login
      // throws after the limit was applied and the assertion reads as a
      // missing limit rather than as a missing mock.
      createRefreshToken: async () => undefined,
    };
    const { AuthService: Real } = jest.requireActual('./auth.service');
    const service = Object.create(Real.prototype);
    Object.defineProperty(service, 'repository', { value: repository, writable: true });
    const identity = {
      user_id: 'u-1', membership_id: 'm-1', organization_id: 'org-1',
      tenant_id: 't-1', role, is_org_admin: false,
    };
    const credential = { credential_version: 3, mfa_enabled: false, mfa_secret_ciphertext: null };
    return { calls, run: () => service.createLoginSession({}, identity, credential, 'ua', '198.51.100.7') };
  }

  beforeEach(() => { audits.length = 0; });

  it('applies the limit on every login, with this account, this scope and this role budget', async () => {
    const { calls, run } = loginWith(Role.FARMER);
    await run();
    const capped = calls.find((c) => c.name === 'revokeSessionsBeyondLimit');
    // Named rather than bare, so a failure says WHICH call was missing: jest
    // does not take vitest's expect(value, message).
    expect(calls.map((c) => c.name)).toContain('revokeSessionsBeyondLimit');
    expect(capped!.args[1]).toBe('u-1');
    expect(capped!.args[2]).toBe(PLATFORM_SESSION_SCOPE);
    expect(capped!.args[3]).toBe(MAX_CONCURRENT_SESSIONS);
  });

  it('gives a privileged login the smaller budget', async () => {
    const { calls, run } = loginWith(Role.ADMIN);
    await run();
    const capped = calls.find((c) => c.name === 'revokeSessionsBeyondLimit');
    expect(capped!.args[3]).toBe(MAX_CONCURRENT_SESSIONS_PRIVILEGED);
  });

  it('counts the new session against the limit, by applying it after the session exists', async () => {
    // Applied before, the account sits one over the limit until the next login.
    const { calls, run } = loginWith(Role.FARMER);
    await run();
    expect(calls.findIndex((c) => c.name === 'createSession'))
      .toBeLessThan(calls.findIndex((c) => c.name === 'revokeSessionsBeyondLimit'));
  });

  it('records the eviction, because a silent one looks like a stolen session', async () => {
    const { run } = loginWith(Role.FARMER);
    await run();
    expect(audits).toContainEqual(expect.objectContaining({
      action: 'auth.session.evicted', outcome: 'SUCCESS', reason: 'CONCURRENT_SESSION_LIMIT',
    }));
  });
});
