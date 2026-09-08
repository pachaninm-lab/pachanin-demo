import { Prisma } from '@prisma/client';
import { StaffAccessRepository } from './staff-access.repository';

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join('?') || String(query);
}

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
