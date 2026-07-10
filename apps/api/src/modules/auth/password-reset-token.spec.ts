import {
  issuePasswordResetToken,
  PASSWORD_RESET_TTL_SECONDS,
  verifyPasswordResetToken,
} from './password-reset-token';

const env = {
  PASSWORD_RESET_TOKEN_SECRET: 'test-password-reset-secret-with-more-than-thirty-two-characters',
} as NodeJS.ProcessEnv;

describe('password reset token codec', () => {
  it('issues a bounded signed token', () => {
    const token = issuePasswordResetToken('challenge-1', 'user-1', 1_000, env);
    const payload = verifyPasswordResetToken(token, 1_001, env);

    expect(payload).toMatchObject({
      v: 1,
      cid: 'challenge-1',
      sub: 'user-1',
      iat: 1_000,
      exp: 1_000 + PASSWORD_RESET_TTL_SECONDS,
    });
    expect(payload?.nonce.length).toBeGreaterThanOrEqual(20);
  });

  it('rejects tampering', () => {
    const token = issuePasswordResetToken('challenge-1', 'user-1', 1_000, env);
    const [payload, signature] = token.split('.');
    const tampered = `${payload.slice(0, -1)}A.${signature}`;

    expect(verifyPasswordResetToken(tampered, 1_001, env)).toBeNull();
  });

  it('rejects expired and wrong-secret tokens', () => {
    const token = issuePasswordResetToken('challenge-1', 'user-1', 1_000, env);

    expect(verifyPasswordResetToken(token, 1_000 + PASSWORD_RESET_TTL_SECONDS, env)).toBeNull();
    expect(verifyPasswordResetToken(token, 1_001, {
      PASSWORD_RESET_TOKEN_SECRET: 'different-secret-with-more-than-thirty-two-characters',
    } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('fails closed when the secret is missing or weak', () => {
    expect(() => issuePasswordResetToken('challenge-1', 'user-1', 1_000, {})).toThrow();
    expect(verifyPasswordResetToken('invalid.token', 1_001, {})).toBeNull();
  });
});
