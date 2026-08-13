import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as chatPost } from '@/app/api/agro-chat/route';
import { POST as registerPost } from '@/app/api/gekta/auth/register/route';
import {
  GEKTA_ANONYMOUS_COOKIE,
  parseAnonymousSession,
  reserveAnswer,
  serializeAnonymousSession,
  createAnonymousSession,
} from '@/lib/gekta/anonymous-session';
import {
  clearGektaMfaCookieOptions,
  gektaMfaCookieOptions,
  openGektaMfaTicket,
  sealGektaMfaTicket,
} from '@/lib/server/gekta-mfa-ticket';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const DELIVERY_KEY = 'gekta-registration-delivery-key-at-least-32-chars';
const MFA_SECRET = 'gekta-mfa-ticket-secret-at-least-32-characters';

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
    json: async () => body,
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
    process.env.RESEND_API_KEY = 'resend-test-key';
    process.env.RESEND_FROM_EMAIL = 'Gekta <no-reply@example.test>';
    process.env.PC_PUBLIC_ORIGIN = 'https://gekta.example.test';
    process.env.MFA_LOGIN_TICKET_SECRET = MFA_SECRET;
    process.env.GEKTA_ANONYMOUS_SESSION_SECRET = 'anonymous-test-secret-at-least-16';
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
    expect(String(calls[1].init?.body)).toContain('https://gekta.example.test/gekta/register?verify=rev_secret_bearer_token');
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
  });

  it('removes the email bearer from the URL before verification and never exposes the MFA challenge to JS', () => {
    const client = read('components/gekta/GektaRegistrationClient.tsx');
    const verifyRoute = read('app/api/gekta/auth/email/verify/route.ts');
    expect(client.indexOf("params.delete('verify')")).toBeLessThan(client.indexOf("post('/api/gekta/auth/email/verify'"));
    expect(client).toContain("window.history.replaceState(window.history.state, '', clean)");
    expect(verifyRoute).toContain('sealGektaMfaTicket');
    expect(verifyRoute).not.toMatch(/challengeToken:\s*payload\.challengeToken[,\s]*\n\s*correlationId/u);
  });
});

describe('Gekta answer admission', () => {
  beforeEach(() => {
    process.env.GEKTA_ANONYMOUS_SESSION_SECRET = 'anonymous-test-secret-at-least-16';
    delete process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED;
  });

  it('rejects a direct standalone generation that has no server reservation', async () => {
    const response = await chatPost(chatRequest({}));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: 'GEKTA_ANSWER_RESERVATION_REQUIRED' });
  });

  it('consumes the matching signed reservation at generation admission', async () => {
    const reserved = reserveAnswer(createAnonymousSession(), 'answer-ticket');
    const serialized = serializeAnonymousSession(reserved);
    expect(parseAnonymousSession(serialized)).toMatchObject({ pending: 'answer-ticket' });
    const response = await chatPost(chatRequest({
      ticket: 'answer-ticket',
      cookie: `${GEKTA_ANONYMOUS_COOKIE}=${serialized}`,
    }));
    expect(response.status).toBe(200);
    const rawCookie = /gekta_anon=([^;]+)/u.exec(response.headers.get('set-cookie') || '')?.[1] || '';
    expect(parseAnonymousSession(decodeURIComponent(rawCookie))).toMatchObject({ used: 1, pending: null });
  });
});
