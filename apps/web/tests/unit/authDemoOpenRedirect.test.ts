import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// These two demo-login routes previously trusted `raw.startsWith('/')` to decide
// whether a caller-supplied "to" destination was safe to redirect to. A
// protocol-relative destination (`//evil.example/...`) and its backslash form both
// start with exactly one slash and both resolve, under the URL algorithm every
// browser implements, to a foreign origin — see serverRequestSecurity.test.ts for
// the unit-level proof. This file proves the fix end to end: the actual HTTP
// response these routes produce, not just the helper they now call.
//
// Both routes are fail-closed in production regardless (demoLoginAllowed() checks
// NODE_ENV first), so this exploit was never reachable there. It is exercised here
// with demo login explicitly enabled, which is the one configuration where it
// would have mattered.

const originalEnv = { ...process.env };

function enableDemoLogin() {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('PLATFORM_V7_ALLOW_DEMO_LOGIN', 'true');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
});

describe('GET /api/auth/demo — open redirect', () => {
  async function callWithTo(to: string) {
    enableDemoLogin();
    const { GET } = await import('../../app/api/auth/demo/route');
    const request = new NextRequest(
      `https://web.example/api/auth/demo?email=farmer@demo.ru&to=${encodeURIComponent(to)}`,
    );
    return GET(request);
  }

  it('redirects to the requested same-origin path', async () => {
    const response = await callWithTo('/lots');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://web.example/lots');
  });

  it('does not follow a protocol-relative destination off the application', async () => {
    const response = await callWithTo('//evil.example/steal');
    expect(response.headers.get('location')).toBe('https://web.example/');
  });

  it('does not follow a backslash-prefixed destination off the application', async () => {
    const response = await callWithTo('/\\evil.example/steal');
    expect(response.headers.get('location')).toBe('https://web.example/');
  });

  it('does not follow an absolute cross-origin destination', async () => {
    const response = await callWithTo('https://evil.example/steal');
    expect(response.headers.get('location')).toBe('https://web.example/');
  });

  it('stays disabled in production regardless of the destination', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PLATFORM_V7_ALLOW_DEMO_LOGIN', 'true');
    const { GET } = await import('../../app/api/auth/demo/route');
    const request = new NextRequest('https://web.example/api/auth/demo?to=//evil.example/steal');
    const response = await GET(request);
    expect(response.status).toBe(503);
  });
});

describe('GET /api/auth/demo/role/[role] — open redirect', () => {
  async function callWithTo(to: string) {
    enableDemoLogin();
    const { GET } = await import('../../app/api/auth/demo/role/[role]/route');
    const request = new NextRequest(
      `https://web.example/api/auth/demo/role/farmer?to=${encodeURIComponent(to)}`,
    );
    return GET(request, { params: Promise.resolve({ role: 'farmer' }) });
  }

  it('redirects to the role default page when no destination is given', async () => {
    enableDemoLogin();
    const { GET } = await import('../../app/api/auth/demo/role/[role]/route');
    const request = new NextRequest('https://web.example/api/auth/demo/role/farmer');
    const response = await GET(request, { params: Promise.resolve({ role: 'farmer' }) });
    expect(response.headers.get('location')).toBe('https://web.example/lots');
  });

  it('redirects to the requested same-origin path', async () => {
    const response = await callWithTo('/cabinet');
    expect(response.headers.get('location')).toBe('https://web.example/cabinet');
  });

  it('does not follow a protocol-relative destination off the application', async () => {
    const response = await callWithTo('//evil.example/steal');
    expect(response.headers.get('location')).toBe('https://web.example/lots');
  });

  it('does not follow a backslash-prefixed destination off the application', async () => {
    const response = await callWithTo('/\\evil.example/steal');
    expect(response.headers.get('location')).toBe('https://web.example/lots');
  });

  it('does not follow an absolute cross-origin destination', async () => {
    const response = await callWithTo('https://evil.example/steal');
    expect(response.headers.get('location')).toBe('https://web.example/lots');
  });
});
