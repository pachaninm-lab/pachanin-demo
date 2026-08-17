import type { AuthSqlClient } from '../auth/persistent-auth.repository';
import { AuthMailOutboxService } from './auth-mail-outbox.service';

type CapturedSql = {
  strings: readonly string[];
  values: readonly unknown[];
};

describe('AuthMailOutboxService PostgreSQL function binding', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousKeyVersion = process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION;
  const previousKey = process.env.AUTH_MAIL_OUTBOX_KEY_V1;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION = '1';
    process.env.AUTH_MAIL_OUTBOX_KEY_V1 = '11'.repeat(32);
  });

  afterAll(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousKeyVersion === undefined) delete process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION;
    else process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION = previousKeyVersion;
    if (previousKey === undefined) delete process.env.AUTH_MAIL_OUTBOX_KEY_V1;
    else process.env.AUTH_MAIL_OUTBOX_KEY_V1 = previousKey;
  });

  it('casts JavaScript integer parameters to the INT4 enqueue signature', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{
      outbox_id: 'auth_mail_test',
      replayed: false,
    }]);
    const tx = {
      $queryRaw: queryRaw,
      $executeRaw: jest.fn(),
    } as unknown as AuthSqlClient;

    await expect(new AuthMailOutboxService().enqueue(tx, {
      kind: 'PASSWORD_RESET',
      idempotencyKey: 'auth-mail:test-int4-casts',
      correlationId: 'test-int4-casts',
      envelope: {
        to: 'reviewer@example.test',
        subject: 'Password reset',
        text: 'Use the protected reset flow.',
      },
      expiresAt: new Date('2035-01-01T00:00:00.000Z'),
    })).resolves.toMatchObject({ queued: true, replayed: false });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0]?.[0] as CapturedSql;
    const statement = sql.strings.join('?');

    expect(statement).toContain('FROM auth.enqueue_mail_outbox(');
    expect(statement.match(/\?::integer/g)).toHaveLength(2);
    expect(sql.values[5]).toBe(1);
    expect(sql.values[9]).toBe(12);
  });
});
