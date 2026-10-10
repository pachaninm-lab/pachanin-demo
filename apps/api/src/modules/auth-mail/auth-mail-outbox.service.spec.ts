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

  it('casts all twelve parameters to the exact reviewed enqueue signature', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{
      outbox_id: 'auth_mail_test',
      replayed: false,
    }]);
    const tx = {
      $queryRaw: queryRaw,
      $executeRaw: jest.fn(),
    } as unknown as AuthSqlClient;

    const availableAt = new Date('2034-12-31T23:59:00.000Z');
    const expiresAt = new Date('2035-01-01T00:00:00.000Z');

    await expect(new AuthMailOutboxService().enqueue(tx, {
      kind: 'PASSWORD_RESET',
      idempotencyKey: 'auth-mail:test-exact-signature',
      correlationId: 'test-exact-signature',
      envelope: {
        to: 'reviewer@example.test',
        subject: 'Password reset',
        text: 'Use the protected reset flow.',
      },
      availableAt,
      expiresAt,
      maxAttempts: 12,
    })).resolves.toMatchObject({ queued: true, replayed: false });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0]?.[0] as CapturedSql;
    const statement = sql.strings.join('?');

    expect(statement).toContain('FROM auth.enqueue_mail_outbox(');
    expect(sql.values).toHaveLength(12);
    expect(statement.match(/\?::(?:text|integer|timestamptz)/g)).toEqual([
      '?::text',
      '?::text',
      '?::text',
      '?::text',
      '?::text',
      '?::integer',
      '?::text',
      '?::text',
      '?::text',
      '?::integer',
      '?::timestamptz',
      '?::timestamptz',
    ]);
    expect(sql.values[5]).toBe(1);
    expect(sql.values[9]).toBe(12);
    expect(sql.values[10]).toBe(availableAt);
    expect(sql.values[11]).toBe(expiresAt);
  });


  it('polls only the bounded registration-decision status authority', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{
      delivery_status: 'SENT',
      attempt_count: 1,
      max_attempts: 12,
      last_error_code: null,
      sent_at: new Date('2035-01-01T00:00:00.000Z'),
    }]);
    const client = { $queryRaw: queryRaw, $executeRaw: jest.fn() } as unknown as AuthSqlClient;
    const key = `auth-mail:registration-decision:${'a'.repeat(64)}`;
    const result = await new AuthMailOutboxService().waitForRegistrationDecisionDelivery(
      client,
      key,
      { timeoutMs: 1_000, pollMs: 100 },
    );
    expect(result.status).toBe('SENT');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0]?.[0] as CapturedSql;
    expect(sql.strings.join('?')).toContain('auth.registration_decision_mail_delivery_status(?::text)');
    expect(sql.values).toEqual([key]);
  });
});
