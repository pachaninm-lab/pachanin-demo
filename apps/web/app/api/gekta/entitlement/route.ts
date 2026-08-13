import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { apiBaseUrl } from '@/lib/gekta/account-bridge';
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

/**
 * Registration entry point for Gekta. Left unset until an account flow that
 * actually restores access exists, so the product never shows a gate action
 * that leads nowhere.
 */
function registrationUrl(request: NextRequest): string {
  const configured = process.env.GEKTA_REGISTRATION_URL?.trim();
  if (configured && /^\/[^/]/u.test(configured)) return configured;
  const locale = request.headers.get('x-pc-locale');
  return locale === 'en' || locale === 'zh' ? `/gekta/register?lang=${locale}` : '/gekta/register';
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

async function readAccountEntitlement(request: NextRequest): Promise<{
  status: number;
  entitlement: Record<string, unknown> | null;
}> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return { status: 401, entitlement: null };
  const base = apiBaseUrl();
  if (!base) return { status: 503, entitlement: null };
  try {
    const response = await fetch(`${base}/gekta/entitlement`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status >= 300 && response.status < 400) return { status: 502, entitlement: null };
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const entitlement = payload.entitlement;
    return {
      status: response.status,
      entitlement: response.ok && entitlement && typeof entitlement === 'object' && !Array.isArray(entitlement)
        ? entitlement as Record<string, unknown>
        : null,
    };
  } catch {
    return { status: 502, entitlement: null };
  }
}

function accountResponse(request: NextRequest, entitlement: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    entitlement: { ...entitlement, remaining: null, limit: null },
    consent: { version: GEKTA_LEGAL_VERSION },
    legalVersion: GEKTA_LEGAL_VERSION,
    registrationUrl: registrationUrl(request),
    billingEnabled: isBillingEnabled(),
    ...extra,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

function accountFailure(status: number) {
  return NextResponse.json(
    { error: status === 401 ? 'authentication_required' : 'account_entitlement_unavailable' },
    { status: status === 401 ? 401 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  if (request.cookies.get(ACCESS_COOKIE)?.value) {
    const account = await readAccountEntitlement(request);
    return account.entitlement ? accountResponse(request, account.entitlement) : accountFailure(account.status);
  }
  const now = new Date();
  const session = readSession(request);
  return respond(session, {
    entitlement: resolveAnonymousEntitlement({ used: session.used }, now),
    consent: session.consent ?? null,
    legalVersion: GEKTA_LEGAL_VERSION,
    registrationUrl: registrationUrl(request),
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

  // Presence of an access cookie commits this request to the account contour.
  // An expired or unavailable account session must not silently fall back to a
  // fresh anonymous quota, which would reset both authority and history mode.
  if (request.cookies.get(ACCESS_COOKIE)?.value) {
    const account = await readAccountEntitlement(request);
    if (!account.entitlement) return accountFailure(account.status);
    if (action === 'reserve') {
      const allowed = account.entitlement.canAsk === true;
      return accountResponse(request, account.entitlement, { allowed, ticket: allowed ? 'account' : null });
    }
    return accountResponse(request, account.entitlement, { allowed: account.entitlement.canAsk === true, ticket: 'account' });
  }

  if (action === 'consent') {
    // Consent is bound to the anonymous session id, the document version and
    // the server clock, and signed so the record cannot be edited client-side.
    const accepted = recordConsent(current, GEKTA_LEGAL_VERSION, now);
    return respond(accepted, { entitlement: resolveAnonymousEntitlement({ used: accepted.used }, now), consent: accepted.consent, legalVersion: GEKTA_LEGAL_VERSION, registrationUrl: registrationUrl(request), billingEnabled: isBillingEnabled() }, now);
  }

  if (action === 'complete') {
    const ticket = typeof payload.ticket === 'string' ? payload.ticket : '';
    const settled = completeAnswer(current, ticket);
    return respond(settled, { entitlement: resolveAnonymousEntitlement({ used: settled.used }, now), registrationUrl: registrationUrl(request), billingEnabled: isBillingEnabled() }, now);
  }

  // An answer that was reserved but never reported is charged now.
  const settled = settlePending(current);
  const entitlement = resolveAnonymousEntitlement({ used: settled.used }, now);
  if (!entitlement.canAsk) {
    return respond(settled, { entitlement, allowed: false, ticket: null, registrationUrl: registrationUrl(request), billingEnabled: isBillingEnabled() }, now);
  }

  const ticket = issueTicket();
  const reserved = reserveAnswer(settled, ticket);
  // The reserved answer is not free: report what is left after it.
  const projected = resolveAnonymousEntitlement({ used: settled.used + 1 }, now);
  return respond(reserved, {
    entitlement: { ...entitlement, remaining: projected.remaining },
    allowed: true,
    ticket,
    registrationUrl: registrationUrl(request),
    billingEnabled: isBillingEnabled(),
  }, now);
}
