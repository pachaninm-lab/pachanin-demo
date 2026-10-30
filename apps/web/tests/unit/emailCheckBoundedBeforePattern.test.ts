// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

// These public auth routes accept an email address from an anonymous caller and
// read the body with request.json(), which sets no size bound of its own. They
// used to test the address against /^\S+@\S+\.\S+$/ first and check the
// 254-character limit second; `||` evaluates left to right, so the pattern ran
// over the full, unbounded string before the cheap check could refuse it. The
// order is now length first. Which inputs are accepted is unchanged; what
// changes is that the pattern only ever sees a bounded string.
//
// The node environment is required: a browser-like environment strips the
// Cookie header, and the CSRF double-submit check needs it.

const TOKEN = 'c'.repeat(48);
const OVERLONG = `${'a'.repeat(300)}@example.test`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function post(body: Record<string, unknown>) {
  return new Request('https://example.test/api/auth/x', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `pc_csrf_token=${TOKEN}`,
      'x-csrf-token': TOKEN,
      'idempotency-key': 'k'.repeat(24),
    },
    body: JSON.stringify(body),
  });
}

async function patternCallsFor(load: () => Promise<{ POST: (request: Request) => Promise<Response> }>, body: Record<string, unknown>) {
  const { POST } = await load();
  const spy = vi.spyOn(RegExp.prototype, 'test');
  const response = await POST(post(body));
  const sawOverlong = spy.mock.calls.some(([input]) => input === OVERLONG);
  spy.mockRestore();
  return { status: response.status, sawOverlong };
}

const ROUTES: Array<[string, () => Promise<{ POST: (request: Request) => Promise<Response> }>, Record<string, unknown>]> = [
  ['forgot-password', () => import('../../app/api/auth/forgot-password/route'), {}],
  ['registration/resend', () => import('../../app/api/auth/registration/resend/route'), {}],
  ['register', () => import('../../app/api/auth/register/route'), { workspace: 'seller' }],
  ['organization-invitations', () => import('../../app/api/auth/organization-invitations/route'), { role: 'MANAGER' }],
];

describe('public auth routes bound the email before matching it', () => {
  for (const [name, load, extra] of ROUTES) {
    it(`${name}: refuses an overlong address without running the pattern over it`, async () => {
      const { status, sawOverlong } = await patternCallsFor(load, { ...extra, email: OVERLONG });
      expect(status).toBe(400);
      expect(sawOverlong).toBe(false);
    });
  }

  it('still refuses a short malformed address by the pattern', async () => {
    const { POST } = await import('../../app/api/auth/forgot-password/route');
    const response = await POST(post({ email: 'not-an-address' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_EMAIL' });
  });
});
