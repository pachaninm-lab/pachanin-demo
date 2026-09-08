import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_AUDIENCE,
  FIXTURE_TOKEN_TYPE,
  fixtureTokenIsForService,
  type FixtureAudience,
} from '@/lib/platform-v7/fixture-token';

/**
 * ASVS 5.0 V9.2.3: a service accepts only tokens intended for it.
 *
 * The fixture contour had four consumers and one undifferentiated credential.
 * Each verified the signature and admitted the token on testAccess - true of
 * every fixture token, so a token minted for any one of the four was accepted
 * by the other three. These cases present each service's token to each other
 * service and require a refusal every time, which is the property the flag
 * could not express.
 */

const SERVICES: ReadonlyArray<readonly [string, FixtureAudience]> = [
  ['identity probe (/auth/me)', FIXTURE_AUDIENCE.identityProbe],
  ['staff proxy (/staff/[...path])', FIXTURE_AUDIENCE.staffProxy],
  ['staff page', FIXTURE_AUDIENCE.staffPage],
  ['owner cabinet open', FIXTURE_AUDIENCE.ownerCabinet],
];

/** Claims as a correctly issued fixture token carries them. */
function fixtureClaims(audience: string, extra: Record<string, unknown> = {}) {
  return {
    typ: FIXTURE_TOKEN_TYPE,
    aud: audience,
    testAccess: true,
    owner: true,
    sub: 'owner-fixture',
    email: 'owner@example.test',
    role: 'SUPPORT_MANAGER',
    exp: Math.floor(Date.now() / 1000) + 900,
    ...extra,
  };
}

function repoRoot(): string {
  let dir = __dirname;
  while (!existsSync(join(dir, '.git')) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

describe('a fixture token is accepted only by the service it was issued for', () => {
  it('accepts its own service', () => {
    for (const [name, audience] of SERVICES) {
      expect(fixtureTokenIsForService(fixtureClaims(audience), audience), name).toBe(true);
    }
  });

  it('refuses every other service — the whole replay matrix, not one direction', () => {
    for (const [issuedFor, issuedAudience] of SERVICES) {
      for (const [presentedTo, presentedAudience] of SERVICES) {
        if (issuedAudience === presentedAudience) continue;
        expect(
          fixtureTokenIsForService(fixtureClaims(issuedAudience), presentedAudience),
          `a token for ${issuedFor} must not be accepted by ${presentedTo}`,
        ).toBe(false);
      }
    }
  });

  it('refuses a token with no audience at all', () => {
    for (const [name, audience] of SERVICES) {
      const { aud, ...withoutAudience } = fixtureClaims(audience);
      expect(fixtureTokenIsForService(withoutAudience, audience), name).toBe(false);
    }
  });

  it('refuses an audience that names nothing in this contour', () => {
    for (const [name, audience] of SERVICES) {
      expect(fixtureTokenIsForService(fixtureClaims('pc-fixture-somewhere-else'), audience), name).toBe(false);
      expect(fixtureTokenIsForService(fixtureClaims(''), audience), name).toBe(false);
    }
  });

  it('refuses the right audience carried by the wrong type', () => {
    for (const [name, audience] of SERVICES) {
      for (const typ of ['access', 'cabinet', undefined, '']) {
        expect(
          fixtureTokenIsForService({ ...fixtureClaims(audience), typ }, audience),
          `${name} with typ=${String(typ)}`,
        ).toBe(false);
      }
    }
  });

  it('accepts the list form of aud, and only when it names this service', () => {
    const [, audience] = SERVICES[0];
    const other = SERVICES[1][1];
    expect(fixtureTokenIsForService(fixtureClaims([audience, other] as never), audience)).toBe(true);
    expect(fixtureTokenIsForService(fixtureClaims([other] as never), audience)).toBe(false);
    expect(fixtureTokenIsForService(fixtureClaims([] as never), audience)).toBe(false);
  });

  it('refuses absent claims rather than treating them as unconstrained', () => {
    const [, audience] = SERVICES[0];
    expect(fixtureTokenIsForService(null, audience)).toBe(false);
    expect(fixtureTokenIsForService(undefined, audience)).toBe(false);
    expect(fixtureTokenIsForService({}, audience)).toBe(false);
  });
});

describe('the wrong algorithm never reaches the audience check', () => {
  /**
   * Algorithm and signature are the caller's job - each surface resolves its own
   * secret - so this asserts the arrangement rather than re-testing the crypto:
   * every consumer still goes through the shared verifier, which refuses any
   * header algorithm other than HS256 before checking a signature, and the
   * audience decision runs on what that verifier returned.
   */
  it('every fixture consumer verifies through the shared HS256 verifier first', () => {
    const root = repoRoot();
    const consumers = execFileSync('git', ['ls-files', 'apps/web'], { encoding: 'utf8', cwd: root })
      .split('\n')
      .filter((path) => /\.tsx?$/u.test(path))
      .filter((path) => !/\.(?:spec|test)\.tsx?$/u.test(path) && !path.includes('/tests/'))
      .filter((path) => readFileSync(join(root, path), 'utf8').includes('fixtureTokenIsForService'))
      .filter((path) => !path.endsWith('fixture-token.ts'));

    expect(consumers.length).toBe(4);
    for (const path of consumers) {
      const source = readFileSync(join(root, path), 'utf8');
      expect(source, path).toContain('verifyHs256Jwt');
    }
    const verifier = readFileSync(join(root, 'apps/web/lib/platform-v7/verified-session.ts'), 'utf8');
    expect(verifier).toContain("header.alg !== 'HS256'");
  });

  it('each consumer names a different audience, so none can inherit another', () => {
    const root = repoRoot();
    const used = new Set<string>();
    for (const [, audience] of SERVICES) used.add(audience);
    expect(used.size).toBe(SERVICES.length);

    const sources = execFileSync('git', ['ls-files', 'apps/web/app'], { encoding: 'utf8', cwd: root })
      .split('\n')
      .filter((path) => /\.tsx?$/u.test(path))
      .map((path) => readFileSync(join(root, path), 'utf8'))
      .filter((source) => source.includes('fixtureTokenIsForService'));

    const named = sources.map((source) => {
      const match = /FIXTURE_AUDIENCE\.(\w+)/u.exec(source);
      return match?.[1] ?? null;
    });
    expect(named.filter(Boolean)).toHaveLength(4);
    expect(new Set(named).size).toBe(4);
  });
});
