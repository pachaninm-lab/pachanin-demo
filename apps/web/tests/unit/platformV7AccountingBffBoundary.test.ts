import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE } from '../../lib/auth-cookies';

/**
 * The accounting BFF's boundary: what it refuses.
 *
 * This is the security-carrying part of the web slice and it had no test. The
 * allowlist is the whole reason the proxy is not a way to reach every route
 * the API has from a surface whose own rules are weaker, and an allowlist
 * nobody exercises is a comment.
 *
 * The cases below are the ones that would actually be tried: a route that is
 * simply not on the list, a read path reached with POST, traversal, an
 * absolute URL smuggled through a segment, and a missing session. Each has to
 * be refused without the request ever reaching the API — which is asserted by
 * checking that fetch was never called, not only by reading the status.
 */

const fetchMock = vi.fn();

function makeRequest(cookie: string | null, query = '') {
  return {
    headers: { get: () => null },
    cookies: { get: (name: string) => (cookie && name === ACCESS_COOKIE ? { value: cookie } : undefined) },
    nextUrl: { searchParams: new URLSearchParams(query) },
    text: async () => '{}',
  } as never;
}

function context(path: string[]) {
  return { params: Promise.resolve({ path }) } as never;
}

async function loadRoute() {
  vi.resetModules();
  process.env.API_URL = 'https://api.example.test';
  return import('../../app/api/platform-v7/accounting/[[...path]]/route');
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform-v7 accounting BFF boundary', () => {
  it('refuses a route that is not on the allowlist, without calling the API', async () => {
    const { GET } = await loadRoute();
    const response = await GET(makeRequest('token'), context(['users']));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNTING_ROUTE_NOT_ALLOWED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not let a read path be reached with a write', async () => {
    // 'tasks/projection' is readable and must not become writable because the
    // two lists happen to share a prefix.
    const { POST } = await loadRoute();
    const response = await POST(makeRequest('token'), context(['tasks', 'projection']));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * Named for what it proves, after it turned out to prove something else.
   *
   * This started out as "refuses traversal", on the assumption it was
   * exercising normalizePath's `.` / `..` / separator guard. Deleting that
   * guard outright left all eight tests green, so the assumption was wrong:
   * every input below is refused by the allowlist, whose identifier charset
   * has no `/` and no `\` and cannot start with a dot. The guard is real
   * defence in depth and it is unreachable through this route surface — there
   * is no input the allowlist admits and the guard rejects.
   *
   * Which makes the guard load-bearing only if the allowlist ever widens to
   * admit a separator. Recorded here rather than left as a test that passes
   * for a reason nobody checked.
   */
  it('refuses traversal-shaped paths, by way of the allowlist', async () => {
    const { GET } = await loadRoute();
    for (const segments of [
      ['..', 'admin'],
      ['tasks', '..', '..', 'users'],
      ['deals', 'a/b', 'source-snapshot'],
      ['deals', 'a\\b', 'source-snapshot'],
      ['%2e%2e', 'admin'],
    ]) {
      const response = await GET(makeRequest('token'), context(segments));
      expect(response.status, segments.join('|')).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses an absolute URL smuggled through a segment', async () => {
    const { GET } = await loadRoute();
    const response = await GET(makeRequest('token'), context(['https://evil.test/steal']));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses before it looks at the path when there is no session', async () => {
    const { GET } = await loadRoute();
    const response = await GET(makeRequest(null), context(['tasks']));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards an allowed read and never caches the answer', async () => {
    const { GET } = await loadRoute();
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ tasks: [] }),
    });
    const response = await GET(makeRequest('token'), context(['tasks']));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toBe('https://api.example.test/accounting/tasks');
    expect(init.cache).toBe('no-store');
    expect(init.redirect).toBe('manual');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('does not follow an upstream redirect', async () => {
    const { GET } = await loadRoute();
    fetchMock.mockResolvedValue({ status: 302, json: async () => ({}) });
    const response = await GET(makeRequest('token'), context(['tasks']));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: 'UPSTREAM_REDIRECT_REJECTED' });
  });

  it('reports an unreachable API rather than an empty result', async () => {
    const { GET } = await loadRoute();
    fetchMock.mockRejectedValue(new Error('network down'));
    const response = await GET(makeRequest('token'), context(['tasks']));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNTING_SERVICE_UNAVAILABLE' });
  });
});
