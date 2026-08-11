import {
  decryptAuthMailEnvelope,
  encryptAuthMailEnvelope,
  resetAuthMailKeyCacheForTests,
} from './auth-mail-crypto';

describe('auth-mail encrypted outbox envelope', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousKey = process.env.AUTH_MAIL_OUTBOX_KEY;
  const previousFile = process.env.AUTH_MAIL_OUTBOX_KEY_FILE;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MAIL_OUTBOX_KEY = '11'.repeat(32);
    delete process.env.AUTH_MAIL_OUTBOX_KEY_FILE;
    resetAuthMailKeyCacheForTests();
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousKey === undefined) delete process.env.AUTH_MAIL_OUTBOX_KEY;
    else process.env.AUTH_MAIL_OUTBOX_KEY = previousKey;
    if (previousFile === undefined) delete process.env.AUTH_MAIL_OUTBOX_KEY_FILE;
    else process.env.AUTH_MAIL_OUTBOX_KEY_FILE = previousFile;
    resetAuthMailKeyCacheForTests();
  });

  it('round-trips without persisting plaintext recipient or bearer material', () => {
    const context = {
      kind: 'REGISTRATION_EMAIL_VERIFICATION',
      idempotencyKey: 'auth-mail:registration:test:1',
      correlationId: 'corr-test-1',
    };
    const envelope = {
      to: 'person@example.com',
      subject: 'Прозрачная Цена — подтвердите email',
      text: 'https://example.com/verify?token=rev_secret_bearer',
    };

    const encrypted = encryptAuthMailEnvelope(envelope, context);
    const persisted = JSON.stringify(encrypted);
    expect(persisted).not.toContain('person@example.com');
    expect(persisted).not.toContain('rev_secret_bearer');
    expect(decryptAuthMailEnvelope(encrypted, context)).toEqual(envelope);
  });

  it('binds ciphertext to kind, idempotency key and correlation id as AAD', () => {
    const context = {
      kind: 'PASSWORD_RESET',
      idempotencyKey: 'auth-mail:password-reset:test:1',
      correlationId: 'corr-test-2',
    };
    const encrypted = encryptAuthMailEnvelope({
      to: 'person@example.com',
      subject: 'Reset',
      text: 'body',
    }, context);

    expect(() => decryptAuthMailEnvelope(encrypted, {
      ...context,
      correlationId: 'corr-tampered',
    })).toThrow();
  });

  it('rejects production environment-carried key material', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_MAIL_OUTBOX_KEY = '22'.repeat(32);
    delete process.env.AUTH_MAIL_OUTBOX_KEY_FILE;
    resetAuthMailKeyCacheForTests();

    expect(() => encryptAuthMailEnvelope({
      to: 'person@example.com',
      subject: 'Subject',
      text: 'Body',
    }, {
      kind: 'ACCOUNT_SECURITY_NOTICE',
      idempotencyKey: 'auth-mail:security:test:1',
      correlationId: 'corr-test-3',
    })).toThrow(/AUTH_MAIL_OUTBOX_KEY_FILE is required/);
  });
});
