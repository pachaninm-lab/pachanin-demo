// @vitest-environment node
//
// ASVS 5.0 V14.2.1 - sensitive data travels in the body or in headers, and the
// URL and query string do not carry it.
//
// The registration status token appears in a URL at four points. This file
// holds the one that is closed:
//
//   1. the emailed link puts it in the address bar          - open
//   2. the client writes it back there after verification   - open
//   3. every status poll sends it as a query parameter      - open
//   4. the web route forwarded it upstream the same way     - CLOSED here
//
// Points 1-3 live in app/platform-v7/register/page.tsx and
// RegisterFormClientPublic.tsx, which the immutability register in
// platformV7RootWorkEntry.test.ts pins by SHA-256. They cannot be changed
// without lifting that pin, which is not this programme's to lift. The
// V14.2.1 decision records the measured fix and what unpinning it needs.
//
// Point 4 is worth closing on its own: the upstream hop is where the token
// reaches the API's access log and anything routing between the two services,
// and none of that is under this repository's control.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = `rst_reg_${'a'.repeat(60)}`;

let previousApiUrl: string | undefined;

beforeEach(() => {
  previousApiUrl = process.env.API_URL;
  process.env.API_URL = 'https://api.example.test';
});

afterEach(() => {
  if (previousApiUrl === undefined) delete process.env.API_URL;
  else process.env.API_URL = previousApiUrl;
  vi.restoreAllMocks();
  vi.resetModules();
});

async function callStatus(query: string) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true, status: 'UNDER_REVIEW' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }));
  const { GET } = await import('@/app/api/auth/registration/status/route');
  const response = await GET(new Request(`https://pc.example.test/api/auth/registration/status${query}`));
  return { response, calls };
}

describe('registration status token leaves this process in a header (ASVS V14.2.1)', () => {
  it('sends the token upstream as a header and not in the URL', async () => {
    const { response, calls } = await callStatus(`?token=${TOKEN}`);

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    // The whole point: nothing downstream can log this URL and capture a credential.
    expect(calls[0].url).not.toContain(TOKEN);
    expect(calls[0].url).not.toContain('token=');
    expect(calls[0].url).toBe('https://api.example.test/auth/registration/status');
    expect(new Headers(calls[0].init?.headers).get('x-registration-status-token')).toBe(TOKEN);
  });

  it('still refuses a token that is not a registration status token, without calling upstream', async () => {
    const { response, calls } = await callStatus('?token=not-a-registration-token');
    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('does not answer with the token in its own response', async () => {
    const { response } = await callStatus(`?token=${TOKEN}`);
    expect(JSON.stringify(await response.json())).not.toContain(TOKEN);
  });
});

describe('the API reads the token from the header', () => {
  it('takes it from x-registration-status-token rather than the query string', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const controller = readFileSync(
      resolve(process.cwd(), '../api/src/modules/auth/auth.controller.ts'),
      'utf8',
    );
    // Source-level, and deliberately narrow: this asserts the endpoint's own
    // parameter, not that no proxy anywhere re-adds a query string.
    expect(controller).toContain("registrationStatus(@Headers('x-registration-status-token')");
    expect(controller).not.toContain("registrationStatus(@Query('token')");
  });
});
