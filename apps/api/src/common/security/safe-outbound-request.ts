import { lookup as dnsLookup } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupAddress, LookupOneOptions } from 'node:dns';
import { blockedAddressReason } from './ip-address-policy';
import { outboundUrlProblem } from './outbound-url';

/**
 * Fetching a destination that an untrusted party chose.
 *
 * ASVS 5.0 V1.3.6. The scheme check in outbound-url.ts proves the URL is of a
 * safe kind; it proves nothing about where it points, and `http://127.0.0.1`
 * and `http://169.254.169.254` are both perfectly ordinary http URLs.
 *
 * Three things have to hold at once, and each defeats a different attack:
 *
 * 1. Every address the name resolves to must be public unicast. Checking one
 *    address is not enough - a name can carry several A and AAAA records, and
 *    an attacker only needs the one that is not checked.
 *
 * 2. The connection must go to the address that was checked. Resolving, then
 *    handing the NAME to the HTTP client, leaves a second resolution between
 *    the check and the connect, and that gap is DNS rebinding: the first
 *    answer is public, the second is 127.0.0.1. The socket here is pinned to a
 *    validated address via the lookup hook, so there is no second resolution
 *    to poison.
 *
 * 3. A redirect is a new destination chosen by the same untrusted party. Each
 *    hop is put through the whole check again, from the scheme onward. A guard
 *    that validated only the first URL is defeated by a 302 to loopback.
 *
 * Anything unexpected refuses. There is no path through this function that
 * ends in a request to an address that was not checked.
 */

/** Total redirects followed before giving up. */
const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Size ceilings on what this application will put on the wire.
 *
 * A separate property from where the request goes. The address rules above stop
 * a request reaching somewhere it should not; these stop it being shaped so
 * that the receiving component refuses it - a URI longer than the server's
 * request-line limit, or a header field longer than its field limit, comes back
 * as 414 or 431 every single time, so a stored value nobody bounded turns every
 * later delivery into a guaranteed error.
 *
 * The numbers are the smallest documented limits among the servers a webhook is
 * likely to land on rather than anything this application prefers: nginx
 * defaults to an 8 KiB request line and 8 KiB header buffers, and common
 * gateways sit at or below that. Staying under the smallest limit is what makes
 * the request acceptable to all of them, so the ceiling is set below it with
 * room for the path and query the partner chose.
 *
 * They are enforced here, at the one place every outbound request passes,
 * because a limit applied where the value is stored can be bypassed by any
 * caller that builds a request from something else - and the value is stored by
 * an endpoint whose body type nothing validates.
 */
const MAX_OUTBOUND_URI_LENGTH = 2_048;
const MAX_OUTBOUND_HEADER_VALUE_LENGTH = 4_096;
const MAX_OUTBOUND_HEADER_BYTES = 8_192;

/**
 * Rejects a header set that a receiving component would refuse on size.
 *
 * Length is measured in BYTES, not characters. A header value is counted by the
 * server in octets, and one Cyrillic character is two of them - measuring
 * `.length` would pass a value twice the size the server actually sees, which
 * is the whole failure this requirement describes.
 */
export function oversizedHeaderProblem(
  headers: Readonly<Record<string, string>> = {},
): string | null {
  let total = 0;
  for (const [name, value] of Object.entries(headers)) {
    const bytes = Buffer.byteLength(value, 'utf8');
    if (bytes > MAX_OUTBOUND_HEADER_VALUE_LENGTH) return 'OUTBOUND_HEADER_TOO_LONG';
    // The field name, the colon-space and the CRLF are part of what the server
    // counts against its buffer, so they are counted here too.
    total += Buffer.byteLength(name, 'utf8') + bytes + 4;
  }
  return total > MAX_OUTBOUND_HEADER_BYTES ? 'OUTBOUND_HEADERS_TOO_LARGE' : null;
}

export type OutboundRefusalReason = string;

export interface SafeOutboundResult {
  readonly delivered: boolean;
  /** Present when a response was received. */
  readonly status?: number;
  /** Present when the request was refused or failed; never both with status. */
  readonly refusedBecause?: OutboundRefusalReason;
  /** Hops actually attempted, for evidence. */
  readonly finalUrl?: string;
}

export interface SafeOutboundOptions {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly timeoutMs?: number;
  /**
   * Optional operator narrowing. When set, the destination host must also be
   * one of these. Unset means "any public unicast destination", which is what
   * a partner webhook needs to remain usable at all.
   */
  readonly allowedHosts?: readonly string[];
  /** Injected in tests so a case can exercise resolution without a network. */
  readonly resolver?: (hostname: string) => Promise<string[]>;
  /**
   * Test seam for the transport. Redirect re-validation cannot be proved
   * otherwise: emitting a 302 needs a server, and any server a test could
   * reach is on an address this guard exists to refuse. Recording the hops
   * that reach the transport is what proves a refused hop never became a
   * request.
   */
  readonly requestImpl?: (
    url: URL,
    pinnedAddress: string,
    options: SafeOutboundOptions,
  ) => Promise<{ status: number; location?: string }>;
}

async function resolveAll(hostname: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) return reject(err);
      resolve((addresses as LookupAddress[]).map((a) => a.address));
    });
  });
}

/**
 * Everything that must be true before a socket is opened.
 *
 * Returns the addresses that passed, so the caller can pin one of them rather
 * than resolving the name a second time.
 */
export async function vetDestination(
  raw: string,
  options: Pick<SafeOutboundOptions, 'allowedHosts' | 'resolver'> = {},
): Promise<{ url: URL; addresses: string[] } | { refusedBecause: string }> {
  const schemeProblem = outboundUrlProblem(raw);
  if (schemeProblem) return { refusedBecause: schemeProblem };

  // Checked before parsing, so an enormous string is refused rather than
  // measured after a URL object has already been built from it.
  if (Buffer.byteLength(raw, 'utf8') > MAX_OUTBOUND_URI_LENGTH) {
    return { refusedBecause: 'OUTBOUND_URI_TOO_LONG' };
  }

  const url = new URL(raw);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '');

  if (options.allowedHosts) {
    // An entry may name a host or a host:port. This is the "ports" dimension
    // the requirement enumerates: unconstrained by default, because a partner
    // endpoint may legitimately sit on any port and every internal destination
    // is already removed by the address rules, but constrainable by an
    // operator who wants to narrow further.
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const allowed = options.allowedHosts.some(
      (entry) => entry === host || entry === `${host}:${port}`,
    );
    if (!allowed) return { refusedBecause: 'OUTBOUND_HOST_NOT_ALLOWED' };
  }

  // A literal address in the URL never reaches the resolver, so it is checked
  // directly. Without this, http://127.0.0.1/ would depend on whatever the
  // resolver happens to do with a numeric name.
  const literal = blockedAddressReason(host);
  if (literal === null) return { url, addresses: [host] };

  if (literal !== 'ADDRESS_UNPARSEABLE') {
    return { refusedBecause: literal };
  }

  let addresses: string[];
  try {
    addresses = await (options.resolver ? options.resolver(host) : resolveAll(host));
  } catch {
    return { refusedBecause: 'OUTBOUND_DNS_RESOLUTION_FAILED' };
  }
  if (addresses.length === 0) return { refusedBecause: 'OUTBOUND_DNS_NO_ADDRESS' };

  // EVERY answer, not the first. One public record alongside one loopback
  // record must refuse, or the attacker simply picks the other.
  for (const address of addresses) {
    const reason = blockedAddressReason(address);
    if (reason) return { refusedBecause: reason };
  }

  return { url, addresses };
}

function performRequest(
  url: URL,
  pinnedAddress: string,
  options: SafeOutboundOptions,
): Promise<{ status: number; location?: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const send = isHttps ? httpsRequest : httpRequest;

    // The socket connects to the address that was vetted. The hostname is
    // still sent as the Host header and as the TLS server name, so the far end
    // sees a normal request - but no second DNS answer can be substituted.
    const pinnedLookup = (
      _hostname: string,
      _opts: LookupOneOptions,
      callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
    ): void => {
      callback(null, pinnedAddress, pinnedAddress.includes(':') ? 6 : 4);
    };

    const req = send(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/gu, ''),
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: options.method,
        headers: { ...options.headers, host: url.host },
        servername: isHttps ? url.hostname.replace(/^\[|\]$/gu, '') : undefined,
        lookup: pinnedLookup as never,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      },
      (res) => {
        // The body is not needed and is drained so the socket can close.
        res.resume();
        resolve({ status: res.statusCode ?? 0, location: res.headers.location });
      },
    );

    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

/**
 * Sends one request to an untrusted destination, or refuses.
 *
 * Never throws for a refusal: the caller is usually iterating subscriptions
 * and a refusal for one must not stop the rest.
 */
export async function safeOutboundRequest(
  raw: string,
  options: SafeOutboundOptions,
): Promise<SafeOutboundResult> {
  let target = raw;

  // Ahead of the loop: the header set does not change between hops, and a
  // refusal here must happen before any address is contacted rather than after
  // a first request has already gone out.
  const headerProblem = oversizedHeaderProblem(options.headers);
  if (headerProblem) return { delivered: false, refusedBecause: headerProblem, finalUrl: target };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const vetted = await vetDestination(target, options);
    if ('refusedBecause' in vetted) {
      return { delivered: false, refusedBecause: vetted.refusedBecause, finalUrl: target };
    }

    let outcome: { status: number; location?: string };
    try {
      const send = options.requestImpl ?? performRequest;
      outcome = await send(vetted.url, vetted.addresses[0], options);
    } catch {
      return { delivered: false, refusedBecause: 'OUTBOUND_REQUEST_FAILED', finalUrl: target };
    }

    const isRedirect = outcome.status >= 300 && outcome.status < 400;
    if (!isRedirect) {
      return {
        delivered: outcome.status >= 200 && outcome.status < 300,
        status: outcome.status,
        finalUrl: target,
      };
    }

    if (!outcome.location) {
      return { delivered: false, refusedBecause: 'OUTBOUND_REDIRECT_WITHOUT_LOCATION', finalUrl: target };
    }
    // Resolved against the current hop so a relative Location works, then put
    // through the entire check again on the next pass round this loop.
    target = new URL(outcome.location, vetted.url).toString();
  }

  return { delivered: false, refusedBecause: 'OUTBOUND_TOO_MANY_REDIRECTS', finalUrl: target };
}

/** Operator narrowing, read once per call so a redeploy is not needed to widen it. */
export function configuredAllowedHosts(): readonly string[] | undefined {
  const raw = process.env.PARTNER_WEBHOOK_ALLOWED_HOSTS;
  if (!raw || raw.trim() === '') return undefined;
  return raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}
