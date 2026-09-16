import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware as applyMiddleware } from '../../middleware';

/**
 * OWASP ASVS 5.0 V3.4.3.
 *
 * These read the policy off a response the middleware actually produced, rather
 * than out of the source string, because two files define a CSP and only one is
 * served. Measured against a production build of this Next version with a
 * different policy configured in each: the middleware header is the one that
 * reaches the browser, and exactly one CSP header comes back. So this is the
 * definition worth pinning, and next.config.js is held to the same minimums
 * separately below so the two cannot drift into contradicting each other.
 */

const ORIGIN = 'https://example.test';

async function servedPolicy(path = '/platform-v7'): Promise<Map<string, string[]>> {
  const response = await applyMiddleware(new NextRequest(`${ORIGIN}${path}`));
  const header = response.headers.get('content-security-policy');
  expect(header, 'no Content-Security-Policy was served').toBeTruthy();
  return new Map(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/u);
        return [name, values] as [string, string[]];
      }),
  );
}

describe('the policy the browser is actually given', () => {
  it("forbids plugin content outright rather than falling back to default-src", async () => {
    // Without the directive this fell back to default-src 'self', which still
    // permits an <object> loading from this origin.
    expect((await servedPolicy()).get('object-src')).toEqual(["'none'"]);
  });

  it("forbids <base> from having any effect", async () => {
    // Under base-uri 'self' an injected <base href="/x/"> re-points every
    // RELATIVE script src on the page - one tag reroutes scripts the rest of
    // the policy trusts.
    expect((await servedPolicy()).get('base-uri')).toEqual(["'none'"]);
  });

  it('does not permit eval as a script source', async () => {
    // Measured as free: with this removed, a prerendered page and a dynamically
    // rendered one both hydrate and stay interactive with zero violations.
    expect((await servedPolicy()).get('script-src')).not.toContain("'unsafe-eval'");
  });

  it('still names an origin allowlist rather than opening the default', async () => {
    const policy = await servedPolicy();
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('script-src')).toContain("'self'");
    expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
    expect(policy.get('form-action')).toEqual(["'self'"]);
  });

  it('is served on every kind of path, not only on pages', async () => {
    for (const path of ['/', '/platform-v7', '/api/deals']) {
      const policy = await servedPolicy(path);
      expect([path, policy.get('object-src')]).toEqual([path, ["'none'"]]);
    }
  });

  it("records honestly that 'unsafe-inline' is still present", async () => {
    // This is the half that keeps V3.4.3 failing, and it is asserted rather than
    // left implicit: removing it needs per-request nonces, which need every page
    // rendered per request, and 249 of this application's pages are prerendered.
    // If someone does remove it, this test should fail and be deleted along with
    // the FAIL verdict - not quietly pass while the register still says FAIL.
    expect((await servedPolicy()).get('script-src')).toContain("'unsafe-inline'");
  });
});

describe('the policy on the paths middleware does not match', () => {
  // next.config.js governs _next/static, _next/image and favicon.ico. It is not
  // what a document gets, but it must not read as a weaker parallel policy.
  const config = readFileSync(resolve(process.cwd(), 'next.config.js'), 'utf8');

  it('is held to the same three minimums', () => {
    expect(config).toContain(`"object-src 'none'"`);
    expect(config).toContain(`"base-uri 'none'"`);
  });

  it('does not permit eval either', () => {
    const scriptSrc = /"script-src ([^"]*)"/u.exec(config)?.[1] ?? '';
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });
});
