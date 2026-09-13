import { scanForForbiddenFields } from './response-field-guard.interceptor';

describe('scanForForbiddenFields', () => {
  it('passes a response that carries nothing forbidden', () => {
    expect(scanForForbiddenFields({ id: 1, email: 'a@b.c', nested: [{ ok: true }] })).toEqual({ outcome: 'clean' });
    expect(scanForForbiddenFields(null)).toEqual({ outcome: 'clean' });
    expect(scanForForbiddenFields('a string')).toEqual({ outcome: 'clean' });
  });

  it('finds a forbidden field and reports where it was, never the value', () => {
    const result = scanForForbiddenFields({ user: { id: 1, passwordHash: 'argon2id$secret' } });
    expect(result).toEqual({ outcome: 'forbidden', field: 'passwordHash', path: '$.user.passwordHash' });
    expect(JSON.stringify(result)).not.toContain('argon2id');
  });

  it('finds it under snake_case and under a different case, the way a raw row would arrive', () => {
    expect(scanForForbiddenFields({ password_hash: 'x' })).toMatchObject({ outcome: 'forbidden', field: 'password_hash' });
    expect(scanForForbiddenFields({ MFA_Secret: 'x' })).toMatchObject({ outcome: 'forbidden', field: 'MFA_Secret' });
    expect(scanForForbiddenFields({ mfa_secret_ciphertext: 'x' })).toMatchObject({ outcome: 'forbidden' });
  });

  it('finds it inside an array, which is how a list endpoint would leak it', () => {
    const result = scanForForbiddenFields([{ id: 1 }, { id: 2, mfaSecret: 'x' }]);
    expect(result).toMatchObject({ outcome: 'forbidden', field: 'mfaSecret', path: '$[1].mfaSecret' });
  });

  it('does not flag a field that merely contains a forbidden name', () => {
    expect(scanForForbiddenFields({ passwordHashAlgorithm: 'argon2id', hasPassword: true })).toEqual({ outcome: 'clean' });
  });

  /** A response is attacker-influenced in size and shape. */
  it('reports rather than clears a body it could not finish walking', () => {
    let deep: Record<string, unknown> = { end: true };
    for (let level = 0; level < 40; level += 1) deep = { next: deep };
    expect(scanForForbiddenFields(deep)).toMatchObject({ outcome: 'unbounded' });
  });

  it('survives a cycle instead of hanging on it', () => {
    const node: Record<string, unknown> = { id: 1 };
    node.self = node;
    expect(scanForForbiddenFields(node)).toEqual({ outcome: 'clean' });
  });

  it('takes the forbidden list as a parameter, so a caller can prove it is the list that matters', () => {
    expect(scanForForbiddenFields({ custom: 'x' }, ['custom'])).toMatchObject({ outcome: 'forbidden', field: 'custom' });
    expect(scanForForbiddenFields({ passwordHash: 'x' }, ['somethingelse'])).toEqual({ outcome: 'clean' });
  });

  /**
   * The built-in list is already lowercase, so normalising it looks redundant and
   * is not: a caller passing a name with capitals would otherwise be ignored, and
   * the guard would quietly enforce a shorter list than it was given.
   */
  it('normalises the list it is given, not only the keys it inspects', () => {
    expect(scanForForbiddenFields({ sessionsecret: 'x' }, ['SessionSecret'])).toMatchObject({ outcome: 'forbidden' });
  });
});
