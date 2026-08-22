import { PersistentAuthRepository } from './persistent-auth.repository';

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join('?') || String(query);
}

describe('persistent MFA compare-and-set authority', () => {
  it('activates login MFA only from a pending login challenge and pending bound session', async () => {
    const client = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ updated: true }]),
    };
    const repository = new PersistentAuthRepository({} as never);

    await repository.activateMfaSession(client as never, {
      challengeId: 'challenge-1', sessionId: 'session-1', userId: 'user-1',
      method: 'TOTP', enableMfa: false,
    });

    const statements = client.$executeRaw.mock.calls.map(([query]) => sqlText(query));
    expect(statements[0]).toContain("status = 'PENDING'");
    expect(statements[0]).toContain("type IN ('TOTP_ENROLL', 'TOTP_VERIFY')");
    expect(statements[0]).toContain('session_id =');
    expect(statements[0]).toContain('user_id =');
    expect(statements[1]).toContain("status = 'MFA_PENDING'");
    expect(statements[1]).toContain('user_id =');
    expect(statements[2]).toContain('mfa_key_version = CASE');
    expect(statements[2]).toContain('mfa_secret_ciphertext');
    expect(client.$queryRaw).toHaveBeenCalledTimes(1);
    expect(sqlText(client.$queryRaw.mock.calls[0][0])).toContain(
      'auth.finalize_authenticated_user_mfa',
    );
  });

  it('never lets a backup-code login reconcile TOTP metadata or the compatibility flag', async () => {
    const client = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn(),
    };
    const repository = new PersistentAuthRepository({} as never);

    await repository.activateMfaSession(client as never, {
      challengeId: 'challenge-1', sessionId: 'session-1', userId: 'user-1',
      method: 'BACKUP', enableMfa: false, backupHashes: [],
    });

    expect(client.$queryRaw).not.toHaveBeenCalled();
  });

  it('fails the transaction when a fresh TOTP cannot prove compatibility reconciliation', async () => {
    const client = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ updated: false }]),
    };
    const repository = new PersistentAuthRepository({} as never);

    await expect(repository.activateMfaSession(client as never, {
      challengeId: 'challenge-1', sessionId: 'session-1', userId: 'user-1',
      method: 'TOTP', enableMfa: false,
    })).rejects.toThrow('MFA user state conflict');
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

describe('Gekta email resend serialization', () => {
  it('uses the same per-email advisory lock as initial registration', async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const repository = new PersistentAuthRepository({} as never);

    await repository.lockGektaRegistrationEmail(client as never, 'agronom@example.test');

    const statement = sqlText(client.$queryRaw.mock.calls[0][0]);
    expect(statement).toContain('pg_advisory_xact_lock');
    expect(statement).toContain('hashtextextended');
  });

  it('revokes only pending Gekta challenges for that user', async () => {
    const client = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const repository = new PersistentAuthRepository({} as never);

    await repository.revokePendingGektaEmailChallenges(client as never, 'user-1');

    const statement = sqlText(client.$executeRaw.mock.calls[0][0]);
    expect(statement).toContain("scope = 'GEKTA'");
    expect(statement).toContain("status = 'PENDING'");
  });

  it('reads the declared phone only through the registration-specific resolver', async () => {
    const client = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const repository = new PersistentAuthRepository({} as never);

    await repository.getProductRegistrationSubject(client as never, 'user-1');

    const statement = sqlText(client.$queryRaw.mock.calls[0][0]);
    expect(statement).toContain('auth.resolve_gekta_registration_subject_v1');
    expect(statement).toContain('phone');
  });
});
