import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  CABINET_TOKEN_AUDIENCE,
  CABINET_TOKEN_TYPE,
  readVerifiedCabinetRole,
  readVerifiedCabinetSessionContext,
  signCabinetSession,
} from '@/lib/platform-v7/verified-session';

/**
 * ASVS V9.1.2, V9.2.2 and V9.2.3 are one property from three angles: a service
 * must accept a self-contained token only under a stated algorithm, only of the
 * type it expects, and only when it is the intended audience.
 *
 * The cabinet session and the API access token are both HS256 under the same
 * JWT_SECRET, so a valid signature proves the platform minted the token and
 * nothing about what for. They used to be separated by which claim each
 * happened to carry. These cases prove the separation is now checked, by
 * presenting each token to the reader built for the other one.
 */

const SECRET = 'test-secret-value-for-purpose-binding-cases';
const NOW = 1_800_000_000;

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/** An HS256 token minted outside the module, so the reader is what is tested. */
function mintHs256(payload: Record<string, unknown>, secret = SECRET): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  // Node's crypto is available in this environment; the module under test uses
  // WebCrypto, and the two must agree or nothing here would verify at all.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHmac } = require('crypto') as typeof import('crypto');
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function accessToken(extra: Record<string, unknown> = {}): string {
  return mintHs256({
    typ: 'access',
    iss: 'transparent-price-api',
    aud: 'transparent-price-platform',
    sub: 'user-1',
    sid: 'ses-1',
    exp: NOW + 900,
    ...extra,
  });
}

function repoRoot(): string {
  let dir = __dirname;
  while (!existsSync(join(dir, '.git')) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

describe('cabinet session tokens are bound to their purpose', () => {
  it('carries a type and an audience, not only a role', async () => {
    const token = await signCabinetSession('buyer', SECRET, { nowSeconds: NOW, ttlSeconds: 3600 });
    expect(token).not.toBeNull();
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    expect(payload.typ).toBe(CABINET_TOKEN_TYPE);
    expect(payload.aud).toBe(CABINET_TOKEN_AUDIENCE);
    expect(payload.cab).toBe('buyer');
  });

  it('verifies a token it minted itself', async () => {
    const token = await signCabinetSession('buyer', SECRET, { nowSeconds: NOW, ttlSeconds: 3600 });
    const context = await readVerifiedCabinetSessionContext(token, SECRET, NOW);
    expect(context?.role).toBe('buyer');
  });

  it('refuses a validly signed token minted for another purpose', async () => {
    // Same secret, same algorithm, a real cabinet role - and still refused,
    // because it was not issued as a cabinet session.
    const wrongPurpose = mintHs256({ cab: 'buyer', exp: NOW + 3600 });
    expect(await readVerifiedCabinetSessionContext(wrongPurpose, SECRET, NOW)).toBeNull();

    const wrongAudience = mintHs256({
      typ: CABINET_TOKEN_TYPE, aud: 'somewhere-else', cab: 'buyer', exp: NOW + 3600,
    });
    expect(await readVerifiedCabinetSessionContext(wrongAudience, SECRET, NOW)).toBeNull();
  });

  it('refuses a token carrying the right audience but not the right type', async () => {
    // The audience check alone would let this through, so this is the case that
    // holds the type check in place; without it the two are indistinguishable.
    const noType = mintHs256({ aud: CABINET_TOKEN_AUDIENCE, cab: 'buyer', exp: NOW + 3600 });
    expect(await readVerifiedCabinetSessionContext(noType, SECRET, NOW)).toBeNull();

    const wrongType = mintHs256({
      typ: 'access', aud: CABINET_TOKEN_AUDIENCE, cab: 'buyer', exp: NOW + 3600,
    });
    expect(await readVerifiedCabinetSessionContext(wrongType, SECRET, NOW)).toBeNull();
  });

  it('refuses a token carrying the right type but the wrong issuer path', async () => {
    // Symmetric case for the access-token reader: correct type, wrong issuer.
    expect(await readVerifiedCabinetRole(
      mintHs256({ typ: 'access', iss: 'not-the-api', aud: 'transparent-price-platform', role: 'BUYER', exp: NOW + 900 }),
      SECRET, NOW,
    )).toBeNull();
  });

  it('refuses an API access token presented as a cabinet session', async () => {
    expect(await readVerifiedCabinetSessionContext(accessToken({ cab: 'buyer' }), SECRET, NOW)).toBeNull();
  });
});

describe('the access-token reader accepts only API access tokens', () => {
  it('refuses a cabinet session presented as an access token', async () => {
    const cabinet = await signCabinetSession('buyer', SECRET, {
      nowSeconds: NOW, ttlSeconds: 3600,
    });
    expect(await readVerifiedCabinetRole(cabinet, SECRET, NOW)).toBeNull();
  });

  it('refuses a validly signed token with no type, issuer or audience', async () => {
    // This is the shape that used to be accepted: signature valid, role claim
    // present, nothing saying who minted it or what for.
    expect(await readVerifiedCabinetRole(mintHs256({ role: 'BUYER', exp: NOW + 3600 }), SECRET, NOW)).toBeNull();
  });

  it('refuses an access token minted for another issuer or audience', async () => {
    expect(await readVerifiedCabinetRole(
      accessToken({ role: 'BUYER', iss: 'someone-else' }), SECRET, NOW,
    )).toBeNull();
    expect(await readVerifiedCabinetRole(
      accessToken({ role: 'BUYER', aud: 'someone-else' }), SECRET, NOW,
    )).toBeNull();
  });

  it('accepts a well-formed access token, including a list-valued audience', async () => {
    expect(await readVerifiedCabinetRole(accessToken({ role: 'BUYER' }), SECRET, NOW)).toBe('buyer');
    expect(await readVerifiedCabinetRole(
      accessToken({ role: 'BUYER', aud: ['transparent-price-platform', 'other'] }), SECRET, NOW,
    )).toBe('buyer');
  });

  it('still refuses a token signed with a different secret', async () => {
    expect(await readVerifiedCabinetRole(
      mintHs256({ typ: 'access', iss: 'transparent-price-api', aud: 'transparent-price-platform', role: 'BUYER', exp: NOW + 900 }, 'another-secret-entirely'),
      SECRET,
      NOW,
    )).toBeNull();
  });
});

describe('the web restates the API contract without drifting from it', () => {
  const apiSource = readFileSync(
    join(repoRoot(), 'apps/api/src/modules/auth/access-token.ts'), 'utf8',
  );

  it('names the same issuer, audience and type the API signs', () => {
    expect(apiSource).toContain("ACCESS_ISSUER = 'transparent-price-api'");
    expect(apiSource).toContain("ACCESS_AUDIENCE = 'transparent-price-platform'");
    expect(apiSource).toMatch(/typ:\s*'access'/);
  });

  it('pins the signing and verifying algorithm on the API side (V9.1.2)', () => {
    expect(apiSource).toContain("ACCESS_TOKEN_ALGORITHM = 'HS256'");
    expect(apiSource).toMatch(/algorithm:\s*ACCESS_TOKEN_ALGORITHM/);
    expect(apiSource).toMatch(/algorithms:\s*\[ACCESS_TOKEN_ALGORITHM\]/);
  });
});

describe('every place that verifies an HS256 token checks a purpose claim', () => {
  /**
   * verifyHs256Jwt proves the platform minted a token and nothing more. It is
   * deliberately generic, because the fixture contour and the cabinet contour
   * carry different claims - so the purpose check belongs at each consumer, and
   * a consumer that forgets it accepts anything signed with JWT_SECRET.
   *
   * This enumerates the callers rather than trusting that the four known ones
   * are still the only four.
   */
  const PURPOSE_CLAIMS = [
    'CABINET_TOKEN_TYPE',
    'API_ACCESS_TOKEN_TYPE',
    'testAccess',
    'tokenType',
    "payload.type !== 'access'",
  ];

  function callersOf(): string[] {
    const root = repoRoot();
    const tracked = execFileSync('git', ['ls-files', 'apps/web'], { encoding: 'utf8', cwd: root })
      .split('\n')
      .filter((path) => /\.tsx?$/u.test(path))
      .filter((path) => !/\.(?:spec|test)\.tsx?$/u.test(path) && !path.includes('/tests/'));
    return tracked.filter((path) => {
      const source = readFileSync(join(root, path), 'utf8');
      // server-request-actor.ts declares its own verifier under a different
      // secret; it is included deliberately, because the property is about
      // anything that verifies a token, not only about one helper's callers.
      return /\bverifyHs256Jwt\s*\(/u.test(source) && !path.endsWith('verified-session.ts');
    });
  }

  it('leaves no caller accepting a token on its signature alone', () => {
    const root = repoRoot();
    const unchecked = callersOf().filter((path) => {
      const source = readFileSync(join(root, path), 'utf8');
      return !PURPOSE_CLAIMS.some((claim) => source.includes(claim));
    });
    expect(unchecked).toEqual([]);
  });

  it('is actually finding callers, so an empty result cannot pass by accident', () => {
    expect(callersOf().length).toBeGreaterThanOrEqual(4);
  });
});

describe('the commercial-surface actor refuses a token that omits its type', () => {
  /**
   * This verifier accepted a token whose `type` claim was simply absent: the
   * check ran only when the token volunteered something to check. Absence is a
   * refusal now, so a signed token that never said what it was for cannot
   * become an authenticated actor.
   */
  const ACTOR_SECRET = 'test-access-secret';

  function actorRequest(payload: Record<string, unknown>): Request {
    const token = mintHs256(payload, ACTOR_SECRET);
    return new Request('https://example.test/', { headers: { authorization: `Bearer ${token}` } });
  }

  it('refuses a validly signed token with no type claim', async () => {
    const { getServerRequestActor } = await import('@/lib/server-request-actor');
    const actor = await getServerRequestActor(actorRequest({
      sub: 'user-1', role: 'BUYER', exp: Math.floor(Date.now() / 1000) + 900,
    }));
    expect(actor.isAuthenticated).toBe(false);
    expect(actor.surfaceRole).toBe('GUEST');
  });

  it('still accepts a token that says it is an access token', async () => {
    const { getServerRequestActor } = await import('@/lib/server-request-actor');
    const actor = await getServerRequestActor(actorRequest({
      type: 'access', sub: 'user-1', role: 'BUYER', exp: Math.floor(Date.now() / 1000) + 900,
    }));
    expect(actor.isAuthenticated).toBe(true);
  });
});
