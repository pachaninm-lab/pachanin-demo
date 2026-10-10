import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule } from 'typescript';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/gekta/entitlement/route';
import { GEKTA_ANONYMOUS_COOKIE, parseAnonymousSession, serializeAnonymousSession } from '@/lib/gekta/anonymous-session';
import { hasCurrentAnonymousConsent } from '@/lib/gekta/anonymous-consent-evidence';
import { GEKTA_LEGAL_VERSION } from '@/lib/gekta/legal';
import * as legal from '@/lib/gekta/legal';

function request(cookie?: string, body?: unknown, locale = 'ru'): NextRequest {
  return { url: `https://example.test/api/gekta/entitlement?lang=${locale}`,
    headers: new Headers({ 'sec-fetch-site': 'same-origin' }),
    cookies: { get: (name: string) => name === GEKTA_ANONYMOUS_COOKIE && cookie ? { value: cookie } : undefined },
    json: async () => body } as unknown as NextRequest;
}
function cookie(response: Response): string {
  return decodeURIComponent(/gekta_anon=([^;]+)/u.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '');
}
async function presentation(locale = 'ru') {
  const response = await GET(request(undefined, undefined, locale));
  const body = await response.json();
  return { cookie: cookie(response), notice: body.legalPresentation };
}

describe('Actual anonymous document/profile/session commitment', () => {
  beforeEach(() => {
    vi.stubEnv('GEKTA_ANONYMOUS_SESSION_SECRET', 'own-synthetic-notice-key-32-characters');
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it.each(['ru', 'en', 'zh'])('binds the real %s interface and Russian document pair to the cookie session', async locale => {
    const shown = await presentation(locale);
    expect(shown.notice.termsHref).toMatch(/\/legal\/usloviya-ispolzovaniya-gekta\?v=.*&h=[0-9a-f]{64}&p=[0-9a-f]{64}/u);
    expect(shown.notice.privacyHref).toMatch(/\/legal\/politika-konfidencialnosti\?v=.*&h=[0-9a-f]{64}&p=[0-9a-f]{64}/u);
    const accepted = await POST(request(shown.cookie, { action: 'consent', locale, noticeSnapshot: shown.notice.snapshot }));
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).consentCurrent).toBe(true);
    const session = parseAnonymousSession(cookie(accepted))!;
    expect(session.consent).toMatchObject({ version: GEKTA_LEGAL_VERSION, surfaceLocale: locale, evidenceHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u) });
    expect(hasCurrentAnonymousConsent(session)).toBe(true);
    expect(cookie(accepted).length).toBeLessThan(1_024);
    const reserve = await POST(request(cookie(accepted), { action: 'reserve' }));
    expect((await reserve.json()).allowed).toBe(true);
  });

  it.each(['missing', 'tampered', 'other-session', 'other-locale', 'expired'])('rejects %s notice before changing quota or pending', async kind => {
    const shown = await presentation();
    let rawCookie = shown.cookie;
    let token: unknown = shown.notice.snapshot;
    let locale = 'ru';
    if (kind === 'missing') token = undefined;
    if (kind === 'tampered') token = `x${shown.notice.snapshot}`;
    if (kind === 'other-session') rawCookie = (await presentation()).cookie;
    if (kind === 'other-locale') locale = 'en';
    if (kind === 'expired') { vi.useFakeTimers(); vi.setSystemTime(Date.now() + 15 * 60_000); }
    const initial = parseAnonymousSession(rawCookie)!;
    const seeded = { ...initial, used: 2, pending: 'own-existing-reservation' };
    const response = await POST(request(serializeAnonymousSession(seeded), { action: 'consent', locale, noticeSnapshot: token }));
    expect(response.status).toBe(409);
    expect(parseAnonymousSession(cookie(response))).toMatchObject({ sid: initial.sid, used: 2, pending: seeded.pending, consent: null });
    expect((await response.json()).consentCurrent).toBe(false);
  });

  it.each(['profile', 'document'])('invalidates an old %s even when the legal version is unchanged', async change => {
    const shown = await presentation();
    const accepted = await POST(request(shown.cookie, { action: 'consent', locale: 'ru', noticeSnapshot: shown.notice.snapshot }));
    expect(accepted.status).toBe(200);
    const old = parseAnonymousSession(cookie(accepted))!;
    if (change === 'profile') vi.stubEnv('GEKTA_MERCHANT_LEGAL_NAME', 'Own synthetic test operator');
    else {
      const original = legal.getGektaLegalDocument;
      vi.spyOn(legal, 'getGektaLegalDocument').mockImplementation(slug => {
        const value = original(slug);
        return value && slug === 'usloviya-ispolzovaniya-gekta' ? { ...value, summary: `${value.summary} Own changed public test document.` } : value;
      });
    }
    expect(hasCurrentAnonymousConsent(old)).toBe(false);
    const rejected = await POST(request(shown.cookie, { action: 'consent', locale: 'ru', noticeSnapshot: shown.notice.snapshot }));
    expect(rejected.status).toBe(409);
    const seeded = { ...old, used: 2, pending: 'own-existing-reservation' };
    const reserve = await POST(request(serializeAnonymousSession(seeded), { action: 'reserve' }));
    expect(await reserve.json()).toMatchObject({ allowed: false, reason: 'consent_required' });
    expect(parseAnonymousSession(cookie(reserve))).toMatchObject({ sid: old.sid, used: 2, pending: seeded.pending });
  });

  it.each(['success', 'rejected', 'transport'])('the actual client hides the notice only after a confirmed %s response', async outcome => {
    const source = readFileSync('components/gekta/GektaChatWorkspace.tsx', 'utf8');
    const start = source.indexOf('const acceptConsent = React.useCallback(');
    const endMarker = '}, [locale, legalPresentation, acceptingConsent, applyEntitlement]);';
    const end = source.indexOf(endMarker, start);
    expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start);
    const setConsentRequired = vi.fn(); const track = vi.fn();
    const fetch = vi.fn(async (_url, init) => {
      expect(JSON.parse(init.body)).toEqual({ action: 'consent', locale: 'ru', noticeSnapshot: 'own-public-commitment' });
      if (outcome === 'transport') throw new Error('own transport failure');
      return new Response(JSON.stringify({ consentCurrent: outcome === 'success' }), { status: outcome === 'success' ? 200 : 409 });
    });
    const applyEntitlement = vi.fn(payload => { if (payload.consentCurrent === true) setConsentRequired(false); });
    const code = transpileModule(`${source.slice(start, end + endMarker.length)}\nglobalThis.result = acceptConsent();`, {}).outputText;
    await runInNewContext(`${code}\nglobalThis.result`, { React: { useCallback: fn => fn }, locale: 'ru', acceptingConsent: false,
      legalPresentation: { locale: 'ru', snapshot: 'own-public-commitment' }, fetch, applyEntitlement, track,
      setConsentRequired, setAcceptingConsent: vi.fn(), setConsentError: vi.fn() }, { timeout: 1_000 });
    if (outcome === 'success') { expect(setConsentRequired).toHaveBeenCalledWith(false); expect(track).toHaveBeenCalledOnce(); }
    else { expect(setConsentRequired).not.toHaveBeenCalledWith(false); expect(setConsentRequired).toHaveBeenCalledWith(true); expect(track).not.toHaveBeenCalled(); }
  });
});
