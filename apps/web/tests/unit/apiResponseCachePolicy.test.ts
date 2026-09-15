import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware as applyMiddleware } from '../../middleware';

/**
 * ASVS 5.0 V14.3.2: an API response must not be stored by the browser.
 *
 * The policy is applied at the one point every branch of the middleware returns
 * through, so these ask the middleware what it emits rather than reading the
 * function. That distinction matters here: the header is set centrally and
 * REPLACES whatever a route set, which was measured against a real Next server
 * rather than assumed - a middleware header overrides the route handler's, and
 * so does one from next.config.js headers(). Routes whose header carries
 * something a bare no-store would drop - no-transform, which stops a proxy
 * buffering an event stream - are exempted, and the exemption is what these
 * pin: it must hold for the streaming route and must NOT leak to its siblings.
 */

const ORIGIN = 'https://example.test';
const run = async (path: string) => applyMiddleware(new NextRequest(`${ORIGIN}${path}`));

describe('what the middleware says about caching an API response', () => {
  it('marks an API response no-store whatever branch produced it', async () => {
    for (const path of ['/api/deals', '/api/auth/me', '/api/commercial/companies', '/api/labs/complete']) {
      const response = await run(path);
      expect([path, response.headers.get('cache-control')]).toEqual([path, 'no-store']);
    }
  });

  it('leaves the streaming routes to set their own, so no-transform survives', async () => {
    // A bare no-store here would strip no-transform and let a proxy buffer the
    // stream - a caching header breaking streaming, not caching.
    for (const path of ['/api/runtime-stream', '/api/runtime-me-stream', '/api/realtime', '/api/agro-chat']) {
      const response = await run(path);
      expect([path, response.headers.get('cache-control')]).toEqual([path, null]);
    }
  });

  it('exempts the proxy subtree, because every path under it is one handler', async () => {
    for (const path of ['/api/proxy', '/api/proxy/auth/me', '/api/proxy/a/b/c']) {
      const response = await run(path);
      expect([path, response.headers.get('cache-control')]).toEqual([path, null]);
    }
  });

  it('does not let an exemption leak to a sibling route that shares its prefix', async () => {
    // /api/public-platform-assistant streams and manages its own; the
    // attachments route beneath it is a different handler that does not.
    expect((await run('/api/public-platform-assistant')).headers.get('cache-control')).toBeNull();
    expect((await run('/api/public-platform-assistant/attachments')).headers.get('cache-control')).toBe('no-store');
  });

  it('does not reach outside the API surface', async () => {
    // Pages have their own rules; this policy is scoped to /api and a change
    // that widened it silently would show up here.
    const response = await run('/platform-v7');
    expect(response.headers.get('cache-control')).not.toBe('no-store');
  });

  it('still applies the rest of the security headers alongside it', async () => {
    // The cache policy is added to applySecurityHeaders' output, not instead of
    // it; a refactor that dropped the others would otherwise pass.
    const response = await run('/api/deals');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });
});
