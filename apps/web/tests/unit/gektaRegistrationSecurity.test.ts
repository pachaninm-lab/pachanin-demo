import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as chatPost } from '@/app/api/agro-chat/route';
import { POST as registerPost } from '@/app/api/gekta/auth/register/route';
import { GET as verificationGet } from '@/app/api/gekta/auth/email/verify/route';
import {
  GEKTA_ANONYMOUS_COOKIE,
  parseAnonymousSession,
  reserveAnswer,
  serializeAnonymousSession,
  createAnonymousSession,
  issueTicket,
} from '@/lib/gekta/anonymous-session';
import {
  clearGektaMfaCookieOptions,
  gektaEmailCookieOptions,
  gektaMfaCookieOptions,
  openGektaEmailTicket,
  openGektaMfaTicket,
  sealGektaEmailTicket,
  sealGektaMfaTicket,
} from '@/lib/server/gekta-mfa-ticket';
import { requestIp as trustedRequestIp } from '@/lib/server/gekta-auth-route';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const fixtureValue = (purpose: string, length = 48) => `${purpose}-fixture-${'x'.repeat(length)}`;
const DELIVERY_KEY = fixtureValue('delivery');
const MFA_TEST_KEY = fixtureValue('mfa-ticket');
const ANONYMOUS_TEST_KEY = fixtureValue('anonymous');

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function bffRequest(body: Record<string, unknown>): Request {
  return {
    method: 'POST',
    url: 'https://gekta.example.test/api/gekta/auth/register',
    headers: new Headers({
      cookie: 'pc_csrf_token=csrf-test',
      'x-csrf-token': 'csrf-test',
      'content-type': 'application/json',
    }),
    text: async () => JSON.stringify(body),
  } as unknown as Request;
}

function chatRequest(input: { ticket?: string; cookie?: string }): NextRequest {
  const url = 'https://example.test/api/agro-chat?stream=1';
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers({
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      ...(input.ticket ? { 'x-gekta-answer-ticket': input.ticket } : {}),
      ...(input.cookie ? { cookie: input.cookie } : {}),
    }),
    cookies: {
      get: (name: string) => name === GEKTA_ANONYMOUS_COOKIE && input.cookie
        ? { name, value: input.cookie.slice(input.cookie.indexOf('=') + 1) }
        : undefined,
    },
    signal: new AbortController().signal,
    text: async () => JSON.stringify({
      message: 'Посев озимой пшеницы', locale: 'ru', context: 'gekta-standalone', history: [],
    }),
  } as unknown as NextRequest;
}

describe('Gekta registration security boundary', () => {
  const original = {
    api: process.env.API_URL,
    delivery: process.env.REGISTRATION_DELIVERY_KEY,
    resendKey: process.env.RESEND_API_KEY,
    resendFrom: process.env.RESEND_FROM_EMAIL,
    origin: process.env.PC_PUBLIC_ORIGIN,
    mfa: process.env.MFA_LOGIN_TICKET_SECRET,
    anonymous: process.env.GEKTA_ANONYMOUS_SESSION_SECRET,
  };

  beforeEach(() => {
    process.env.API_URL = 'https://api.example.test';
    process.env.REGISTRATION_DELIVERY_KEY = DELIVERY_KEY;
    process.env.RESEND_API_KEY = fixtureValue('resend');
    process.env.RESEND_FROM_EMAIL = 'Gekta <no-reply@example.test>';
    process.env.PC_PUBLIC_ORIGIN = 'https://gekta.example.test';
    process.env.MFA_LOGIN_TICKET_SECRET = MFA_TEST_KEY;
    process.env.GEKTA_ANONYMOUS_SESSION_SECRET = ANONYMOUS_TEST_KEY;
  });

  afterEach(() => {
    setEnv('API_URL', original.api);
    setEnv('REGISTRATION_DELIVERY_KEY', original.delivery);
    setEnv('RESEND_API_KEY', original.resendKey);
    setEnv('RESEND_FROM_EMAIL', original.resendFrom);
    setEnv('PC_PUBLIC_ORIGIN', original.origin);
    setEnv('MFA_LOGIN_TICKET_SECRET', original.mfa);
    setEnv('GEKTA_ANONYMOUS_SESSION_SECRET', original.anonymous);
    vi.unstubAllGlobals();
  });

  it('keeps the API email bearer token inside the BFF while sending the real link', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/gekta/auth/register')) {
        return Response.json({
          status: 'EMAIL_VERIFICATION_REQUIRED',
          emailDelivery: { email: 'new@example.test', token: 'rev_secret_bearer_token' },
        });
      }
      if (url === 'https://api.resend.com/emails') return Response.json({ id: 'mail-1' });
      return new Response(null, { status: 500 });
    }));

    const response = await registerPost(bffRequest({
        fullName: 'Иван Агроном',
        phone: '+7 916 000-00-00',
        email: 'new@example.test',
        password: 'Sever0oborot!2026',
        acceptedServiceTerms: true,
        acceptedPersonalData: true,
        locale: 'ru',
    }));

    expect(response.status).toBe(202);
    expect(await response.text()).not.toContain('rev_secret_bearer_token');
    expect(new Headers(calls[0].init?.headers).get('x-registration-delivery-key')).toBe(DELIVERY_KEY);
    expect(String(calls[1].init?.body)).toContain('https://gekta.example.test/api/gekta/auth/email/verify?token=rev_secret_bearer_token');
  });

  it('returns the same accepted response when the API suppresses an existing email', async () => {
    const fetchMock = vi.fn(async () => Response.json({ status: 'EMAIL_VERIFICATION_REQUIRED' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await registerPost(bffRequest({
        fullName: 'Иван Агроном', phone: '+7 916 000-00-00', email: 'used@example.test',
        password: 'Sever0oborot!2026', acceptedServiceTerms: true, acceptedPersonalData: true,
    }));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ accepted: true, status: 'EMAIL_VERIFICATION_REQUIRED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized auth body before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await registerPost({
      method: 'POST',
      url: 'https://gekta.example.test/api/gekta/auth/register',
      headers: new Headers({
        cookie: 'pc_csrf_token=csrf-test',
        'x-csrf-token': 'csrf-test',
        'content-length': String(17 * 1_024),
      }),
      text: async () => JSON.stringify({ email: 'new@example.test' }),
    } as unknown as Request);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('derives rate-limit identity only from Caddy\'s nearest forwarded hop', () => {
    const headers = new Headers({
      'x-nf-client-connection-ip': '198.51.100.20',
      'cf-connecting-ip': '198.51.100.21',
      'x-real-ip': '198.51.100.22',
      'x-forwarded-for': '198.51.100.23, 203.0.113.7',
    });
    expect(trustedRequestIp({ headers } as Request)).toBe('203.0.113.7');
    expect(trustedRequestIp({ headers: new Headers({ 'cf-connecting-ip': '198.51.100.21' }) } as Request)).toBe('');
    expect(trustedRequestIp({ headers: new Headers({ 'x-forwarded-for': '198.51.100.23, forged' }) } as Request)).toBe('');
  });

  it('does not claim that a verification email was sent when delivery failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/gekta/auth/register')) {
        return Response.json({
          status: 'EMAIL_VERIFICATION_REQUIRED',
          emailDelivery: { email: 'new@example.test', token: 'rev_secret_bearer_token' },
        });
      }
      if (url === 'https://api.resend.com/emails') return new Response('unavailable', { status: 503 });
      return new Response(null, { status: 500 });
    }));
    const response = await registerPost(bffRequest({
      fullName: 'Иван Агроном', phone: '+7 916 000-00-00', email: 'new@example.test',
      password: 'Sever0oborot!2026', acceptedServiceTerms: true, acceptedPersonalData: true,
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE' });
  });

  it('encrypts the pending challenge and declared phone in a short-lived strict cookie', () => {
    const ticket = sealGektaMfaTicket({
      challengeToken: 'mc_challenge-token-at-least-16',
      email: 'new@example.test',
      enrollment: true,
      setupSecret: 'TOTPSECRET',
      otpAuthUri: 'otpauth://totp/Gekta:new@example.test?secret=TOTPSECRET',
      declaredPhone: '+7 916 000-00-00',
    }, 1_000);
    expect(ticket).not.toContain('mc_challenge');
    expect(ticket).not.toContain('+7 916');
    expect(openGektaMfaTicket(ticket, 1_001)).toMatchObject({
      challengeToken: 'mc_challenge-token-at-least-16',
      declaredPhone: '+7 916 000-00-00',
    });
    expect(openGektaMfaTicket(ticket, 1_601)).toBeNull();
    expect(openGektaMfaTicket(`${ticket.slice(0, -1)}x`, 1_001)).toBeNull();
    expect(gektaMfaCookieOptions()).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/api/gekta/auth' });
    expect(clearGektaMfaCookieOptions().maxAge).toBe(0);
    expect(() => sealGektaMfaTicket({
      challengeToken: 'mc_challenge-token-at-least-16',
      email: 'new@example.test',
      enrollment: true,
      setupSecret: 'TOTPSECRET',
    })).toThrow('Invalid Gekta MFA ticket input');
  });

  it('turns the email bearer into a purpose-bound HttpOnly ticket without consuming it on GET', async () => {
    const raw = 'rev_email-bearer-token-at-least-32-characters';
    const sealed = sealGektaEmailTicket(raw, 1_000);
    expect(sealed).not.toContain(raw);
    expect(openGektaEmailTicket(sealed, 1_001)).toBe(raw);
    expect(openGektaEmailTicket(sealed, 2_801)).toBeNull();
    expect(gektaEmailCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/gekta/auth/email/verify',
    });

    const response = verificationGet(new Request(`https://gekta.example.test/api/gekta/auth/email/verify?token=${raw}&lang=en`));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://gekta.example.test/gekta/register?lang=en&confirm=email');
    expect(response.headers.get('location')).not.toContain(raw);
    expect(response.headers.get('set-cookie')).not.toContain(raw);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('requires an explicit browser POST and never exposes bearer challenges to client code', () => {
    const client = read('components/gekta/GektaRegistrationClient.tsx');
    const verifyRoute = read('app/api/gekta/auth/email/verify/route.ts');
    expect(client).not.toContain("params.get('verify')");
    expect(client).toContain("step === 'verify'");
    expect(client).toContain("post('/api/gekta/auth/email/verify', {})");
    expect(verifyRoute).toContain('export function GET(request: Request)');
    expect(verifyRoute).toContain('openGektaEmailTicket');
    expect(verifyRoute).toContain('sealGektaMfaTicket');
    expect(verifyRoute).not.toMatch(/challengeToken:\s*payload\.challengeToken[,\s]*\n\s*correlationId/u);
  });
});

describe('Gekta answer admission', () => {
  beforeEach(() => {
    process.env.API_URL = 'https://api.example.test';
    process.env.REGISTRATION_DELIVERY_KEY = DELIVERY_KEY;
    process.env.GEKTA_ANONYMOUS_SESSION_SECRET = ANONYMOUS_TEST_KEY;
    delete process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a direct standalone generation that has no server reservation', async () => {
    const response = await chatPost(chatRequest({}));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'GEKTA_ANSWER_RESERVATION_REQUIRED' });
  });

  it('consumes the matching signed reservation at generation admission', async () => {
    const ticket = issueTicket();
    const reserved = reserveAnswer(createAnonymousSession(), ticket);
    const serialized = serializeAnonymousSession(reserved);
    expect(parseAnonymousSession(serialized)).toMatchObject({ pending: ticket });
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe('https://api.example.test/gekta/internal/anonymous-answer/admit');
      return new Response(JSON.stringify({ allowed: true }), { status: 200 });
    }));
    const response = await chatPost(chatRequest({
      ticket,
      cookie: `${GEKTA_ANONYMOUS_COOKIE}=${serialized}`,
    }));
    expect(response.status).toBe(200);
    const rawCookie = /gekta_anon=([^;]+)/u.exec(response.headers.get('set-cookie') || '')?.[1] || '';
    expect(parseAnonymousSession(decodeURIComponent(rawCookie))).toMatchObject({ used: 1, pending: null });
  });

  it('rejects a replay even when the browser resends its old signed cookie', async () => {
    const ticket = issueTicket();
    const serialized = serializeAnonymousSession(reserveAnswer(createAnonymousSession(), ticket));
    const durable = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ allowed: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ allowed: false }), { status: 200 }));
    vi.stubGlobal('fetch', durable);

    const input = { ticket, cookie: `${GEKTA_ANONYMOUS_COOKIE}=${serialized}` };
    expect((await chatPost(chatRequest(input))).status).toBe(200);
    const replay = await chatPost(chatRequest(input));
    expect(replay.status).toBe(409);
    expect(await replay.json()).toEqual({ code: 'GEKTA_ANSWER_RESERVATION_INVALID' });
    expect(durable).toHaveBeenCalledTimes(2);
  });

  it('fails closed when distributed admission is unavailable', async () => {
    const ticket = issueTicket();
    const serialized = serializeAnonymousSession(reserveAnswer(createAnonymousSession(), ticket));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));

    const response = await chatPost(chatRequest({
      ticket,
      cookie: `${GEKTA_ANONYMOUS_COOKIE}=${serialized}`,
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'GEKTA_SERVICE_UNAVAILABLE' });
  });
});
