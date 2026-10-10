import {
  safeOutboundRequest,
  vetDestination,
  configuredAllowedHosts,
  oversizedHeaderProblem,
} from './safe-outbound-request';

/**
 * ASVS 5.0 V1.3.6, one case per denial.
 *
 * Two properties are easy to assert badly and are asserted carefully here.
 *
 * A refusal must happen BEFORE a socket is opened. That is checked by the
 * refusal code: a destination refused during vetting returns its own reason
 * (ADDRESS_LOOPBACK, OUTBOUND_HOST_NOT_ALLOWED, ...), while anything that got
 * as far as the transport can only return OUTBOUND_REQUEST_FAILED. The two are
 * distinguishable, so "refused" is never confused with "tried and could not
 * connect".
 *
 * A redirect hop must be re-vetted. Proving that needs a 302, a 302 needs a
 * server, and every server a test can reach sits on an address this guard
 * exists to refuse. So the transport is injected and records the hops that
 * reach it: a hop that was refused never appears in that record.
 */

const BASE = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
} as const;

/** A transport that must never be called. Calling it fails the case. */
const forbiddenTransport = jest.fn(async () => {
  throw new Error('transport reached for a destination that should have been refused');
});

describe('a destination is refused before any connection is attempted', () => {
  beforeEach(() => forbiddenTransport.mockClear());

  it.each([
    ['http://127.0.0.1/hook', 'ADDRESS_LOOPBACK'],
    ['http://[::1]/hook', 'ADDRESS_LOOPBACK'],
    ['http://169.254.169.254/latest/meta-data/', 'ADDRESS_LINK_LOCAL'],
    ['http://10.0.0.5/hook', 'ADDRESS_PRIVATE'],
    ['http://192.168.1.1/hook', 'ADDRESS_PRIVATE'],
    ['http://172.16.0.1/hook', 'ADDRESS_PRIVATE'],
    ['http://100.64.0.1/hook', 'ADDRESS_SHARED_CGNAT'],
    ['http://[fe80::1]/hook', 'ADDRESS_LINK_LOCAL'],
    ['http://[fc00::1]/hook', 'ADDRESS_UNIQUE_LOCAL'],
    ['http://0.0.0.0/hook', 'ADDRESS_UNSPECIFIED'],
    ['http://[::ffff:127.0.0.1]/hook', 'ADDRESS_EMBEDS_BLOCKED_IPV4'],
  ])('refuses a literal %s as %s, with no request issued', async (url, reason) => {
    const result = await safeOutboundRequest(url, { ...BASE, requestImpl: forbiddenTransport });
    expect(result.refusedBecause).toBe(reason);
    expect(result.delivered).toBe(false);
    expect(forbiddenTransport).not.toHaveBeenCalled();
  });

  it('refuses an unsafe scheme before it looks at addresses at all', async () => {
    const result = await safeOutboundRequest('javascript:alert(1)', {
      ...BASE, requestImpl: forbiddenTransport,
    });
    expect(result.refusedBecause).toBe('OUTBOUND_URL_PROTOCOL_NOT_ALLOWED');
    expect(forbiddenTransport).not.toHaveBeenCalled();
  });

  it('refuses credentials in the URL, which would be sent to the destination', async () => {
    const result = await safeOutboundRequest('https://user:pass@partner.example.test/hook', {
      ...BASE, requestImpl: forbiddenTransport,
    });
    expect(result.refusedBecause).toBe('OUTBOUND_URL_HAS_CREDENTIALS');
    expect(forbiddenTransport).not.toHaveBeenCalled();
  });
});

describe('the name is resolved and every answer is checked', () => {
  it('refuses when the only answer is private', async () => {
    const vetted = await vetDestination('https://evil.example.test/hook', {
      resolver: async () => ['10.1.2.3'],
    });
    expect(vetted).toEqual({ refusedBecause: 'ADDRESS_PRIVATE' });
  });

  it('refuses when ANY answer is private, not merely the first', async () => {
    // The trap: a name with one public and one loopback record. A guard that
    // checked addresses[0] would let this through, and the attacker chooses
    // which record the connection uses.
    const vetted = await vetDestination('https://mixed.example.test/hook', {
      resolver: async () => ['93.184.216.34', '127.0.0.1'],
    });
    expect(vetted).toEqual({ refusedBecause: 'ADDRESS_LOOPBACK' });
  });

  it('refuses an AAAA answer that embeds a blocked IPv4', async () => {
    const vetted = await vetDestination('https://sneaky.example.test/hook', {
      resolver: async () => ['::ffff:169.254.169.254'],
    });
    expect(vetted).toEqual({ refusedBecause: 'ADDRESS_EMBEDS_BLOCKED_IPV4' });
  });

  it('refuses when resolution fails, rather than proceeding', async () => {
    const vetted = await vetDestination('https://nx.example.test/hook', {
      resolver: async () => { throw new Error('ENOTFOUND'); },
    });
    expect(vetted).toEqual({ refusedBecause: 'OUTBOUND_DNS_RESOLUTION_FAILED' });
  });

  it('refuses when the name resolves to nothing', async () => {
    const vetted = await vetDestination('https://empty.example.test/hook', {
      resolver: async () => [],
    });
    expect(vetted).toEqual({ refusedBecause: 'OUTBOUND_DNS_NO_ADDRESS' });
  });

  it('allows a public destination, or the control is useless', async () => {
    const vetted = await vetDestination('https://partner.example.test/hook', {
      resolver: async () => ['93.184.216.34'],
    });
    expect(vetted).toHaveProperty('addresses', ['93.184.216.34']);
  });
});

describe('DNS rebinding: the connection uses the address that was checked', () => {
  it('pins the vetted address instead of resolving a second time', async () => {
    let call = 0;
    // First answer public, every later answer loopback. A guard that resolved
    // once to check and again to connect would connect to 127.0.0.1.
    const rebinding = async () => (call++ === 0 ? ['93.184.216.34'] : ['127.0.0.1']);
    const seen: string[] = [];

    const result = await safeOutboundRequest('https://rebind.example.test/hook', {
      ...BASE,
      resolver: rebinding,
      requestImpl: async (_url, pinnedAddress) => {
        seen.push(pinnedAddress);
        return { status: 200 };
      },
    });

    expect(result.delivered).toBe(true);
    // The address handed to the transport is the one that was vetted.
    expect(seen).toEqual(['93.184.216.34']);
    // And it was resolved exactly once, so there is no second answer to poison.
    expect(call).toBe(1);
  });
});

describe('a redirect is a new destination and is vetted again', () => {
  it('refuses a redirect to loopback and never issues the second request', async () => {
    const hops: string[] = [];
    const result = await safeOutboundRequest('https://partner.example.test/hook', {
      ...BASE,
      resolver: async () => ['93.184.216.34'],
      requestImpl: async (url) => {
        hops.push(url.toString());
        return { status: 302, location: 'http://127.0.0.1:8200/v1/secret' };
      },
    });

    expect(result.refusedBecause).toBe('ADDRESS_LOOPBACK');
    expect(result.delivered).toBe(false);
    // One hop reached the transport. The refused one never did.
    expect(hops).toEqual(['https://partner.example.test/hook']);
  });

  it('refuses a redirect to the metadata address', async () => {
    const result = await safeOutboundRequest('https://partner.example.test/hook', {
      ...BASE,
      resolver: async () => ['93.184.216.34'],
      requestImpl: async () => ({ status: 301, location: 'http://169.254.169.254/latest/meta-data/' }),
    });
    expect(result.refusedBecause).toBe('ADDRESS_LINK_LOCAL');
  });

  it('refuses a redirect that changes to an unsafe scheme', async () => {
    const result = await safeOutboundRequest('https://partner.example.test/hook', {
      ...BASE,
      resolver: async () => ['93.184.216.34'],
      requestImpl: async () => ({ status: 302, location: 'file:///etc/passwd' }),
    });
    expect(result.refusedBecause).toBe('OUTBOUND_URL_PROTOCOL_NOT_ALLOWED');
  });

  it('follows a redirect to a public destination, so the guard is not refusing everything', async () => {
    const hops: string[] = [];
    const result = await safeOutboundRequest('https://partner.example.test/hook', {
      ...BASE,
      resolver: async () => ['93.184.216.34'],
      requestImpl: async (url) => {
        hops.push(url.toString());
        return hops.length === 1
          ? { status: 302, location: 'https://partner.example.test/hook2' }
          : { status: 200 };
      },
    });
    expect(result.delivered).toBe(true);
    expect(hops).toEqual([
      'https://partner.example.test/hook',
      'https://partner.example.test/hook2',
    ]);
  });

  it('stops rather than following redirects forever', async () => {
    let n = 0;
    const result = await safeOutboundRequest('https://partner.example.test/a', {
      ...BASE,
      resolver: async () => ['93.184.216.34'],
      requestImpl: async () => {
        n += 1;
        return { status: 302, location: `https://partner.example.test/${n}` };
      },
    });
    expect(result.refusedBecause).toBe('OUTBOUND_TOO_MANY_REDIRECTS');
    expect(n).toBeLessThanOrEqual(4);
  });

  it('refuses a redirect with no Location rather than treating it as delivered', async () => {
    const result = await safeOutboundRequest('https://partner.example.test/hook', {
      ...BASE,
      resolver: async () => ['93.184.216.34'],
      requestImpl: async () => ({ status: 302 }),
    });
    expect(result.refusedBecause).toBe('OUTBOUND_REDIRECT_WITHOUT_LOCATION');
  });
});

describe('optional operator narrowing', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('is absent by default, so a legitimate partner endpoint still works', () => {
    delete process.env.PARTNER_WEBHOOK_ALLOWED_HOSTS;
    expect(configuredAllowedHosts()).toBeUndefined();
  });

  it('narrows to the configured hosts when set', async () => {
    const refused = await vetDestination('https://other.example.test/hook', {
      allowedHosts: ['partner.example.test'],
      resolver: async () => ['93.184.216.34'],
    });
    expect(refused).toEqual({ refusedBecause: 'OUTBOUND_HOST_NOT_ALLOWED' });

    const allowed = await vetDestination('https://partner.example.test/hook', {
      allowedHosts: ['partner.example.test'],
      resolver: async () => ['93.184.216.34'],
    });
    expect(allowed).toHaveProperty('addresses');
  });

  it('an entry may pin a port, and a different port on the same host is refused', async () => {
    const ok = await vetDestination('https://partner.example.test:8443/hook', {
      allowedHosts: ['partner.example.test:8443'],
      resolver: async () => ['93.184.216.34'],
    });
    expect(ok).toHaveProperty('addresses');

    const wrongPort = await vetDestination('https://partner.example.test:9999/hook', {
      allowedHosts: ['partner.example.test:8443'],
      resolver: async () => ['93.184.216.34'],
    });
    expect(wrongPort).toEqual({ refusedBecause: 'OUTBOUND_HOST_NOT_ALLOWED' });
  });

  it('a bare host entry still matches the default port', async () => {
    const ok = await vetDestination('https://partner.example.test/hook', {
      allowedHosts: ['partner.example.test'],
      resolver: async () => ['93.184.216.34'],
    });
    expect(ok).toHaveProperty('addresses');
  });

  it('parses the environment list, trimming and lowercasing', () => {
    process.env.PARTNER_WEBHOOK_ALLOWED_HOSTS = ' A.example.test , b.example.test ';
    expect(configuredAllowedHosts()).toEqual(['a.example.test', 'b.example.test']);
  });
});

describe('fail closed', () => {
  it('a transport error is a refusal, not a delivery', async () => {
    const result = await safeOutboundRequest('https://partner.example.test/hook', {
      ...BASE,
      resolver: async () => ['93.184.216.34'],
      requestImpl: async () => { throw new Error('ECONNRESET'); },
    });
    expect(result.delivered).toBe(false);
    expect(result.refusedBecause).toBe('OUTBOUND_REQUEST_FAILED');
  });

  it('a non-2xx response is not a delivery', async () => {
    const result = await safeOutboundRequest('https://partner.example.test/hook', {
      ...BASE,
      resolver: async () => ['93.184.216.34'],
      requestImpl: async () => ({ status: 500 }),
    });
    expect(result.delivered).toBe(false);
    expect(result.status).toBe(500);
  });
});

/**
 * ASVS 5.0 V4.2.5 — a different property from every case above.
 *
 * Those cases are about WHERE a request goes. These are about whether the
 * request this application builds is one the receiving component can accept at
 * all. A URI longer than the server's request-line limit, or a header field
 * longer than its field limit, is answered with 414 or 431 every single time,
 * so an unbounded stored value turns each later delivery into a guaranteed
 * error rather than an occasional one.
 *
 * The refusal codes matter here for the same reason they do above: a size
 * refusal returns its own reason, so it is distinguishable from a request that
 * was actually attempted and failed.
 */
describe('a request too large for the receiving component is refused before it is sent', () => {
  const host = 'https://partner.example.com';

  it('refuses a URI past the ceiling, without opening a socket', async () => {
    const long = `${host}/${'a'.repeat(4_000)}`;
    const result = await safeOutboundRequest(long, { ...BASE, requestImpl: forbiddenTransport });
    expect(result.refusedBecause).toBe('OUTBOUND_URI_TOO_LONG');
    expect(forbiddenTransport).not.toHaveBeenCalled();
  });

  it('refuses it at vetDestination too, so no caller can reach the transport around it', async () => {
    const vetted = await vetDestination(`${host}/${'a'.repeat(4_000)}`);
    expect(vetted).toEqual({ refusedBecause: 'OUTBOUND_URI_TOO_LONG' });
  });

  it('measures the URI in bytes, not characters', async () => {
    // 1_200 Cyrillic characters are 2_400 bytes: under the ceiling by length
    // and over it by size. A server counts octets, so this must be refused.
    const cyrillic = `${host}/${'я'.repeat(1_200)}`;
    expect(cyrillic.length).toBeLessThan(2_048);
    const result = await safeOutboundRequest(cyrillic, { ...BASE, requestImpl: forbiddenTransport });
    expect(result.refusedBecause).toBe('OUTBOUND_URI_TOO_LONG');
  });

  it('accepts a URI comfortably inside the ceiling', async () => {
    const seen: string[] = [];
    const transport = jest.fn(async (url: URL) => {
      seen.push(url.toString());
      return { status: 200 };
    });
    const result = await safeOutboundRequest(`${host}/hook`, {
      ...BASE, requestImpl: transport, resolver: async () => ['93.184.216.34'],
    });
    expect(result.refusedBecause).toBeUndefined();
    expect(seen).toEqual([`${host}/hook`]);
  });

  it('refuses one oversized header value', async () => {
    const result = await safeOutboundRequest(`${host}/hook`, {
      ...BASE,
      headers: { 'Content-Type': 'application/json', 'X-GrainFlow-Event': 'e'.repeat(5_000) },
      requestImpl: forbiddenTransport,
      resolver: async () => ['93.184.216.34'],
    });
    expect(result.refusedBecause).toBe('OUTBOUND_HEADER_TOO_LONG');
    expect(forbiddenTransport).not.toHaveBeenCalled();
  });

  it('measures a header value in bytes, not characters', async () => {
    // The counterpart of the URI case, and it was missing: a mutation that
    // measured header values with .length left every other case green. 2_500
    // Cyrillic characters are 5_000 bytes - under the ceiling by length and
    // over it by size, which is what the server counts.
    const value = 'я'.repeat(2_500);
    expect(value.length).toBeLessThan(4_096);
    expect(oversizedHeaderProblem({ 'X-Event': value })).toBe('OUTBOUND_HEADER_TOO_LONG');
  });

  it('refuses a header set that is oversized only in total', async () => {
    // Each value is individually acceptable. Together they exceed what the
    // server buffers, which a per-value check alone would miss.
    const headers: Record<string, string> = {};
    for (let index = 0; index < 4; index += 1) headers[`X-Pad-${index}`] = 'p'.repeat(3_000);
    expect(oversizedHeaderProblem({ 'X-Pad-0': headers['X-Pad-0'] })).toBeNull();
    const result = await safeOutboundRequest(`${host}/hook`, {
      ...BASE, headers, requestImpl: forbiddenTransport, resolver: async () => ['93.184.216.34'],
    });
    expect(result.refusedBecause).toBe('OUTBOUND_HEADERS_TOO_LARGE');
    expect(forbiddenTransport).not.toHaveBeenCalled();
  });

  it('counts the field name and separators against the total, as the server does', () => {
    // A value exactly at the byte budget still overflows once the name, the
    // colon-space and the CRLF are counted - which is what the server counts.
    expect(oversizedHeaderProblem({ 'X-A': 'v'.repeat(8_192 - 3) })).toBe('OUTBOUND_HEADER_TOO_LONG');
    expect(oversizedHeaderProblem({})).toBeNull();
  });

  it('checks the headers once, ahead of the redirect loop', async () => {
    // The header set does not change between hops, so a refusal must happen
    // before the first address is contacted rather than after a request has
    // already gone out and come back with a 302.
    const transport = jest.fn(async () => ({ status: 302, location: `${host}/next` }));
    const result = await safeOutboundRequest(`${host}/hook`, {
      ...BASE,
      headers: { 'X-Too-Long': 'x'.repeat(5_000) },
      requestImpl: transport,
      resolver: async () => ['93.184.216.34'],
    });
    expect(result.refusedBecause).toBe('OUTBOUND_HEADER_TOO_LONG');
    expect(transport).not.toHaveBeenCalled();
  });
});
