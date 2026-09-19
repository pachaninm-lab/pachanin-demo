import {
  issuePasswordResetToken,
  parsePasswordResetToken,
  passwordResetHashMatches,
} from './password-reset-token';

describe('password reset token', () => {
  it('issues an opaque token and verifies only its keyed hash', () => {
    const issued = issuePasswordResetToken();
    const parsed = parsePasswordResetToken(issued.token);

    expect(issued.token).toMatch(/^pr_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(parsed?.id).toBe(issued.id);
    expect(parsed?.hash).toBe(issued.hash);
    expect(passwordResetHashMatches(issued.hash, parsed?.hash ?? '')).toBe(true);
    expect(issued.hash).not.toContain(issued.token);
  });

  it('rejects malformed and tampered tokens', () => {
    const issued = issuePasswordResetToken();
    const [id, secret] = issued.token.split('.');

    expect(parsePasswordResetToken('')).toBeNull();
    expect(parsePasswordResetToken(`rt_${id}.${secret}`)).toBeNull();
    expect(parsePasswordResetToken(`${id}.short`)).toBeNull();

    const tampered = parsePasswordResetToken(`${id}.${secret}x`);
    expect(tampered).not.toBeNull();
    expect(passwordResetHashMatches(issued.hash, tampered?.hash ?? '')).toBe(false);
  });
});
