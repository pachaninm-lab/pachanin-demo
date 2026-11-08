// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CSRF_COOKIE } from '@/lib/auth-cookies';
import { classifyUpstreamLoginFailure, POST_PROOF_ACCESS_DENIALS } from '@/lib/server/auth-login-failure';
import { loginFailureMessage } from '@/app/platform-v7/login/LoginFormClient';

const ORIGIN = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const EMAIL = 'person@example.test';
const PASSWORD = 'correct horse battery staple';
const CSRF = 'a'.repeat(48);

function loginRequest(overrides: { csrfHeader?: string } = {}) {
  return new Request(`${ORIGIN}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      host: 'xn----8sbjf4befbjgs9b.xn--p1ai',
      'x-forwarded-proto': 'https',
      cookie: `${CSRF_COOKIE}=${CSRF}`,
      'x-csrf-token': overrides.csrfHeader ?? CSRF,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
}

async function loadRoute() {
  vi.resetModules();
  vi.stubEnv('API_URL', 'http://api.internal:4000');
  vi.stubEnv('PC_PUBLIC_ORIGIN', ORIGIN);
  return import('@/app/api/auth/login/route');
}

function upstream(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

describe('password login refusal classification', () => {
  it('keeps the auth service classes apart without trusting an unknown 403', () => {
    expect(classifyUpstreamLoginFailure(401, { message: 'Invalid credentials' })).toEqual({ code: 'INVALID_CREDENTIALS', status: 401 });
    expect(classifyUpstreamLoginFailure(400, { message: ['email must be an email'] })).toEqual({ code: 'INVALID_CREDENTIALS', status: 401 });
    expect(classifyUpstreamLoginFailure(429, {})).toEqual({ code: 'RATE_LIMITED', status: 429 });
    for (const reason of POST_PROOF_ACCESS_DENIALS) {
      expect(classifyUpstreamLoginFailure(403, { statusCode: 403, message: reason, error: 'Forbidden' })).toEqual({ code: 'ACCESS_NOT_ACTIVE', status: 403 });
    }
    // USER_NOT_ACTIVE is answered as 401 by the API; even if it ever arrived as
    // 403 it must not become an account-state disclosure.
    expect(classifyUpstreamLoginFailure(403, { message: 'USER_NOT_ACTIVE' })).toEqual({ code: 'AUTH_SERVICE_UNAVAILABLE', status: 503 });
    expect(classifyUpstreamLoginFailure(403, { message: 'Forbidden resource' })).toEqual({ code: 'AUTH_SERVICE_UNAVAILABLE', status: 503 });
    expect(classifyUpstreamLoginFailure(403, null)).toEqual({ code: 'AUTH_SERVICE_UNAVAILABLE', status: 503 });
    for (const status of [404, 500, 502, 503, 504]) {
      expect(classifyUpstreamLoginFailure(status, { message: 'NO_ACTIVE_MEMBERSHIP' })).toEqual({ code: 'AUTH_SERVICE_UNAVAILABLE', status: 503 });
    }
  });
});

describe('BFF /api/auth/login refused answers', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  const cases: Array<[number, unknown, string, number]> = [
    [401, { statusCode: 401, message: 'Invalid credentials' }, 'INVALID_CREDENTIALS', 401],
    [429, { statusCode: 429, message: 'Too Many Requests' }, 'RATE_LIMITED', 429],
    [403, { statusCode: 403, message: 'ORGANIZATION_NOT_VERIFIED', error: 'Forbidden' }, 'ACCESS_NOT_ACTIVE', 403],
    [500, { statusCode: 500, message: 'Internal server error' }, 'AUTH_SERVICE_UNAVAILABLE', 503],
    [404, { statusCode: 404, message: 'Cannot POST /auth/login' }, 'AUTH_SERVICE_UNAVAILABLE', 503],
  ];

  for (const [upstreamStatus, body, code, status] of cases) {
    it(`answers upstream ${upstreamStatus} as ${code} and logs one redacted line`, async () => {
      const fetchMock = upstream(upstreamStatus, body);
      vi.stubGlobal('fetch', fetchMock);
      const { POST } = await loadRoute();
      const response = await POST(loginRequest());
      const payload = await response.json();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(status);
      expect(payload).toMatchObject({ ok: false, code });
      expect(typeof payload.correlationId).toBe('string');
      // The visible message never carries the upstream reason.
      expect(JSON.stringify(payload)).not.toContain('ORGANIZATION_NOT_VERIFIED');
      expect(response.headers.get('set-cookie')).toBeNull();

      const lines = warn.mock.calls.filter(([event]) => event === 'auth_login_refused');
      expect(lines).toHaveLength(1);
      const logged = JSON.parse(String(lines[0]![1]));
      expect(logged).toEqual({ correlationId: payload.correlationId, controlPlane: false, code, upstreamStatus });
      const serialized = JSON.stringify(warn.mock.calls);
      expect(serialized).not.toContain(EMAIL);
      expect(serialized).not.toContain(PASSWORD);
    });
  }

  it('logs a CSRF refusal with its reason and never calls the auth service', async () => {
    const fetchMock = upstream(200, {});
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await loadRoute();
    const response = await POST(loginRequest({ csrfHeader: 'b'.repeat(48) }));
    const payload = await response.json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ ok: false, code: 'CSRF_REJECTED' });
    const lines = warn.mock.calls.filter(([event]) => event === 'auth_login_refused');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(String(lines[0]![1]))).toEqual({
      correlationId: payload.correlationId,
      controlPlane: false,
      code: 'CSRF_REJECTED',
      reason: 'csrf_mismatch',
    });
  });
});

describe('login form refusal messages', () => {
  const copy = {
    unavailable: 'CHECK_DETAILS',
    rateLimited: 'RATE_LIMITED_TEXT',
    accessNotActive: 'ACCESS_NOT_ACTIVE_TEXT',
    staleForm: 'STALE_FORM_TEXT',
    serviceUnavailable: 'SERVICE_UNAVAILABLE_TEXT',
    reference: 'REF',
  };
  const correlationId = '1a2b3c4d-5e6f-4a1b-8c2d-0123456789ab';

  it('keeps the generic text only for unproven credentials', () => {
    expect(loginFailureMessage(copy, { code: 'INVALID_CREDENTIALS', correlationId })).toBe('CHECK_DETAILS');
  });

  it('names throttling, stale forms, inactive access and service failure separately', () => {
    expect(loginFailureMessage(copy, { code: 'RATE_LIMITED', correlationId })).toBe('RATE_LIMITED_TEXT');
    expect(loginFailureMessage(copy, { code: 'CSRF_REJECTED', correlationId })).toBe('STALE_FORM_TEXT');
    expect(loginFailureMessage(copy, { code: 'ACCESS_NOT_ACTIVE', correlationId })).toBe('ACCESS_NOT_ACTIVE_TEXT REF 1a2b3c4d');
    for (const code of ['AUTH_SERVICE_UNAVAILABLE', 'SESSION_CONFIGURATION_ERROR', 'AUTH_SERVICE_INVALID_RESPONSE', 'AUTH_SERVICE_INVALID_ROLE', 'MFA_UNAVAILABLE', undefined]) {
      expect(loginFailureMessage(copy, { code, correlationId })).toBe('SERVICE_UNAVAILABLE_TEXT REF 1a2b3c4d');
    }
  });

  it('omits a reference that is missing or not an opaque id', () => {
    expect(loginFailureMessage(copy, { code: 'AUTH_SERVICE_UNAVAILABLE' })).toBe('SERVICE_UNAVAILABLE_TEXT');
    expect(loginFailureMessage(copy, { code: 'AUTH_SERVICE_UNAVAILABLE', correlationId: '<img src=x>' })).toBe('SERVICE_UNAVAILABLE_TEXT');
  });
});
