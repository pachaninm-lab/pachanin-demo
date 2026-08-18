import { resetAuthMailKeyCacheForTests } from './auth-mail-crypto';
import { AuthMailOutboxService } from './auth-mail-outbox.service';

type CapturedSql = {
  text: string;
  values: readonly unknown[];
};

describe('AuthMailOutboxService PostgreSQL signature contract', () => {
  const originalKey = process.env.AUTH_MAIL_OUTBOX_KEY_V1;
  const originalCurrentVersion = process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MAIL_OUTBOX_KEY_V1 = '11'.repeat(32);
    process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION = '1';
    resetAuthMailKeyCacheForTests();
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.AUTH_MAIL_OUTBOX_KEY_V1;
    else process.env.AUTH_MAIL_OUTBOX_KEY_V1 = originalKey;

    if (originalCurrentVersion === undefined) delete process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION;
    else process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION = originalCurrentVersion;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    resetAuthMailKeyCacheForTests();
  });

  it('casts all twelve parameters to the exact SECURITY DEFINER regprocedure signature', async () => {
    let captured: CapturedSql | undefined;
    const tx = {
      $queryRaw: jest.fn(async (query: CapturedSql) => {
        captured = query;
        return [{ outbox_id: 'auth_mail_test', replayed: false }];
      }),
    };
    const service = new AuthMailOutboxService();
    const availableAt = new Date(Date.now() + 1_000);
    const expiresAt = new Date(Date.now() + 60_000);

    const result = await service.enqueue(tx as never, {
      kind: 'PASSWORD_RESET',
      idempotencyKey: 'auth-mail:password-reset:signature-contract',
      correlationId: 'signature-contract',
      envelope: {
        to: 'reviewer@example.test',
        subject: 'Password reset',
        text: 'Use the one-time reset link.',
      },
      availableAt,
      expiresAt,
      maxAttempts: 12,
    });

    expect(result.queued).toBe(true);
    expect(captured).toBeDefined();
    expect(captured?.values).toHaveLength(12);
    expect(captured?.text).toContain('$1::text');
    expect(captured?.text).toContain('$2::text');
    expect(captured?.text).toContain('$3::text');
    expect(captured?.text).toContain('$4::text');
    expect(captured?.text).toContain('$5::text');
    expect(captured?.text).toContain('$6::integer');
    expect(captured?.text).toContain('$7::text');
    expect(captured?.text).toContain('$8::text');
    expect(captured?.text).toContain('$9::text');
    expect(captured?.text).toContain('$10::integer');
    expect(captured?.text).toContain('$11::timestamptz');
    expect(captured?.text).toContain('$12::timestamptz');
    expect(captured?.values[5]).toBe(1);
    expect(captured?.values[9]).toBe(12);
    expect(captured?.values[10]).toBe(availableAt);
    expect(captured?.values[11]).toBe(expiresAt);
  });
});
