import { NextRequest, NextResponse } from 'next/server';
import {
  GEKTA_ANONYMOUS_COOKIE,
  GEKTA_ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
  completeAnswer,
  createAnonymousSession,
  issueTicket,
  parseAnonymousSession,
  reserveAnswer,
  serializeAnonymousSession,
  recordConsent,
  settlePending,
  type GektaAnonymousSession,
} from '@/lib/gekta/anonymous-session';
import { GEKTA_LEGAL_VERSION } from '@/lib/gekta/legal';
import { resolveAnonymousEntitlement } from '@/lib/gekta/entitlement';
import { isBillingEnabled } from '@/lib/gekta/merchant';

function registrationUrl(): string | null {
  const configured = process.env.GEKTA_REGISTRATION_URL?.trim();
  return configured && /^\/[^/]/u.test(configured) ? configured : '/gekta/register';
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: GEKTA_ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
  };
}

function respond(session: GektaAnonymousSession, body: Record<string, unknown>, now: Date) {
  const response = NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(GEKTA_ANONYMOUS_COOKIE, serializeAnonymousSession(session), cookieOptions());
  void now;
  return response;
}

function readSession(request: NextRequest): GektaAnonymousSession {
  return parseAnonymousSession(request.cookies.get(GEKTA_ANONYMOUS_COOKIE)?.value) ?? createAnonymousSession();
}

export async function GET(request: NextRequest) {
  const now = new Date();
  const session = readSession(request);
  return respond(session, {
    entitlement: resolveAnonymousEntitlement({ used: session.used }, now),
    consent: session.consent ?? null,
    legalVersion: GEKTA_LEGAL_VERSION,
    registrationUrl: registrationUrl(),
    billingEnabled: isBillingEnabled(),
  }, now);
}

export async function POST(request: NextRequest) {
  // The Gekta surfaces are same-origin; a cross-site POST has no business here.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'cross_site_forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const now = new Date();
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const action = payload.action === 'reserve' || payload.action === 'complete' || payload.action === 'consent' ? payload.action : null;
  if (!action) {
    return NextResponse.json({ error: 'unsupported_action' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const current = readSession(request);

  if (action === 'consent') {
    // Consent is bound to the anonymous session id, the document version and
    // the server clock, and signed so the record cannot be edited client-side.
    const accepted = recordConsent(current, GEKTA_LEGAL_VERSION, now);
    return respond(accepted, { entitlement: resolveAnonymousEntitlement({ used: accepted.used }, now), consent: accepted.consent, legalVersion: GEKTA_LEGAL_VERSION, registrationUrl: registrationUrl(), billingEnabled: isBillingEnabled() }, now);
  }

  if (action === 'complete') {
    const ticket = typeof payload.ticket === 'string' ? payload.ticket : '';
    const settled = completeAnswer(current, ticket);
    return respond(settled, { entitlement: resolveAnonymousEntitlement({ used: settled.used }, now), registrationUrl: registrationUrl(), billingEnabled: isBillingEnabled() }, now);
  }

  // An answer that was reserved but never reported is charged now.
  const settled = settlePending(current);
  const entitlement = resolveAnonymousEntitlement({ used: settled.used }, now);
  if (!entitlement.canAsk) {
    return respond(settled, { entitlement, allowed: false, ticket: null, registrationUrl: registrationUrl(), billingEnabled: isBillingEnabled() }, now);
  }

  const ticket = issueTicket(now);
  const reserved = reserveAnswer(settled, ticket);
  // The reserved answer is not free: report what is left after it.
  const projected = resolveAnonymousEntitlement({ used: settled.used + 1 }, now);
  return respond(reserved, {
    entitlement: { ...entitlement, remaining: projected.remaining },
    allowed: true,
    ticket,
    registrationUrl: registrationUrl(),
    billingEnabled: isBillingEnabled(),
  }, now);
}
