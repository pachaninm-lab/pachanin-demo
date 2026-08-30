import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ASVS V6.1.3 / V6.3.4, and the concrete defect behind them (#4690).
 *
 * /api/auth/sber-business/callback paired a stubbed server half - the API
 * returns status: 'not_configured' and no token - with a completed, trusting
 * web half. It set the access, refresh, session and CSRF cookies from whatever
 * payload came back, validating no state parameter and taking no MFA step. It
 * was inert only because the other half never returned a token.
 *
 * It also bypassed every identity check the canonical path makes.
 * applyAuthenticatedSession refuses to mint anything unless role, user id,
 * organization, tenant and membership are all present, bounds the lifetime, and
 * signs a separate cabinet token; the callback checked none of that and wrote
 * the session marker as the literal '1' rather than the structured value the
 * rest of the app reads. It was not a second working pathway, it was a broken
 * one waiting for its other half.
 *
 * What is asserted here is the property that made it dangerous, not just its
 * absence: a session is minted from an upstream payload in exactly one place.
 */

/** Located by walking up to the working tree root, so the scan does not depend on where vitest was invoked from. */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, '.git'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('repository root not found from ' + process.cwd());
}

const REPO_ROOT = repoRoot();
const CANONICAL = 'apps/web/lib/server/auth-session-response.ts';
const SELF = 'apps/web/tests/unit/sessionMintingSurface.spec.ts';

function trackedWebSources(): string[] {
  const out = execFileSync('git', ['ls-files', 'apps/web/app', 'apps/web/lib'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const files = out.split('\n').filter((line) => /\.tsx?$/u.test(line) && line !== SELF);
  // A scan that silently found nothing would satisfy every assertion below.
  expect(files.length).toBeGreaterThan(100);
  return files;
}

function filesMatching(pattern: RegExp): string[] {
  return trackedWebSources().filter((file) => pattern.test(readFileSync(join(REPO_ROOT, file), 'utf8')));
}

describe('session minting surface (#4690)', () => {
  it('mints a session from an upstream payload in exactly one place', () => {
    expect(filesMatching(/set\(\s*ACCESS_COOKIE\s*,\s*payload/u)).toEqual([CANONICAL]);
    expect(filesMatching(/set\(\s*REFRESH_COOKIE\s*,\s*payload/u)).toEqual([CANONICAL]);
  });

  it('has no sber-business auth route left to mint one', () => {
    expect(filesMatching(/sber-business/u)).toEqual([]);
  });

  it('leaves no route writing the session marker as a bare truthy literal', () => {
    // The canonical marker carries role, exp and email. '1' is what the removed
    // callback wrote, and nothing downstream can read a role out of it.
    expect(filesMatching(/set\(\s*SESSION_COOKIE\s*,\s*['"`]1['"`]/u)).toEqual([]);
  });

  it('still has the canonical helper, and it still fails closed on an incomplete identity', () => {
    const canonical = readFileSync(join(REPO_ROOT, CANONICAL), 'utf8');
    for (const guard of ['payload.user.id', 'payload.user.orgId', 'payload.user.tenantId', 'payload.user.membershipId']) {
      expect(canonical).toContain(guard);
    }
    expect(canonical).toMatch(/\)\s*return null;/u);
  });
});
