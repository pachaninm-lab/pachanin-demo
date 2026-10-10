// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { encodeUpstreamPath } from '../../lib/server/upstream-path';

// Next.js decodes each catch-all segment once before a route handler sees it
// (next/dist/shared/lib/router/utils/route-matcher.js). The segment values below
// are therefore what a handler receives, not what a browser sent: `%2e%2e` here
// is the raw request `%252e%252e`, and `x?a=1#` is the raw `x%3Fa%3D1%23`.
//
// Both proxies used to concatenate those decoded values straight into the
// upstream URL, where fetch() parses them again. A `?` or `#` then moves the rest
// of the path into a query or a fragment, and `%2e%2e` is a dot-segment that
// walks the upstream path. Measured before the fix: /api/staff forwarded
// organizations/%2e%2e/users as /api/staff/users, and /api/proxy forwarded
// %2e%2e/metrics as /metrics, outside the API's /api prefix. This node
// environment is required: a browser-like environment strips the Cookie header.

// This mock is for the generic proxy, which reads its session from
// next/headers; the staff proxy reads request.cookies and never calls it.
const jar = new Map<string, { value: string }>([['pc_access_token', { value: 'real-token' }]]);
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => jar.get(name) }) }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function captureFetch() {
  const calls: URL[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(new URL(url));
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

describe('encodeUpstreamPath', () => {
  it('leaves ordinary identifier segments unchanged', () => {
    expect(encodeUpstreamPath(['organizations', 'org_1-a.b', 'users'])).toBe('organizations/org_1-a.b/users');
  });

  it('encodes query and fragment delimiters inside a segment', () => {
    expect(encodeUpstreamPath(['organizations', 'x?a=1#', 'users'])).toBe('organizations/x%3Fa%3D1%23/users');
  });

  it('encodes a percent-encoded dot-segment so it can no longer be read as one', () => {
    expect(encodeUpstreamPath(['%2e%2e', 'metrics'])).toBe('%252e%252e/metrics');
    expect(encodeUpstreamPath(['.%2e', 'metrics'])).toBe('.%252e/metrics');
  });

  it('encodes a separator inside a segment', () => {
    expect(encodeUpstreamPath(['a/b'])).toBe('a%2Fb');
    expect(encodeUpstreamPath(['a\\b'])).toBe('a%5Cb');
  });

  // `.` and `..` contain nothing encodeURIComponent changes, so encoding alone
  // would leave them as dot-segments.
  it('refuses a literal dot-segment instead of encoding it', () => {
    expect(encodeUpstreamPath(['..', 'metrics'])).toBeNull();
    expect(encodeUpstreamPath(['deals', '.', 'x'])).toBeNull();
  });
});

describe('/api/staff/[...path] upstream URL', () => {
  async function forward(segments: string[], search = '') {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_URL', '');
    vi.stubEnv('PC_CONTROL_HOST_ENABLED', '');
    const captured = captureFetch();
    const { GET } = await import('../../app/api/staff/[...path]/route');
    const request = new NextRequest(`https://example.test/api/staff/x${search}`, {
      headers: { cookie: 'pc_access_token=token' },
    });
    const response = await GET(request, { params: Promise.resolve({ path: segments }) });
    return { status: response.status, ...captured };
  }

  it('forwards an allowlisted path and its query unchanged', async () => {
    const { status, calls } = await forward(['organizations', 'org1', 'users'], '?limit=5');
    expect(status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].pathname).toBe('/api/staff/organizations/org1/users');
    expect(calls[0].search).toBe('?limit=5');
  });

  it('does not let a segment turn the rest of the path into a query and a fragment', async () => {
    const { calls } = await forward(['organizations', 'x?a=1#', 'users']);
    expect(calls).toHaveLength(1);
    expect(calls[0].pathname).toBe('/api/staff/organizations/x%3Fa%3D1%23/users');
    expect(calls[0].search).toBe('');
  });

  // The route decodes each segment once more itself, so `%252e%252e` here is the
  // input that reached fetch() as `%2e%2e` and was resolved to /api/staff/users.
  it('does not let a percent-encoded dot-segment walk the upstream path', async () => {
    for (const segment of ['%252e%252e', '.%252e']) {
      const { calls } = await forward(['organizations', segment, 'users']);
      expect(calls, segment).toHaveLength(1);
      expect(calls[0].pathname, segment).toMatch(/^\/api\/staff\/organizations\/[^/]+\/users$/);
    }
  });

  it('still refuses a literal dot-segment before anything is forwarded', async () => {
    const { status, fetchMock } = await forward(['organizations', '..', 'users']);
    expect(status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/api/proxy/[...path] upstream URL', () => {
  async function forward(segments: string[]) {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_URL', 'http://api:3001/api');
    const captured = captureFetch();
    const { GET } = await import('../../app/api/proxy/[...path]/route');
    const response = await GET(new Request('https://example.test/api/proxy/x'), {
      params: Promise.resolve({ path: segments }),
    });
    return { status: response.status, ...captured };
  }

  it('forwards an ordinary path unchanged', async () => {
    const { status, calls } = await forward(['deals', 'd1', 'execution-workspace']);
    expect(status).toBe(200);
    expect(calls[0].toString()).toBe('http://api:3001/api/deals/d1/execution-workspace');
  });

  // /metrics and /health/detailed are excluded from the API's global prefix and
  // are meant to be reachable only inside the Compose network.
  it('does not let a percent-encoded dot-segment leave the /api prefix', async () => {
    for (const segments of [['%2e%2e', 'metrics'], ['%2e%2e', 'health', 'detailed'], ['.%2e', 'version']]) {
      const { calls } = await forward(segments);
      expect(calls, segments.join('|')).toHaveLength(1);
      expect(calls[0].pathname.startsWith('/api/'), calls[0].pathname).toBe(true);
    }
  });

  it('does not let a segment carry a query or a fragment upstream', async () => {
    const { calls } = await forward(['notifications', 'x?all=1#']);
    expect(calls[0].pathname).toBe('/api/notifications/x%3Fall%3D1%23');
    expect(calls[0].search).toBe('');
  });

  it('refuses a literal dot-segment without forwarding it', async () => {
    const { status, fetchMock } = await forward(['..', 'metrics']);
    expect(status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
