import { Prisma } from '@prisma/client';
import { StaffAccessRepository, StaffSessionActivationRetryExhaustedError } from './staff-access.repository';

// The default API Jest root is src. Include the admitted service suites here so
// normal CI executes them; focused runs should select this aggregate only.
import '../../../test/staff-access/staff-session-activation.service.spec';
import '../../../test/staff-access/staff-session-lifecycle.service.spec';

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join('?') || String(query);
}

describe('StaffAccessRepository exact linked session authority', () => {
  it.each([false, true])('revalidates the linked grant and assignment with optional row lock=%s', async (forUpdate) => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const repository = new StaffAccessRepository({} as never);
    await expect(repository.getAccessSessionByHash({ $queryRaw: queryRaw } as never, 'hash-unit', 'actor-unit', forUpdate)).resolves.toBeNull();
    const query = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual(['hash-unit', 'actor-unit']);
    const sql = sqlText(query);
    for (const predicate of [
      "s.status = 'ACTIVE'", 's.ended_at IS NULL', 's.expires_at > NOW()',
      'g.grantee_user_id = s.actor_user_id', "g.status = 'ACTIVE'", 'g.revoked_at IS NULL',
      'g.starts_at <= NOW()', 'g.expires_at > NOW()', 'a.user_id = s.actor_user_id',
      "a.status IN ('ELIGIBLE', 'ACTIVE')", 'a.revoked_at IS NULL',
      'a.valid_from <= NOW()', 'a.valid_until > NOW()', 's.access_mode = g.access_mode',
      's.effective_tenant_id IS NOT DISTINCT FROM g.target_tenant_id',
      's.effective_organization_id IS NOT DISTINCT FROM g.target_organization_id',
      's.effective_user_id IS NOT DISTINCT FROM g.target_user_id',
      's.effective_role IS NOT DISTINCT FROM g.target_role', 's.permissions <@ g.permissions',
      'LEAST(s.expires_at, g.expires_at, COALESCE(a.valid_until, s.expires_at)) AS expires_at',
    ]) expect(sql).toContain(predicate);
    expect(sql.includes('FOR UPDATE OF s')).toBe(forUpdate);
  });

  it('does not interpolate a forged token or actor into exact-authority SQL', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const repository = new StaffAccessRepository({} as never);
    const token = "token' OR TRUE --";
    const actor = "actor' OR TRUE --";
    await repository.getAccessSessionByHash({ $queryRaw: queryRaw } as never, token, actor);
    const query = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual([token, actor]);
    expect(sqlText(query)).not.toContain(token);
    expect(sqlText(query)).not.toContain(actor);
  });
});

describe('StaffAccessRepository exact session lifecycle lookup', () => {
  it.each(['actor-unit', ''])('binds the exact actor including an empty actor instead of widening scope: %s', async (actorId) => {
    const target = { id: 'session-unit' };
    const queryRaw = jest.fn().mockResolvedValue([target]);
    const repository = new StaffAccessRepository({} as never);
    await expect(repository.getActiveAccessSession({ $queryRaw: queryRaw } as never, 'session-unit', actorId)).resolves.toBe(target);
    const query = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual(['session-unit', actorId]);
    expect(sqlText(query)).toContain('WHERE s.id = ?');
    expect(sqlText(query)).toContain('AND s.actor_user_id = ?');
    expect(sqlText(query)).toContain("s.status = 'ACTIVE' AND s.expires_at > NOW()");
    expect(sqlText(query)).toContain('FOR UPDATE OF s');
    expect(sqlText(query)).not.toContain('LIMIT');
  });

  it('permits a target-only lookup for the separately permission-checked revocation path', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const repository = new StaffAccessRepository({} as never);
    await expect(repository.getActiveAccessSession({ $queryRaw: queryRaw } as never, 'session-unit')).resolves.toBeNull();
    const query = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual(['session-unit']);
    expect(sqlText(query)).not.toContain('AND s.actor_user_id');
    expect(sqlText(query)).toContain('FOR UPDATE OF s');
  });

  it('keeps an untrusted session ID in SQL parameters', async () => {
    const untrusted = "session' OR TRUE --";
    const queryRaw = jest.fn().mockResolvedValue([]);
    const repository = new StaffAccessRepository({} as never);
    await repository.getActiveAccessSession({ $queryRaw: queryRaw } as never, untrusted, 'actor-unit');
    const query = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual([untrusted, 'actor-unit']);
    expect(sqlText(query)).not.toContain(untrusted);
  });
});

describe('StaffAccessRepository audit-chain lock', () => {
  it('uses the supplied transaction client and the canonical actor-scoped lock', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ locked: false }])
      .mockResolvedValueOnce([{ hash: 'previous-event-hash' }]);
    const executeRaw = jest.fn();
    const repository = new StaffAccessRepository({} as never);

    await expect(
      repository.latestEventHash(
        { $queryRaw: queryRaw, $executeRaw: executeRaw } as never,
        'actor-user-1',
      ),
    ).resolves.toBe('previous-event-hash');

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(executeRaw).not.toHaveBeenCalled();

    const lockQuery = queryRaw.mock.calls[0][0] as Prisma.Sql;
    const readQuery = queryRaw.mock.calls[1][0] as Prisma.Sql;
    expect(sqlText(lockQuery)).toContain(
      'SELECT pg_advisory_xact_lock(hashtextextended(?, 0)) IS NULL AS locked',
    );
    expect(sqlText(lockQuery)).not.toContain('auth.lock_staff_access_event_chain');
    expect(lockQuery.values).toEqual(['actor-user-1']);
    expect(sqlText(readQuery)).toContain('FROM auth.staff_access_events');
    expect(sqlText(readQuery)).toContain('WHERE actor_user_id = ?');
    expect(readQuery.values).toEqual(['actor-user-1']);
  });

  it('returns null when the actor has no previous audit event', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ locked: false }])
      .mockResolvedValueOnce([]);
    const repository = new StaffAccessRepository({} as never);

    await expect(
      repository.latestEventHash(
        { $queryRaw: queryRaw, $executeRaw: jest.fn() } as never,
        'actor-user-2',
      ),
    ).resolves.toBeNull();
  });
});

describe('StaffAccessRepository actor session activation', () => {
  it.each([true, false])('returns the actor-wide active predicate %s without a row-list cap', async (active) => {
    const queryRaw = jest.fn().mockResolvedValue([{ active }]);
    const repository = new StaffAccessRepository({} as never);
    await expect(repository.hasActiveSession({ $queryRaw: queryRaw } as never, 'actor-1')).resolves.toBe(active);
    const query = queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual(['actor-1']);
    expect(sqlText(query)).toContain('SELECT EXISTS');
    expect(sqlText(query)).toContain("status = 'ACTIVE' AND expires_at > NOW()");
    expect(sqlText(query)).not.toContain('LIMIT');
  });

  it.each([
    { rows: [] }, { rows: [{ active: null }] }, { rows: [{ active: true }, { active: false }] },
    { rows: null }, { rows: [null] },
  ])(
    'fails closed on malformed predicate rows', async ({ rows }) => {
      const repository = new StaffAccessRepository({} as never);
      await expect(repository.hasActiveSession({ $queryRaw: jest.fn().mockResolvedValue(rows) } as never, 'actor-1'))
        .rejects.toThrow('Staff active-session predicate is unavailable');
    },
  );

  it.each([
    { code: 'P2034' },
    { code: 'P2010', meta: { code: '40001' } },
    { code: 'P2010', meta: { code: '40P01' } },
  ])('retries only known rolled-back transaction conflicts on a fresh transaction', async (fields) => {
    const contexts: object[] = [];
    const work = jest.fn().mockResolvedValue('committed');
    const transaction = jest.fn().mockImplementation(async (callback: (tx: never) => Promise<string>) => {
      const tx = { attempt: contexts.length }; contexts.push(tx);
      const result = await callback(tx as never);
      if (contexts.length < 3) throw Object.assign(new Error('conflict'), fields);
      return result;
    });
    const repository = new StaffAccessRepository({ $transaction: transaction } as never);
    await expect(repository.activateSessionTransaction(work)).resolves.toBe('committed');
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(new Set(contexts).size).toBe(3);
    expect(work).toHaveBeenCalledTimes(3);
    for (const [, options] of transaction.mock.calls) {
      expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
    }
  });

  it('bounds repeated conflicts at three attempts with a dedicated exhaustion result', async () => {
    const transaction = jest.fn().mockRejectedValue(Object.assign(new Error('conflict'), { code: 'P2034' }));
    const repository = new StaffAccessRepository({ $transaction: transaction } as never);
    await expect(repository.activateSessionTransaction(jest.fn())).rejects.toBeInstanceOf(StaffSessionActivationRetryExhaustedError);
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry permission errors or ordinary staff transactions', async () => {
    const denied = Object.assign(new Error('permission denied'), { code: 'P2010', meta: { code: '42501' } });
    const transaction = jest.fn().mockRejectedValue(denied);
    const repository = new StaffAccessRepository({ $transaction: transaction } as never);
    await expect(repository.activateSessionTransaction(jest.fn())).rejects.toBe(denied);
    expect(transaction).toHaveBeenCalledTimes(1);
    transaction.mockReset().mockRejectedValue(Object.assign(new Error('conflict'), { code: 'P2034' }));
    await expect(repository.transaction(jest.fn())).rejects.toMatchObject({ code: 'P2034' });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
