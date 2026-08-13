import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/gekta/entitlement/route';
import { GEKTA_ANONYMOUS_COOKIE, parseAnonymousSession, serializeAnonymousSession } from '@/lib/gekta/anonymous-session';
import { GEKTA_ENTITLEMENT_STATES, isBlockedState, resolveAnonymousEntitlement } from '@/lib/gekta/entitlement';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const ORIGIN = 'https://example.test';

/**
 * The route reads only headers, the request cookie and the JSON body. The test
 * environment's Request implementation drops header init, so build exactly that
 * surface instead of fighting the polyfill.
 */
function request(method: 'GET' | 'POST', cookie?: string, body?: unknown, site = 'same-origin', accessToken = '') {
  const headers = new Headers({ 'content-type': 'application/json', 'sec-fetch-site': site, 'x-pc-locale': 'ru' });
  return {
    method,
    url: `${ORIGIN}/api/gekta/entitlement`,
    headers,
    cookies: { get: (name: string) => {
      if (cookie && name === GEKTA_ANONYMOUS_COOKIE) return { name, value: cookie };
      if (accessToken && name === 'pc_access_token') return { name, value: accessToken };
      return undefined;
    } },
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body');
      return body;
    },
  } as unknown as NextRequest;
}

function cookieFrom(response: Response): string {
  const raw = response.headers.get('set-cookie') ?? '';
  const match = /gekta_anon=([^;]+)/u.exec(raw);
  return match ? decodeURIComponent(match[1]) : '';
}

/** Drive the full reserve → complete cycle the client performs per answer. */
async function askOnce(cookie: string): Promise<{ cookie: string; allowed: boolean; remaining: number | null }> {
  const reserveResponse = await POST(request('POST', cookie, { action: 'reserve' }));
  const reserved = await reserveResponse.json();
  const afterReserve = cookieFrom(reserveResponse);
  if (!reserved.allowed) return { cookie: afterReserve, allowed: false, remaining: reserved.entitlement.remaining };
  const completeResponse = await POST(request('POST', afterReserve, { action: 'complete', ticket: reserved.ticket }));
  const completed = await completeResponse.json();
  return { cookie: cookieFrom(completeResponse), allowed: true, remaining: completed.entitlement.remaining };
}

describe('Gekta anonymous entitlement', () => {
  const originalSecret = process.env.GEKTA_ANONYMOUS_SESSION_SECRET;
  const originalLimit = process.env.GEKTA_ANONYMOUS_FREE_ANSWERS;
  const originalApiUrl = process.env.API_URL;

  beforeEach(() => {
    process.env.GEKTA_ANONYMOUS_SESSION_SECRET = 'test-secret-value-at-least-16-chars';
    delete process.env.GEKTA_ANONYMOUS_FREE_ANSWERS;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.GEKTA_ANONYMOUS_SESSION_SECRET;
    else process.env.GEKTA_ANONYMOUS_SESSION_SECRET = originalSecret;
    if (originalLimit === undefined) delete process.env.GEKTA_ANONYMOUS_FREE_ANSWERS;
    else process.env.GEKTA_ANONYMOUS_FREE_ANSWERS = originalLimit;
    if (originalApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = originalApiUrl;
    vi.unstubAllGlobals();
  });

  it('declares every access state the product plans for', () => {
    expect([...GEKTA_ENTITLEMENT_STATES]).toEqual([
      'ANONYMOUS_FREE',
      'REGISTRATION_REQUIRED',
      'TRIAL_ACTIVE',
      'TRIAL_EXPIRED',
      'PAID_ACTIVE',
      'PAST_DUE',
      'CANCELLED',
      'MANUAL_ACCESS',
      'LIFETIME_ACCESS',
      'SUSPENDED',
    ]);
    expect(isBlockedState('REGISTRATION_REQUIRED')).toBe(true);
    expect(isBlockedState('TRIAL_EXPIRED')).toBe(true);
    expect(isBlockedState('ANONYMOUS_FREE')).toBe(false);
  });

  it('starts a fresh visitor on ten free answers and a signed session cookie', async () => {
    const response = await GET(request('GET'));
    const body = await response.json();
    expect(body.entitlement.state).toBe('ANONYMOUS_FREE');
    expect(body.entitlement.limit).toBe(10);
    expect(body.entitlement.remaining).toBe(10);
    expect(body.entitlement.canAsk).toBe(true);
    const cookieHeader = response.headers.get('set-cookie') ?? '';
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=lax');
    expect(parseAnonymousSession(cookieFrom(response))).not.toBeNull();
  });

  it('counts completed answers, not sends, and gates on the tenth', async () => {
    let cookie = cookieFrom(await GET(request('GET')));
    for (let index = 0; index < 10; index += 1) {
      const result = await askOnce(cookie);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9 - index);
      cookie = result.cookie;
    }
    const blocked = await askOnce(cookie);
    expect(blocked.allowed).toBe(false);
    const state = await (await GET(request('GET', blocked.cookie))).json();
    expect(state.entitlement.state).toBe('REGISTRATION_REQUIRED');
    expect(state.entitlement.canAsk).toBe(false);
  });

  it('charges a reserved answer that is never reported as completed', async () => {
    let cookie = cookieFrom(await GET(request('GET')));
    // Reserve without completing, five times in a row.
    for (let index = 0; index < 5; index += 1) {
      const response = await POST(request('POST', cookie, { action: 'reserve' }));
      expect((await response.json()).allowed).toBe(true);
      cookie = cookieFrom(response);
    }
    const state = await (await GET(request('GET', cookie))).json();
    // Four settled by the following reservations; the fifth is still outstanding.
    expect(state.entitlement.remaining).toBe(6);
  });

  it('refuses a forged or edited counter instead of trusting it', async () => {
    const honest = await askOnce(cookieFrom(await GET(request('GET'))));
    const session = parseAnonymousSession(honest.cookie);
    expect(session).not.toBeNull();
    const forged = serializeAnonymousSession({ ...session!, used: 0 });
    // Re-signing requires the secret; flipping the payload alone must not verify.
    const tampered = `${forged.split('.')[0]}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    expect(parseAnonymousSession(tampered)).toBeNull();
    const response = await GET(request('GET', tampered));
    const body = await response.json();
    // An unverifiable cookie starts a new session rather than being honoured.
    expect(body.entitlement.remaining).toBe(10);
    expect(parseAnonymousSession(cookieFrom(response))?.used).toBe(0);
  });

  it('honours a centrally configured free-answer limit', async () => {
    process.env.GEKTA_ANONYMOUS_FREE_ANSWERS = '3';
    const body = await (await GET(request('GET'))).json();
    expect(body.entitlement.limit).toBe(3);
    expect(resolveAnonymousEntitlement({ used: 3 }, new Date()).state).toBe('REGISTRATION_REQUIRED');
  });

  it('rejects cross-site writes and unknown actions', async () => {
    const cross = request('POST', undefined, { action: 'reserve' }, 'cross-site');
    expect((await POST(cross)).status).toBe(403);
    expect((await POST(request('POST', undefined, { action: 'grant-everything' }))).status).toBe(400);
  });

  it('publishes the working registration entry point at the anonymous gate', async () => {
    const body = await (await GET(request('GET'))).json();
    expect(body.registrationUrl).toBe('/gekta/register');
    const gate = read('components/gekta/GektaAccessGate.tsx');
    expect(gate).toContain('registrationUrl ? (');
    expect(gate).toContain('Бесплатные ответы закончились');
  });

  it('uses account entitlement when an access cookie exists and never resets to anonymous quota', async () => {
    process.env.API_URL = 'https://api.example.test';
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      entitlement: { state: 'TRIAL_ACTIVE', canAsk: true, expiresAt: '2026-09-12T00:00:00.000Z', serverTime: '2026-08-13T00:00:00.000Z' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(request('GET', undefined, undefined, 'same-origin', 'access-token-value'));
    const body = await response.json();
    expect(body.entitlement.state).toBe('TRIAL_ACTIVE');
    expect(body.entitlement.remaining).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();

    const reserve = await POST(request('POST', undefined, { action: 'reserve' }, 'same-origin', 'access-token-value'));
    const reserved = await reserve.json();
    expect(reserved.allowed).toBe(true);
    expect(reserved.ticket).toBe('account');
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/gekta/entitlement', expect.objectContaining({ method: 'GET' }));
  });

  it('fails closed instead of granting a new anonymous quota when account lookup is unauthorized', async () => {
    process.env.API_URL = 'https://api.example.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const response = await GET(request('GET', undefined, undefined, 'same-origin', 'expired-access-token'));
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect((await response.json()).error).toBe('authentication_required');
  });

  it('asks the server before every generation and never decides access in the browser', () => {
    const workspace = read('components/gekta/GektaChatWorkspace.tsx');
    expect(workspace).toContain('const ticket = await reserveAnswer();');
    expect(workspace).toContain('if (!ticket) return;');
    expect(workspace).toContain("if (finalMessage.status === 'answered') await settleAnswer(ticket);");
    expect(workspace).toContain('entitlement && !entitlement.canAsk ? <GektaAccessGate');
    expect(workspace).not.toContain('localStorage.getItem(\'gekta-quota');
  });
});
