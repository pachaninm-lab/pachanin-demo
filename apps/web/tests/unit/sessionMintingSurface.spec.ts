import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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


const mocks = vi.hoisted(() => ({
  cookie: vi.fn(),
  csrf: vi.fn(() => ({ ok: true })),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock('../../lib/server-request-security', () => ({
  assertCsrf: mocks.csrf, generateCsrfToken: () => 'test-csrf',
}));

function request(body: unknown = {}) {
  return new Request('https://app.example.test/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('API_URL', 'https://api.example.test/api');
  vi.stubEnv('JWT_SECRET', 'unit-password-login-signing-key-long-enough');
  mocks.csrf.mockReturnValue({ ok: true });
  mocks.cookie.mockImplementation((name: string) => name === 'pc_access_token'
    ? { value: 'server-access-token' } : name === 'pc_mfa_step_up' ? { value: 'mc_bound-challenge-token-long-enough-for-verification' } : undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('password login and explicit authenticated MFA', () => {
  it('issues real signed cabinet cookies directly from a complete password session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'server-access-token', refreshToken: 'server-refresh-token', mfaRequired: false,
      user: { id: 'user-a', email: 'a@example.test', role: 'ACCOUNTING', orgId: 'org-a',
        tenantId: 'tenant-a', membershipId: 'membership-a', mfaVerified: false },
    }), { status: 200 })));
    const { POST } = await import('../../app/api/auth/login/route');
    const response = await POST(request({ email: 'a@example.test', password: 'unit-password' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, mfaRequired: false, redirectTo: '/platform-v7/bank' });
    expect(response.cookies.get('pc_access_token')?.value).toBe('server-access-token');
    expect(response.cookies.get('pc_v7_cabinet')?.value).toBeTruthy();
    expect(response.cookies.get('pc_mfa_pending')?.value || '').toBe('');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('does not issue a cabinet session from an incomplete API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      mfaRequired: false, accessToken: 'server-access-token', refreshToken: 'server-refresh-token',
      user: { id: 'user-a', email: 'a@example.test', role: 'ACCOUNTING' },
    }), { status: 200 })));
    const { POST } = await import('../../app/api/auth/login/route');
    const response = await POST(request({ email: 'a@example.test', password: 'unit-password' }));
    expect(response.status).toBe(502);
    expect(response.cookies.get('pc_v7_cabinet')).toBeUndefined();
  });

  it('reveals setup material only from an authenticated explicit enrollment response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, enrollmentRequired: true, setupSecret: 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU',
      otpAuthUri: 'otpauth://totp/unit?secret=KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU',
      challengeToken: 'mc_bound-challenge-token-long-enough-for-verification',
    }), { status: 200 })));
    const { POST } = await import('../../app/api/auth/mfa-step-up/start/route');
    const response = await POST(request());
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ enrollmentRequired: true, methods: ['totp'], setupSecret: expect.any(String) });
    expect(payload).not.toHaveProperty('challengeToken');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[1]?.headers).toMatchObject({ Authorization: 'Bearer server-access-token' });
  });

  it('cannot start enrollment without an authenticated access cookie', async () => {
    mocks.cookie.mockReturnValue(undefined);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../../app/api/auth/mfa-step-up/start/route');
    expect((await POST(request())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});


describe('password-session staff landing contract', () => {
  it('accepts own identity labels without converting them into capability grants', async () => {
    const { parseStaffHomeContract } = await import('../../lib/platform-v7/staff-capabilities');
    const home = { identity: { id: 'owner', email: 'owner@example.test', fullName: null },
      assignments: [{ id: 'own', role: 'PLATFORM_OWNER', status: 'ACTIVE', validFrom: '2026-10-05T00:00:00Z', validUntil: null }],
      authenticationAssurance: { mfaVerified: false } };
    expect(parseStaffHomeContract(home)?.authenticationAssurance.mfaVerified).toBe(false);
    expect(parseStaffHomeContract({ ...home, capabilities: ['STAFF_REQUEST_APPROVE'] })).toBeNull();
    expect(parseStaffHomeContract({ ...home, assignments: [{ ...home.assignments[0], status: 'ELIGIBLE' }] })).toBeNull();
  });
});
