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
  verifyAnonymousNotice,
  settlePending,
  type GektaAnonymousSession,
} from '@/lib/gekta/anonymous-session';
import { GEKTA_LEGAL_VERSION } from '@/lib/gekta/legal';
import { resolveAnonymousEntitlement } from '@/lib/gekta/entitlement';
import { isBillingEnabled } from '@/lib/gekta/merchant';
import { anonymousConsentHash, anonymousConsentPresentation, hasCurrentAnonymousConsent } from '@/lib/gekta/anonymous-consent-evidence';
import type { GektaLocale } from '@/lib/gekta/content';

function noticeLocale(value: unknown): GektaLocale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

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

function respond(session: GektaAnonymousSession, body: Record<string, unknown>, now: Date, status = 200) {
  const response = NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(GEKTA_ANONYMOUS_COOKIE, serializeAnonymousSession(session), cookieOptions());
  void now;
  return response;
}

function readSession(request: NextRequest, now: Date): GektaAnonymousSession {
  return parseAnonymousSession(request.cookies.get(GEKTA_ANONYMOUS_COOKIE)?.value, now) ?? createAnonymousSession(now);
}

export async function GET(request: NextRequest) {
  const now = new Date();
  const session = readSession(request, now);
  return respond(session, {
    entitlement: resolveAnonymousEntitlement({ used: session.used }, now),
    consent: session.consent ?? null,
    legalVersion: GEKTA_LEGAL_VERSION,
    consentCurrent: hasCurrentAnonymousConsent(session, now, noticeLocale(new URL(request.url).searchParams.get('lang'))),
    legalPresentation: anonymousConsentPresentation(session, noticeLocale(new URL(request.url).searchParams.get('lang')), now),
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

  const current = readSession(request, now);

  if (action === 'consent') {
    const locale = noticeLocale(payload.locale);
    const evidenceHash = anonymousConsentHash(locale);
    if (!['ru', 'en', 'zh'].includes(String(payload.locale)) || !verifyAnonymousNotice(payload.noticeSnapshot, current, evidenceHash, locale, now)) {
      return respond(current, { error: 'notice_changed', consent: null, consentCurrent: false,
        legalVersion: GEKTA_LEGAL_VERSION, legalPresentation: anonymousConsentPresentation(current, locale, now) }, now, 409);
    }
    const accepted = recordConsent(current, GEKTA_LEGAL_VERSION, now, { evidenceHash, surfaceLocale: locale });
    return respond(accepted, { entitlement: resolveAnonymousEntitlement({ used: accepted.used }, now), consent: accepted.consent,
      consentCurrent: true, legalVersion: GEKTA_LEGAL_VERSION, registrationUrl: registrationUrl(), billingEnabled: isBillingEnabled() }, now);
  }

  if (action === 'complete') {
    const ticket = typeof payload.ticket === 'string' ? payload.ticket : '';
    const settled = completeAnswer(current, ticket);
    return respond(settled, { entitlement: resolveAnonymousEntitlement({ used: settled.used }, now), registrationUrl: registrationUrl(), billingEnabled: isBillingEnabled() }, now);
  }

  // Return the current notice through the existing client decision contract.
  // Denial must not charge or replace an outstanding reservation.
  if (!hasCurrentAnonymousConsent(current, now)) {
    return respond(current, {
      allowed: false,
      ticket: null,
      reason: 'consent_required',
      consent: null,
      legalVersion: GEKTA_LEGAL_VERSION,
      consentCurrent: false,
      legalPresentation: anonymousConsentPresentation(current, noticeLocale(current.consent?.surfaceLocale), now),
      entitlement: resolveAnonymousEntitlement({ used: current.used }, now),
      registrationUrl: registrationUrl(),
      billingEnabled: isBillingEnabled(),
    }, now);
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
