// @vitest-environment node
//
// ASVS V3.5.8. The requirement offers two ways to stop an authenticated
// resource being loaded on the user's behalf by a page that had no business
// asking for it: strict Sec-Fetch-* validation, or a restrictive
// Cross-Origin-Resource-Policy. Sec-Fetch is checked on the chat and assistant
// routes only (credited under V3.5.3), so this takes the second route and
// covers every response the middleware builds.
//
// Runs the middleware and reads the response rather than searching the source,
// so a change that leaves the line in place but stops it applying still fails.

import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '../../middleware';

const HEADER = 'cross-origin-resource-policy';

async function headersFor(path: string) {
  const response = await middleware(new NextRequest(new Request(`https://example.test${path}`)));
  return response.headers;
}

describe('Cross-Origin-Resource-Policy', () => {
  it('is set on the responses the middleware builds', async () => {
    for (const path of ['/', '/platform-v7', '/platform-v7/login', '/legal/politika-konfidencialnosti']) {
      expect((await headersFor(path)).get(HEADER), path).toBe('same-site');
    }
  });

  it('is same-site, not the permissive value', async () => {
    // Absent, the default is cross-origin: any page may load the response as a
    // subresource. cross-origin written explicitly would be the same thing
    // said out loud, and would not satisfy the requirement.
    const value = (await headersFor('/platform-v7')).get(HEADER);
    expect(value).not.toBe('cross-origin');
    expect(value).toBe('same-site');
  });

  it('carries exactly one value', async () => {
    expect((await headersFor('/platform-v7')).get(HEADER)).toBe('same-site');
  });

  it('keeps same-site rather than same-origin, because the platform is two origins', async () => {
    // The platform is served from the apex and from control.<apex>. They share
    // a registrable domain and are one application, so same-origin would refuse
    // a subresource one of them loads from the other. same-site still refuses
    // every genuinely foreign origin, which is what the requirement is about.
    const { CONTROL_PLATFORM_HOST, PRIMARY_PLATFORM_HOST } = await import('../../lib/platform-v7/control-host');
    expect(CONTROL_PLATFORM_HOST.endsWith(PRIMARY_PLATFORM_HOST)).toBe(true);
    expect(CONTROL_PLATFORM_HOST).not.toBe(PRIMARY_PLATFORM_HOST);
    expect((await headersFor('/platform-v7')).get(HEADER)).toBe('same-site');
  });
});
