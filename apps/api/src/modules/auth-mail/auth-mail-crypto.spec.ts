import {
  authMailReplayDigest,
  decryptAuthMailEnvelope,
  encryptAuthMailEnvelope,
  resetAuthMailKeyCacheForTests,
} from './auth-mail-crypto';

describe('auth-mail encrypted outbox envelope', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MAIL_OUTBOX_KEY = '11'.repeat(32);
    process.env.AUTH_MAIL_OUTBOX_KEY_V1 = '11'.repeat(32);
    process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION = '1';
    delete process.env.AUTH_MAIL_OUTBOX_KEYRING_DIR;
    delete process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE;
    resetAuthMailKeyCacheForTests();
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
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
    expect(encrypted.keyVersion).toBe(1);
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

  it('uses a deterministic keyed replay digest while ciphertext remains randomized', () => {
    const context = {
      kind: 'PUBLIC_INQUIRY',
      idempotencyKey: 'auth-mail:public-inquiry:test:1',
      correlationId: 'corr-public-1',
    };
    const envelope = { to: 'access@example.com', subject: 'Inquiry', text: 'Sensitive contact body' };
    const one = encryptAuthMailEnvelope(envelope, context);
    const two = encryptAuthMailEnvelope(envelope, context);
    expect(one.ciphertext).not.toBe(two.ciphertext);
    expect(one.iv).not.toBe(two.iv);
    expect(authMailReplayDigest(envelope, context)).toBe(authMailReplayDigest(envelope, context));
    expect(authMailReplayDigest({ ...envelope, text: 'Different body' }, context))
      .not.toBe(authMailReplayDigest(envelope, context));
  });

  it('keeps old key versions decryptable after a current-key rotation', () => {
    const context = {
      kind: 'MFA_RECOVERY',
      idempotencyKey: 'auth-mail:mfa-recovery:test:1',
      correlationId: 'corr-key-rotation',
    };
    const envelope = { to: 'person@example.com', subject: 'Recovery', text: 'token=mr_secret' };
    const v1 = encryptAuthMailEnvelope(envelope, context);

    process.env.AUTH_MAIL_OUTBOX_KEY_V2 = '22'.repeat(32);
    process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION = '2';
    resetAuthMailKeyCacheForTests();
    const v2 = encryptAuthMailEnvelope(envelope, { ...context, correlationId: 'corr-key-rotation-v2' });

    expect(v1.keyVersion).toBe(1);
    expect(v2.keyVersion).toBe(2);
    expect(decryptAuthMailEnvelope(v1, context)).toEqual(envelope);
    expect(decryptAuthMailEnvelope(v2, { ...context, correlationId: 'corr-key-rotation-v2' })).toEqual(envelope);
  });

  it('rejects environment-carried key material in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_MAIL_OUTBOX_KEY = '22'.repeat(32);
    process.env.AUTH_MAIL_OUTBOX_KEY_V1 = '22'.repeat(32);
    delete process.env.AUTH_MAIL_OUTBOX_KEYRING_DIR;
    delete process.env.AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE;
    resetAuthMailKeyCacheForTests();

    expect(() => encryptAuthMailEnvelope({
      to: 'person@example.com',
      subject: 'Subject',
      text: 'Body',
    }, {
      kind: 'ACCOUNT_SECURITY_NOTICE',
      idempotencyKey: 'auth-mail:security:test:1',
      correlationId: 'corr-test-3',
    })).toThrow(/CURRENT_KEY_VERSION_FILE is required/);
  });
});
