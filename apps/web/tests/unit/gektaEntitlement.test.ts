import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { middleware as applyMiddleware } from '../../middleware';
import { GET, POST } from '@/app/api/gekta/entitlement/route';
import {
  GEKTA_ANONYMOUS_COOKIE,
  admitReservedAnswer,
  createAnonymousSession,
  isFreshAnswerTicket,
  issueTicket,
  parseAnonymousSession,
  reserveAnswer,
  serializeAnonymousSession,
} from '@/lib/gekta/anonymous-session';
import { GEKTA_ENTITLEMENT_STATES, isBlockedState, resolveAnonymousEntitlement } from '@/lib/gekta/entitlement';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const ORIGIN = 'https://example.test';

/**
 * The route reads only headers, the request cookie and the JSON body. The test
 * environment's Request implementation drops header init, so build exactly that
 * surface instead of fighting the polyfill.
 */
function request(method: 'GET' | 'POST', cookie?: string, body?: unknown, site = 'same-origin') {
  const headers = new Headers({ 'content-type': 'application/json', 'sec-fetch-site': site });
  return {
    method,
    url: `${ORIGIN}/api/gekta/entitlement`,
    headers,
    cookies: { get: (name: string) => (cookie && name === GEKTA_ANONYMOUS_COOKIE ? { name, value: cookie } : undefined) },
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

  beforeEach(() => {
    process.env.GEKTA_ANONYMOUS_SESSION_SECRET = 'x'.repeat(32);
    delete process.env.GEKTA_ANONYMOUS_FREE_ANSWERS;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.GEKTA_ANONYMOUS_SESSION_SECRET;
    else process.env.GEKTA_ANONYMOUS_SESSION_SECRET = originalSecret;
    if (originalLimit === undefined) delete process.env.GEKTA_ANONYMOUS_FREE_ANSWERS;
    else process.env.GEKTA_ANONYMOUS_FREE_ANSWERS = originalLimit;
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

  it('admits only the exact anonymous entitlement route before the generic API session gate', async () => {
    const middleware = read('middleware.ts');
    const start = middleware.indexOf('const PUBLIC_API_EXACT = new Set([');
    const end = middleware.indexOf(']);', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const publicApiBlock = middleware.slice(start, end + 3);
    expect(publicApiBlock.split("'/api/gekta/entitlement'")).toHaveLength(2);
    expect(publicApiBlock).not.toContain("'/api/gekta/'");
    expect(middleware.indexOf('|| PUBLIC_API_EXACT.has(p)')).toBeLessThan(
      middleware.indexOf("if (p.startsWith('/api/'))"),
    );

    const anonymous = await applyMiddleware(new NextRequest(`${ORIGIN}/api/gekta/entitlement`));
    expect(anonymous.status).toBe(200);
    expect(anonymous.headers.get('x-middleware-next')).toBe('1');

    const account = await applyMiddleware(new NextRequest(`${ORIGIN}/api/gekta/account/entitlement`));
    expect(account.status).toBe(401);
    await expect(account.json()).resolves.toMatchObject({ message: 'unauthenticated' });
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

  it('expires an answer ticket before its distributed replay bucket can reset', () => {
    const issued = new Date('2026-08-13T10:00:00.000Z');
    const ticket = issueTicket(issued);
    const reserved = reserveAnswer(createAnonymousSession(issued), ticket);
    expect(isFreshAnswerTicket(ticket, new Date(issued.getTime() + 10 * 60_000))).toBe(true);
    expect(admitReservedAnswer(reserved, ticket, new Date(issued.getTime() + 10 * 60_000 + 1))).toBeNull();
  });

  it('rejects an expired or implausibly future-dated anonymous session', () => {
    const issued = new Date('2026-01-01T00:00:00.000Z');
    const serialized = serializeAnonymousSession(createAnonymousSession(issued));
    expect(parseAnonymousSession(serialized, new Date(issued.getTime() + 180 * 24 * 60 * 60_000))).not.toBeNull();
    expect(parseAnonymousSession(serialized, new Date(issued.getTime() + 180 * 24 * 60 * 60_000 + 1))).toBeNull();
    expect(parseAnonymousSession(serialized, new Date(issued.getTime() - 60_001))).toBeNull();
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
    process.env.GEKTA_ANONYMOUS_FREE_ANSWERS = '1001';
    expect((await (await GET(request('GET'))).json()).entitlement.limit).toBe(1000);
  });

  it('rejects cross-site writes and unknown actions', async () => {
    const cross = request('POST', undefined, { action: 'reserve' }, 'cross-site');
    expect((await POST(cross)).status).toBe(403);
    expect((await POST(request('POST', undefined, { action: 'grant-everything' }))).status).toBe(400);
  });

  it('publishes the real registration action once the account flow exists', async () => {
    const body = await (await GET(request('GET'))).json();
    expect(body.registrationUrl).toBe('/gekta/register');
    const gate = read('components/gekta/GektaAccessGate.tsx');
    expect(gate).toContain('registrationUrl ? (');
    expect(gate).toContain('Бесплатные ответы закончились');
    expect(gate).toContain('localizedRegistrationUrl(registrationUrl, locale)');
  });

  it('asks the server before every generation and never decides access in the browser', () => {
    const workspace = read('components/gekta/GektaChatWorkspace.tsx');
    expect(workspace).toContain('const ticket = await reserveAnswer();');
    expect(workspace).toContain('if (!ticket) return;');
    expect(workspace).toContain("'x-gekta-answer-ticket': ticket");
    expect(workspace).toContain("if (finalMessage.status === 'answered') await settleAnswer(ticket);");
    expect(workspace).toContain('entitlement && !entitlement.canAsk ? <GektaAccessGate');
    expect(workspace).not.toContain('localStorage.getItem(\'gekta-quota');
  });
});
