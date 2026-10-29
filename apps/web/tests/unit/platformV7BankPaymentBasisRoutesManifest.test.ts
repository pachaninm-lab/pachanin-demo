// @vitest-environment node
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import IntegrationsPage from '@/app/platform-v7/integrations/page';
import { LOCALE_COOKIE } from '@/i18n/locale';
import { ACCESS_COOKIE, CSRF_COOKIE } from '@/lib/auth-cookies';
import { readVerifiedCabinetSessionContext, signCabinetSession } from '@/lib/platform-v7/verified-session';
import { PLATFORM_V7_INTEGRATIONS_ROUTE, PLATFORM_V7_CONNECTORS_ROUTE } from '@/lib/platform-v7/routes';
import { PLATFORM_V7_ROUTES_MANIFEST, CRITICAL_ROUTES, MANIFEST_ROLES } from '@/lib/platform-v7/routes-manifest';
import type { RouteEntry } from '@/lib/platform-v7/routes-manifest';

const SHELL_FILES = [
  'lib/platform-v7/routes-manifest.ts',
  'lib/platform-v7/support-contour-smoke.ts',
];

// The fallback runs before the client is rendered. Keep its request metadata
// injectable while exercising the real middleware, signed session and redirect.
const entry = vi.hoisted(() => ({ cookies: vi.fn(), headers: vi.fn(), locale: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: entry.cookies, headers: entry.headers }));
vi.mock('next-intl/server', () => ({ getLocale: entry.locale }));
vi.mock('@/components/crop-platform/IntegrationControlTowerClient', () => ({
  IntegrationControlTowerClient: () => null,
}));

describe('bank basis canonical route and routes manifest', () => {
  for (const file of SHELL_FILES) {
    it(`${file} exists and has no direct network calls`, () => {
      expect(existsSync(file)).toBe(true);
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
      expect(src).not.toMatch(/http\s*\./);
    });
  }

  it('does not retain the deleted fixture-backed payment basis action', () => {
    expect(existsSync('lib/platform-v7/bank-payment-basis-runtime-action.ts')).toBe(false);
    expect(existsSync('components/platform-v7/P7BankPaymentBasisRuntimePanel.tsx')).toBe(false);
  });

  it('keeps routes manifest structured and unique', () => {
    expect(PLATFORM_V7_ROUTES_MANIFEST.length).toBeGreaterThan(5);
    for (const entry of PLATFORM_V7_ROUTES_MANIFEST) {
      expect(entry.path).toMatch(/^\/platform-v7\//);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.roles.length).toBeGreaterThan(0);
      expect(typeof entry.critical).toBe('boolean');
    }
    const paths = PLATFORM_V7_ROUTES_MANIFEST.map((entry: RouteEntry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps critical routes and manifest roles derived from the manifest', () => {
    const criticalFromManifest = PLATFORM_V7_ROUTES_MANIFEST.filter((entry: RouteEntry) => entry.critical).map((entry: RouteEntry) => entry.path);
    expect(CRITICAL_ROUTES).toEqual(criticalFromManifest);
    expect(CRITICAL_ROUTES).toContain('/platform-v7/control-tower');
    expect(CRITICAL_ROUTES).toContain('/platform-v7/driver');
    expect(MANIFEST_ROLES.length).toBeGreaterThan(5);
    expect(new Set(MANIFEST_ROLES).size).toBe(MANIFEST_ROLES.length);
  });
});

describe('protected integrations entry and explicit locale', () => {
  const secret = 'protected-entry-regression-only-secret-5580';
  const origin = 'https://example.test';
  const locales = ['ru', 'en', 'zh'] as const;
  const deniedCases = [
    { role: null, destination: '/platform-v7/login' },
    { role: 'buyer', destination: '/platform-v7/buyer' },
    { role: 'organization', destination: '/platform-v7/profile' },
  ] as const;

  beforeEach(() => {
    vi.stubEnv('PC_PRIVATE_MODE', 'off');
    vi.stubEnv('PC_CONTROL_HOST_ENABLED', 'false');
    vi.stubEnv('JWT_SECRET', secret);
    entry.cookies.mockReset().mockResolvedValue({ get: () => undefined });
    entry.headers.mockReset().mockResolvedValue(new Headers());
    entry.locale.mockReset().mockResolvedValue('ru');
  });

  afterEach(() => vi.unstubAllEnvs());

  async function request(search: string, role: string | null, previousLocale = 'zh', extraHeaders = {}) {
    const token = role === null ? null : await signCabinetSession(role, secret, {
      nowSeconds: Math.floor(Date.now() / 1000), ttlSeconds: 60,
      userId: 'entry-test-user', membershipId: 'entry-test-membership',
      organizationId: 'entry-test-org', tenantId: 'entry-test-tenant',
    });
    if (role !== null) {
      expect(token).toBeTypeOf('string');
      expect(await readVerifiedCabinetSessionContext(token, secret, Math.floor(Date.now() / 1000))).toMatchObject({ role });
    }
    const req = new NextRequest(`${origin}${PLATFORM_V7_INTEGRATIONS_ROUTE}${search}`, {
      headers: {
        cookie: `${LOCALE_COOKIE}=${previousLocale}; pc-v7-locale-selection-v1=${previousLocale}${token ? `; pc_v7_cabinet=${token}` : ''}`,
        ...extraHeaders,
      },
    });
    expect(process.env.JWT_SECRET).toBe(secret);
    if (token) expect(req.cookies.get('pc_v7_cabinet')?.value).toBe(token);
    return req;
  }

  function privateResponse(response: Response) {
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  }

  for (const { role, destination } of deniedCases) {
    for (const locale of locales) {
      it.each(locales)(`${role ?? 'anonymous'} denial preserves ${locale} over previous %s selection`, async (previousLocale) => {
        const search = `?lang=${locale}&as=compliance&role=compliance&next=https%3A%2F%2Foutside.test%2F`;
        const req = await request(search, role, previousLocale);
        const response = await middleware(req);
        expect(response.status).toBe(307);
        const target = new URL(response.headers.get('location')!);
        expect(target.origin).toBe(origin);
        expect(target.pathname).toBe(destination);
        expect(target.searchParams.get('lang')).toBe(locale);
        expect(target.searchParams.get('as')).toBeNull();
        expect(target.searchParams.get('role')).toBeNull();
        expect(target.searchParams.get('next')).toBe(role === null ? `${PLATFORM_V7_INTEGRATIONS_ROUTE}${search}` : null);
        privateResponse(response);
        const landing = await middleware(new NextRequest(target, {
          headers: { cookie: req.headers.get('cookie')! },
        }));
        expect(landing.status).toBe(200);
        expect(landing.headers.get('x-pc-locale')).toBe(locale);
      });
    }
  }

  for (const { role, destination } of deniedCases) {
    it.each(['', '?lang=de', '?lang=', '?lang=EN', '?lang=de&lang=en'])(
      `${role ?? 'anonymous'} denial refuses unsupported or later repeated locale in %s`, async (search) => {
        const response = await middleware(await request(search, role));
        expect(response.status).toBe(307);
        const target = new URL(response.headers.get('location')!);
        expect(target.pathname).toBe(destination);
        expect(target.searchParams.has('lang')).toBe(false);
        expect(target.searchParams.get('next')).toBe(role === null ? `${PLATFORM_V7_INTEGRATIONS_ROUTE}${search}` : null);
        privateResponse(response);
      },
    );
  }

  it.each(locales)('passes allowed compliance with %s metadata and preserves cookie-missing fallback', async (locale) => {
    const search = `?lang=${locale}&filter=failed&next=https%3A%2F%2Foutside.test%2F`;
    const response = await middleware(await request(search, 'compliance', 'zh', {
      'x-pc-search': '?lang=ru&as=buyer', 'x-pc-role': 'buyer',
    }));
    expect(response.status).toBe(200);
    expect(response.headers.has('location')).toBe(false);
    expect(response.headers.get('x-middleware-request-x-pc-role')).toBe('compliance');
    expect(response.headers.get('x-middleware-request-x-pc-search')).toBe(search);
    expect(response.headers.get('x-pc-locale')).toBe(locale);
    privateResponse(response);

    entry.headers.mockResolvedValue(new Headers({
      'x-pc-search': response.headers.get('x-middleware-request-x-pc-search')!,
    }));
    const target = new URL(`${origin}/platform-v7/login`);
    target.searchParams.set('next', `${PLATFORM_V7_INTEGRATIONS_ROUTE}${search}`);
    target.searchParams.set('lang', locale);
    await expect(IntegrationsPage()).rejects.toMatchObject({
      digest: `NEXT_REDIRECT;replace;${target.pathname}${target.search};307;`,
    });
    expect(entry.locale).not.toHaveBeenCalled();
  });

  it.each(['', '?lang=de', '?lang=EN', '?lang=de&lang=en'])('page fallback retains query without promoting invalid locale: %s', async (search) => {
    entry.headers.mockResolvedValue(new Headers({ 'x-pc-search': search }));
    const params = new URLSearchParams({ next: `${PLATFORM_V7_INTEGRATIONS_ROUTE}${search}` });
    await expect(IntegrationsPage()).rejects.toMatchObject({
      digest: `NEXT_REDIRECT;replace;/platform-v7/login?${params.toString()};307;`,
    });
    expect(entry.locale).not.toHaveBeenCalled();
  });

  it('uses the first valid query locale consistently in both denial and page fallback', async () => {
    const search = '?lang=en&lang=zh';
    const response = await middleware(await request(search, null));
    expect(new URL(response.headers.get('location')!).searchParams.get('lang')).toBe('en');
    entry.headers.mockResolvedValue(new Headers({ 'x-pc-search': search }));
    const params = new URLSearchParams({ next: `${PLATFORM_V7_INTEGRATIONS_ROUTE}${search}`, lang: 'en' });
    await expect(IntegrationsPage()).rejects.toMatchObject({
      digest: `NEXT_REDIRECT;replace;/platform-v7/login?${params.toString()};307;`,
    });
  });

  it('keeps the existing signed-in server render and CSRF prop', async () => {
    entry.cookies.mockResolvedValue({ get: (name: string) => (
      name === ACCESS_COOKIE ? { value: 'entry-access-cookie' }
        : name === CSRF_COOKIE ? { value: 'entry-csrf-cookie' } : undefined
    ) });
    entry.locale.mockResolvedValue('en');
    const page = await IntegrationsPage();
    expect(page.props['data-testid']).toBe('integration-control-tower-page');
    expect(page.props.children.props).toMatchObject({ locale: 'en', csrfToken: 'entry-csrf-cookie' });
    expect(entry.headers).not.toHaveBeenCalled();
  });

  it('keeps control-realm refusal unchanged for the integrations entry', async () => {
    vi.stubEnv('PC_CONTROL_HOST_ENABLED', 'true');
    const req = new NextRequest(`https://control.xn----8sbjf4befbjgs9b.xn--p1ai${PLATFORM_V7_INTEGRATIONS_ROUTE}?lang=en`, {
      headers: { host: 'control.xn----8sbjf4befbjgs9b.xn--p1ai' },
    });
    expect(req.headers.get('host')).toBe('control.xn----8sbjf4befbjgs9b.xn--p1ai');
    expect(process.env.PC_CONTROL_HOST_ENABLED).toBe('true');
    const response = await middleware(req);
    expect(response.status).toBe(404);
    expect(response.headers.has('location')).toBe(false);
    privateResponse(response);
  });

  it('keeps an unconfigured private deployment locked before cabinet entry', async () => {
    vi.stubEnv('PC_PRIVATE_MODE', 'on');
    vi.stubEnv('PC_OWNER_KEY', '');
    vi.stubEnv('PC_PRIVATE_PASSWORD', '');
    const response = await middleware(await request('?lang=en', 'compliance'));
    expect(response.status).toBe(503);
    expect(response.headers.has('location')).toBe(false);
    privateResponse(response);
  });

  it('requires private-owner access and still denies a missing cabinet session', async () => {
    vi.stubEnv('PC_PRIVATE_MODE', 'on');
    vi.stubEnv('PC_OWNER_KEY', 'entry-regression-private-owner-key');
    vi.stubEnv('PC_PRIVATE_PASSWORD', '');
    const denied = await middleware(await request('?lang=en', null));
    expect(denied.status).toBe(401);
    privateResponse(denied);
    const response = await middleware(await request('?lang=en', null, 'zh', {
      'x-pc-owner-key': 'entry-regression-private-owner-key',
    }));
    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location')!);
    expect(target.pathname).toBe('/platform-v7/login');
    expect(target.searchParams.get('lang')).toBe('en');
    privateResponse(response);
  });

  it('loads the actual Next redirect table and keeps integrations distinct from connectors', async () => {
    const nextConfig = createRequire(import.meta.url)(resolve(process.cwd(), 'next.config.js'));
    const redirects = await nextConfig.redirects();
    expect(PLATFORM_V7_INTEGRATIONS_ROUTE).not.toBe(PLATFORM_V7_CONNECTORS_ROUTE);
    expect(redirects.some((route: { source: string }) => route.source === PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(false);
    expect(redirects).toContainEqual({ source: '/platform-v7/marketplace', destination: '/platform-v7/lots', permanent: true });
    expect(redirects).toContainEqual({ source: '/platform-v7/deals/:id', destination: '/platform-v7/deals/:id/clean', permanent: false });
  });
});
