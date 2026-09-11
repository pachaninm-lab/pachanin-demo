import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTROL_PLATFORM_HOST,
  PRIMARY_PLATFORM_HOST,
  controlHostEnabled,
  controlHostUrl,
  isControlHostRequest,
  isControlRealmPathAllowed,
  normalizeAuthorityHost,
  requestAuthorityHost,
  requiresCanonicalControlHost,
} from '@/lib/platform-v7/control-host';

function source(path: string) {
  const root = process.cwd().endsWith('/apps/web')
    ? resolve(process.cwd(), '..', '..')
    : process.cwd();
  return readFileSync(resolve(root, path), 'utf8');
}

function request(host: string, forwardedHost?: string) {
  const headers = new Headers({ host });
  if (forwardedHost) headers.set('x-forwarded-host', forwardedHost);
  return { headers } as Pick<Request, 'headers'>;
}

const middleware = source('apps/web/middleware.ts');
const sessionResponse = source('apps/web/lib/server/auth-session-response.ts');
const loginRoute = source('apps/web/app/api/auth/login/route.ts');
const mfaRoute = source('apps/web/app/api/auth/mfa-login/route.ts');
const membershipRoute = source('apps/web/app/api/auth/membership-select/route.ts');
const refreshRoute = source('apps/web/app/api/auth/refresh/route.ts');
const logoutRoute = source('apps/web/app/api/auth/logout/route.ts');
const staffProxy = source('apps/web/app/api/staff/[...path]/route.ts');
const capabilitiesBff = source('apps/web/app/api/staff/capabilities/me/route.ts');
const controlHelper = source('apps/web/lib/platform-v7/control-host.ts');

describe('Company OS F2A control host boundary', () => {
  it('recognizes only canonical host authority and validates an optional numeric port', () => {
    expect(normalizeAuthorityHost(CONTROL_PLATFORM_HOST)).toBe(CONTROL_PLATFORM_HOST);
    expect(normalizeAuthorityHost(`${CONTROL_PLATFORM_HOST}:443`)).toBe(CONTROL_PLATFORM_HOST);
    expect(normalizeAuthorityHost(`${CONTROL_PLATFORM_HOST}.`)).toBe(CONTROL_PLATFORM_HOST);
    expect(normalizeAuthorityHost(`${CONTROL_PLATFORM_HOST}.evil.example`)).toBe(`${CONTROL_PLATFORM_HOST}.evil.example`);
    expect(normalizeAuthorityHost(`${CONTROL_PLATFORM_HOST}:0`)).toBe('');
    expect(normalizeAuthorityHost(`${CONTROL_PLATFORM_HOST}:99999`)).toBe('');
    expect(normalizeAuthorityHost(`${CONTROL_PLATFORM_HOST}:443,evil.example`)).toBe('');
    expect(normalizeAuthorityHost(` ${CONTROL_PLATFORM_HOST} evil.example`)).toBe('');
    expect(normalizeAuthorityHost(`user@${CONTROL_PLATFORM_HOST}`)).toBe('');
  });

  it('is disabled by default and does not trust X-Forwarded-Host as authority', () => {
    expect(controlHostEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isControlHostRequest(request(CONTROL_PLATFORM_HOST), {} as NodeJS.ProcessEnv)).toBe(false);
    expect(isControlHostRequest(
      request(PRIMARY_PLATFORM_HOST, CONTROL_PLATFORM_HOST),
      { PC_CONTROL_HOST_ENABLED: 'true' } as NodeJS.ProcessEnv,
    )).toBe(false);
    expect(requestAuthorityHost(request(PRIMARY_PLATFORM_HOST, CONTROL_PLATFORM_HOST))).toBe(PRIMARY_PLATFORM_HOST);
    expect(controlHelper).not.toContain("headers.get('x-forwarded-host')");
  });

  it('requires the exact control host for staff BFFs only after cutover is enabled', () => {
    const enabled = { PC_CONTROL_HOST_ENABLED: 'true' } as NodeJS.ProcessEnv;
    expect(requiresCanonicalControlHost(request(PRIMARY_PLATFORM_HOST), enabled)).toBe(true);
    expect(requiresCanonicalControlHost(request(`staff.${PRIMARY_PLATFORM_HOST}`), enabled)).toBe(true);
    expect(requiresCanonicalControlHost(request(CONTROL_PLATFORM_HOST), enabled)).toBe(false);
    expect(requiresCanonicalControlHost(request(PRIMARY_PLATFORM_HOST), {} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('keeps the control realm route allowlist narrow', () => {
    for (const allowed of [
      '/platform-v7/login',
      '/platform-v7/forgot-password',
      '/platform-v7/reset-password',
      '/platform-v7/mfa-recovery',
      '/platform-v7/staff',
      '/platform-v7/staff/prepare',
      '/api/auth/login',
      '/api/auth/mfa-login',
      '/api/auth/mfa-login/cancel',
      '/api/auth/membership-select',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/auth/me',
      '/api/auth/mfa-step-up',
      '/api/staff/capabilities/me',
      '/api/staff/access/requests',
      '/logo.svg',
    ]) {
      expect(isControlRealmPathAllowed(allowed), allowed).toBe(true);
    }

    for (const denied of [
      '/platform-v7/register',
      '/platform-v7/buyer',
      '/platform-v7/seller',
      '/platform-v7/profile',
      '/platform-v7/demo',
      '/platform-v7/role-preview/owner',
      '/api/agro-chat',
      '/api/auth/demo',
      '/api/auth/register',
      '/api/auth/registration/application',
      '/api/platform-v7/leads',
      '/gekta',
    ]) {
      expect(isControlRealmPathAllowed(denied), denied).toBe(false);
    }
  });

  it('builds only HTTPS canonical control URLs', () => {
    expect(controlHostUrl('/platform-v7/staff', '?tab=people')).toBe(
      `https://${CONTROL_PLATFORM_HOST}/platform-v7/staff?tab=people`,
    );
  });

  it('makes middleware a separate fail-closed control realm without presentation-role authority', () => {
    expect(middleware).toContain('if (controlHostEnabled())');
    expect(middleware).toContain('if (isControlHostRequest(req))');
    expect(middleware).toContain("p === '/api/staff' || p.startsWith('/api/staff/')");
    expect(middleware).toContain("code: 'CONTROL_HOST_REQUIRED'");
    expect(middleware).toContain("requestHeaders.delete('x-pc-role')");
    expect(middleware).toContain("requestHeaders.delete('x-pc-owner-key')");
    expect(middleware).toContain("requestHeaders.set('x-pc-control-realm', 'true')");
    expect(middleware).toContain("ensureCsrfCookie(req, response, 'strict')");
    expect(middleware).toContain('NextResponse.redirect(controlHostUrl(p, req.nextUrl.search), 308)');
    expect(middleware).toContain("p === '/platform-v7/register'");
    expect(middleware).toContain('NextResponse.redirect(primaryPlatformUrl(p, req.nextUrl.search), 308)');
  });

  it('issues strict host-only control-plane session cookies without introducing a Domain attribute', () => {
    expect(sessionResponse).toContain("sameSite: controlPlane ? 'strict' : 'lax'");
    expect(sessionResponse).toContain("redirectTo: controlPlane ? '/platform-v7/staff'");
    expect(sessionResponse).toContain('sameSiteForSession(cookieSecurity(), controlPlane)');
    expect(sessionResponse).toContain('sameSiteForSession(csrfCookieSecurity(), controlPlane)');
    expect(sessionResponse).not.toMatch(/\bdomain\s*:/i);
    expect(staffProxy).toContain("sameSite: 'strict' as const");
    expect(staffProxy).not.toMatch(/\bdomain\s*:/i);
  });

  it('binds every session-producing auth route to the control realm and staff landing', () => {
    for (const route of [loginRoute, mfaRoute, membershipRoute]) {
      expect(route).toContain('isControlHostRequest(request)');
      expect(route).toContain("controlPlane ? '/platform-v7/staff'");
      expect(route).toContain('{ controlPlane }');
    }
    expect(refreshRoute).toContain('isControlHostRequest(request)');
    expect(refreshRoute).toContain('{ controlPlane }');
    expect(logoutRoute).toContain('isControlHostRequest(request)');
    expect(logoutRoute).toContain('clearAuthenticatedSession(result, { controlPlane })');
    expect(loginRoute).toContain('control_plane_login_success');
    expect(mfaRoute).toContain('control_plane_mfa_success');
    expect(logoutRoute).toContain('control_plane_logout_success');
  });

  it('adds defense-in-depth canonical-host enforcement to both staff BFFs', () => {
    expect(staffProxy).toContain('requiresCanonicalControlHost(request)');
    expect(staffProxy).toContain("code: 'CONTROL_HOST_REQUIRED'");
    expect(capabilitiesBff).toContain('requiresCanonicalControlHost(request)');
    expect(capabilitiesBff).toContain("code: 'CONTROL_HOST_REQUIRED'");
  });

  it('contains no office-network or IP allowlist privilege shortcut in the control authority helper', () => {
    expect(controlHelper).not.toMatch(/allowlist|office|trusted.?ip|cidr|x-real-ip|cf-connecting-ip/i);
  });
});
