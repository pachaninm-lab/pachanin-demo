import {
  deriveRegistrationStatusToken,
  hashRegistrationStatusToken,
  issueRegistrationEmailToken,
  parseRegistrationEmailToken,
  registrationTokenHashMatches,
} from './registration-token';

describe('registration tokens', () => {
  it('stores only the email verification token hash', () => {
    const issued = issueRegistrationEmailToken();
    const parsed = parseRegistrationEmailToken(issued.token);

    expect(issued.token).toMatch(/^rev_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(parsed?.id).toBe(issued.id);
    expect(parsed?.hash).toBe(issued.hash);
    expect(registrationTokenHashMatches(issued.hash, parsed?.hash ?? '')).toBe(true);
    expect(issued.hash).not.toContain(issued.token);
  });

  it('derives an opaque status token without granting authentication authority', () => {
    const token = deriveRegistrationStatusToken('reg_application', 'idempotency-key-123456789');
    const hash = hashRegistrationStatusToken(token);

    // The stored form is versioned: `v1:<base64url>` from the opaque token
    // authority, not a bare keyed hash. The version prefix is what lets a
    // future scheme be rejected rather than silently accepted.
    expect(token).toMatch(/^rst_reg_application\.v1:[A-Za-z0-9_-]+$/);
    expect(hash).toMatch(/^v1:[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain(token);
  });

  it('rejects tampered email verification tokens', () => {
    const issued = issueRegistrationEmailToken();
    const tampered = parseRegistrationEmailToken(`${issued.token}x`);
    expect(tampered).not.toBeNull();
    expect(registrationTokenHashMatches(issued.hash, tampered?.hash ?? '')).toBe(false);
  });
});
