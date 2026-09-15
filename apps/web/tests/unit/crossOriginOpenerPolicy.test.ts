// @vitest-environment node
//
// ASVS V3.4.8. The existing middleware header test reads the source text and
// asserts the header name appears in it, which proves a string is present, not
// that a response carries the header. This one runs the middleware and reads
// the response, so a change that leaves the line in place but stops it applying
// - an early return, a branch that builds a response another way - still fails.

import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '../../middleware';

const HEADER = 'cross-origin-opener-policy';

async function headersFor(url: string, init?: RequestInit) {
  const response = await middleware(new NextRequest(new Request(url, init)));
  return response.headers;
}

describe('Cross-Origin-Opener-Policy', () => {
  it('is set on a document response', async () => {
    const headers = await headersFor('https://example.test/');
    expect(headers.get(HEADER)).toBe('same-origin');
  });

  it('is set on the paths that take their own branch through the middleware', async () => {
    // A redirect, a protected path and a public path are built in different
    // places in the middleware; all of them are document responses.
    for (const path of ['/platform-v7', '/platform-v7/login', '/legal/politika-konfidencialnosti']) {
      const headers = await headersFor(`https://example.test${path}`);
      expect(headers.get(HEADER), `${path} should carry ${HEADER}`).toBe('same-origin');
    }
  });

  it('carries exactly one value, because two different ones mean unsafe-none', async () => {
    const headers = await headersFor('https://example.test/');
    // Duplication would show up here as a comma-joined value. Asserted against
    // the exact string rather than with not.toContain, which a missing header
    // would also satisfy.
    expect(headers.get(HEADER)).toBe('same-origin');
  });

  it('uses same-origin rather than the weaker allow-popups form', async () => {
    const headers = await headersFor('https://example.test/');
    expect(headers.get(HEADER)).not.toBe('same-origin-allow-popups');
    expect(headers.get(HEADER)).not.toBe('unsafe-none');
  });
});
