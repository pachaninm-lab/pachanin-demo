import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// These demo-login routes previously trusted `raw.startsWith('/')` to decide
// whether a caller-supplied "to" destination was safe to redirect to. A
// protocol-relative destination (`//evil.example/...`) and its backslash form both
// start with exactly one slash and both resolve, under the URL algorithm every
// browser implements, to a foreign origin — see serverRequestSecurity.test.ts for
// the unit-level proof. This file proves the fix end to end: the actual HTTP
// response these routes produce, not just the helper they now call.
//
// All three routes are fail-closed in production regardless (demoLoginAllowed() checks
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

// The instant route does not answer with a Location header: it returns an HTML
// page whose inline script sets the demo cookies and then calls
// `window.location.replace(<destination>)`. The browser resolves that value
// against the page it is on, so what must be proven is where the emitted
// literal navigates, not only which string was chosen.
describe('GET /api/auth/demo/instant/[role] — open redirect', () => {
  const PAGE_URL = 'https://web.example/api/auth/demo/instant/farmer';

  async function emittedDestination(to?: string) {
    enableDemoLogin();
    const { GET } = await import('../../app/api/auth/demo/instant/[role]/route');
    const query = to === undefined ? '' : `?to=${encodeURIComponent(to)}`;
    const response = await GET(new NextRequest(`${PAGE_URL}${query}`), {
      params: Promise.resolve({ role: 'farmer' }),
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    const match = html.match(/window\.location\.replace\((.*)\);/);
    expect(match).not.toBeNull();
    const literal = JSON.parse(match![1]) as string;
    return { literal, navigatesTo: new URL(literal, PAGE_URL) };
  }

  it('navigates to the role default page when no destination is given', async () => {
    const { literal, navigatesTo } = await emittedDestination();
    expect(literal).toBe('/lots');
    expect(navigatesTo.origin).toBe('https://web.example');
  });

  it('navigates to the requested same-origin path', async () => {
    const { literal } = await emittedDestination('/cabinet');
    expect(literal).toBe('/cabinet');
  });

  it('does not navigate to a protocol-relative destination off the application', async () => {
    const { literal, navigatesTo } = await emittedDestination('//evil.example/steal');
    expect(literal).toBe('/lots');
    expect(navigatesTo.origin).toBe('https://web.example');
  });

  it('does not navigate to a backslash-prefixed destination off the application', async () => {
    const { literal, navigatesTo } = await emittedDestination('/\\evil.example/steal');
    expect(literal).toBe('/lots');
    expect(navigatesTo.origin).toBe('https://web.example');
  });

  it('does not navigate to an absolute cross-origin destination', async () => {
    const { literal } = await emittedDestination('https://evil.example/steal');
    expect(literal).toBe('/lots');
  });

  // `/.//evil.example` resolves same-origin, but its normalized pathname is
  // `//evil.example/steal`. Emitted as a relative reference, that pathname would
  // be protocol-relative and leave the application, so it must fall back.
  it('does not emit a dot-segment destination whose normalized path is protocol-relative', async () => {
    const { literal, navigatesTo } = await emittedDestination('/.//evil.example/steal');
    expect(literal).toBe('/lots');
    expect(navigatesTo.origin).toBe('https://web.example');
  });

  // Script content is raw text, so the old HTML-entity escaping reached the
  // browser as a literal `&amp;` and corrupted every query string with `&`.
  it('preserves a same-origin query string and fragment exactly', async () => {
    const { literal } = await emittedDestination('/lots?a=1&b=2#top');
    expect(literal).toBe('/lots?a=1&b=2#top');
  });

  it('cannot close the inline script element from the destination', async () => {
    enableDemoLogin();
    const { GET } = await import('../../app/api/auth/demo/instant/[role]/route');
    const response = await GET(
      new NextRequest(`${PAGE_URL}?to=${encodeURIComponent('/lots#</script><script>alert(1)</script>')}`),
      { params: Promise.resolve({ role: 'farmer' }) },
    );
    const html = await response.text();
    expect(html.match(/<\/script>/gi)).toHaveLength(1);
  });

  it('stays disabled in production regardless of the destination', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PLATFORM_V7_ALLOW_DEMO_LOGIN', 'true');
    const { GET } = await import('../../app/api/auth/demo/instant/[role]/route');
    const response = await GET(new NextRequest(`${PAGE_URL}?to=//evil.example/steal`), {
      params: Promise.resolve({ role: 'farmer' }),
    });
    expect(response.status).toBe(503);
  });
});
