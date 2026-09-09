import { createHmac, hkdfSync } from 'crypto';

/**
 * The cursor key must not be the session-signing secret.
 *
 * Before #4790 it was, whenever DEAL_REGISTRY_CURSOR_SECRET was unset: the
 * cursor HMAC'd with JWT_SECRET directly. Nothing was forgeable across the two,
 * but only because a JWT signs `header.payload` - which contains a dot - and a
 * cursor signs a single base64url string, which cannot. That is a property of
 * the message formats, not of the keys, and it stops holding the first time
 * either format changes.
 *
 * These cases assert the separation itself, so it no longer depends on that
 * coincidence.
 */

const MASTER = 'a-master-secret-long-enough-to-pass-the-length-floor';

function loadModule() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('./deal-registry-query.service') as typeof import('./deal-registry-query.service');
}

describe('deal registry cursor key separation (#4790)', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('never signs with the master material itself', () => {
    process.env.JWT_SECRET = MASTER;
    delete process.env.DEAL_REGISTRY_CURSOR_SECRET;
    const { cursorSigningKey } = loadModule();
    expect(cursorSigningKey().equals(Buffer.from(MASTER, 'utf8'))).toBe(false);
  });

  it('derives under its own label, so the key differs from every other contour', () => {
    process.env.JWT_SECRET = MASTER;
    delete process.env.DEAL_REGISTRY_CURSOR_SECRET;
    const { cursorSigningKey } = loadModule();

    const expected = Buffer.from(
      hkdfSync('sha256', MASTER, 'pc-deal-registry-cursor-salt', 'pc-deal-registry-cursor:v1', 32),
    );
    expect(cursorSigningKey().equals(expected)).toBe(true);

    // The opaque token authority derives from the same master under its own
    // label. Both keys existing is fine; them being equal would not be.
    const authority = Buffer.from(
      hkdfSync('sha256', MASTER, 'pc-auth-opaque-token-digest-salt', 'pc-auth-opaque-token-digest:v1', 32),
    );
    expect(cursorSigningKey().equals(authority)).toBe(false);
  });

  it('a signature made with the raw master no longer verifies as a cursor signature', () => {
    process.env.JWT_SECRET = MASTER;
    delete process.env.DEAL_REGISTRY_CURSOR_SECRET;
    const { cursorSigningKey } = loadModule();

    const message = 'eyJ2IjoxfQ';
    const underMaster = createHmac('sha256', MASTER).update(message).digest('base64url');
    const underDerived = createHmac('sha256', cursorSigningKey()).update(message).digest('base64url');
    expect(underDerived).not.toBe(underMaster);
  });

  // The three cases above prove the derivation. They do not prove the signer
  // uses it: a `signCursor` that reached for the master material directly would
  // leave every one of them green while restoring exactly the defect #4790 is
  // about. These two bind the signature itself to the derived key.

  it('signs cursors with the derived key, not merely deriving one alongside', () => {
    process.env.JWT_SECRET = MASTER;
    delete process.env.DEAL_REGISTRY_CURSOR_SECRET;
    const { signCursor, cursorSigningKey } = loadModule();

    const message = 'eyJ2IjoxfQ';
    const underDerived = createHmac('sha256', cursorSigningKey()).update(message).digest('base64url');
    expect(signCursor(message)).toBe(underDerived);
  });

  it('does not sign cursors with the master material', () => {
    process.env.JWT_SECRET = MASTER;
    delete process.env.DEAL_REGISTRY_CURSOR_SECRET;
    const { signCursor } = loadModule();

    const message = 'eyJ2IjoxfQ';
    const underMaster = createHmac('sha256', MASTER).update(message).digest('base64url');
    expect(signCursor(message)).not.toBe(underMaster);
  });

  it('still prefers a dedicated secret, and separates that one too', () => {
    process.env.JWT_SECRET = MASTER;
    process.env.DEAL_REGISTRY_CURSOR_SECRET = 'a-dedicated-cursor-secret-of-sufficient-length';
    const { cursorSigningKey } = loadModule();

    const fromDedicated = Buffer.from(
      hkdfSync('sha256', 'a-dedicated-cursor-secret-of-sufficient-length',
        'pc-deal-registry-cursor-salt', 'pc-deal-registry-cursor:v1', 32),
    );
    expect(cursorSigningKey().equals(fromDedicated)).toBe(true);
    expect(cursorSigningKey().equals(Buffer.from('a-dedicated-cursor-secret-of-sufficient-length', 'utf8'))).toBe(false);
  });

  it('refuses to sign at all when no material of sufficient length is configured', () => {
    delete process.env.JWT_SECRET;
    delete process.env.DEAL_REGISTRY_CURSOR_SECRET;
    const { cursorSigningKey } = loadModule();
    expect(() => cursorSigningKey()).toThrow();

    process.env.JWT_SECRET = 'too-short';
    const again = loadModule();
    expect(() => again.cursorSigningKey()).toThrow();
  });
});
