import { PersistentAuthRepository } from './persistent-auth.repository';

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join('?') || String(query);
}

describe('persistent MFA compare-and-set authority', () => {
  it('activates login MFA only from a pending login challenge and pending bound session', async () => {
    const client = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const repository = new PersistentAuthRepository({} as never);

    await repository.activateMfaSession(client as never, {
      challengeId: 'challenge-1', sessionId: 'session-1', userId: 'user-1',
      method: 'TOTP', enableMfa: false,
    });

    const statements = client.$executeRaw.mock.calls.map(([query]) => sqlText(query));
    expect(statements[0]).toContain("status = 'PENDING'");
    expect(statements[0]).toContain("type IN ('TOTP_ENROLL', 'TOTP_VERIFY')");
    expect(statements[1]).toContain("status = 'MFA_PENDING'");
    expect(statements[1]).toContain('user_id =');
  });

  it('fails the transaction boundary when the challenge compare-and-set loses', async () => {
    const client = { $executeRaw: jest.fn().mockResolvedValueOnce(0) };
    const repository = new PersistentAuthRepository({} as never);

    await expect(repository.activateMfaSession(client as never, {
      challengeId: 'challenge-1', sessionId: 'session-1', userId: 'user-1',
      method: 'TOTP', enableMfa: false,
    })).rejects.toThrow('MFA login challenge conflict');
  });

  it('caps attempts and never mutates a non-pending challenge', async () => {
    const client = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const repository = new PersistentAuthRepository({} as never);

    await repository.recordMfaFailure(client as never, 'challenge-1', true);

    const statement = sqlText(client.$executeRaw.mock.calls[0][0]);
    expect(statement).toContain('LEAST(attempts + 1, max_attempts)');
    expect(statement).toContain("status = 'PENDING'");
  });
});
