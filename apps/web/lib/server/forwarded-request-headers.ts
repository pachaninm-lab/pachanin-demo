/**
 * Sanitizing the client-controlled header values this tier forwards upstream.
 *
 * Four values arrive from the browser and are placed back into an outgoing HTTP
 * request header: the correlation id, the idempotency key, the client address
 * and the user agent. An HTTP field value is a dangerous context, and the
 * runtime is not the control people assume it is. Measured against Node 22:
 * `new Headers()` rejects only NUL, CR, LF and code points above U+00FF.
 * Everything else is accepted - the remaining C0 control characters, DEL, and
 * the whole 0x80-0xFF range - and header bytes off the wire are decoded as
 * latin1, so they are always inside that accepted range. CR and LF cannot reach
 * a handler anyway; the HTTP parser treats them as the end of the field.
 *
 * So there is no header injection to fix here, and saying otherwise would be
 * inventing a vulnerability. What is missing is the requirement itself (ASVS
 * V1.3.3): nothing restricts these values to characters that are safe for the
 * context, and nothing bounds their length. A control character or a megabyte
 * of text is passed through to the API, its logs and its storage exactly as
 * sent.
 *
 * Sanitizing here does not make a forwarded client address trustworthy. Anyone
 * can put any address in x-forwarded-for; only the proxy that terminates the
 * connection can say what the peer was. This module makes the value well-formed
 * for its context, nothing more.
 */

/**
 * Safe for a correlation id or an idempotency key in every context these reach:
 * an HTTP field value, a log line, a URL, a JSON document, a database key. Every
 * identifier this application generates - randomUUID(), and the `decision:...`
 * and `org-join-decision:...` keys the API builds - is already inside it.
 */
const UNSAFE_IN_IDENTIFIER = /[^A-Za-z0-9._:-]/gu;

/** The API rejects an idempotency key longer than 128, so nothing longer is worth forwarding. */
export const MAX_IDENTIFIER_LENGTH = 128;

/** Long enough for any real user agent; short enough not to be a channel. */
export const MAX_USER_AGENT_LENGTH = 512;

/** Printable US-ASCII. Not a guess about what browsers send - it is what a field value may carry without a receiver having to decode anything. */
const UNSAFE_IN_FIELD_TEXT = /[^ -~]/gu;

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/u;

export function safeIdentifier(raw: unknown, maxLength: number = MAX_IDENTIFIER_LENGTH): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(UNSAFE_IN_IDENTIFIER, '').slice(0, maxLength);
}

/**
 * A correlation id that is always present and always safe. Callers already fell
 * back to a generated id when the header was absent; an unusable header is now
 * the same case as an absent one.
 */
export function safeCorrelationId(raw: unknown): string {
  return safeIdentifier(raw) || crypto.randomUUID();
}

/**
 * An idempotency key, or the empty string. Empty is what callers already passed
 * when the header was absent, and the API answers it with a 400 - which is the
 * right answer for a key that carried nothing usable.
 */
export function safeIdempotencyKey(raw: unknown): string {
  return safeIdentifier(raw);
}

/**
 * An address literal, or null. Anything that is not one is not an address, and
 * forwarding it would only put unchecked text in front of whatever parses
 * x-forwarded-for downstream.
 */
export function safeClientIp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const candidate = raw.trim();
  if (!candidate || candidate.length > 45) return null;
  if (IPV4.test(candidate)) return candidate;
  // IPv6: delegate the grammar to the URL parser rather than write it out here.
  // What comes back is the parser's canonical form, not the input - ::FFFF:1.2.3.4
  // returns as ::ffff:102:304 - which is the right thing to forward, since it is
  // the same address written the one way every reader will agree on.
  try {
    const url = new URL(`http://[${candidate}]`);
    const parsed = url.hostname.slice(1, -1);
    return parsed ? parsed : null;
  } catch {
    return null;
  }
}

/** A user agent reduced to printable ASCII and bounded, or null when nothing is left. */
export function safeUserAgent(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(UNSAFE_IN_FIELD_TEXT, '').trim().slice(0, MAX_USER_AGENT_LENGTH);
  return cleaned || null;
}

/**
 * The address chain this tier already consulted, now validated.
 *
 * Two orders existed before this: most routes read cf-connecting-ip first, the
 * two login routes read x-nf-client-connection-ip first and cf second. They are
 * unified here on the longer order. The orders only differ when two CDN headers
 * are set at once, which would mean two proxies in front of one request.
 *
 * The other change is deliberate: the chain now yields the first value that is
 * an address, where before it yielded the first value that was non-empty. A
 * junk header earlier in the chain no longer hides a usable one after it.
 */
export function clientIpFromRequest(request: { headers: { get(name: string): string | null } }): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const candidates = [
    request.headers.get('x-nf-client-connection-ip'),
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
    forwarded ? forwarded.split(',')[0] : null,
  ];
  for (const candidate of candidates) {
    const address = safeClientIp(candidate);
    if (address) return address;
  }
  return null;
}

/**
 * The address of the nearest hop, validated - a deliberately different and
 * stricter selection from clientIpFromRequest above.
 *
 * Two surfaces already chose it, with the reason written next to them: REG.RU
 * production has one trusted edge, Caddy, which appends or overwrites the
 * nearest entry in X-Forwarded-For, so the nearest entry is the only part of
 * the chain a caller cannot write. Everything to the left of it, and every
 * provider-specific header, is public input.
 *
 * The ten routes on clientIpFromRequest take the leftmost entry instead, which
 * a caller does control. That difference is not settled here: which selection
 * is right depends on what actually terminates the connection for each surface,
 * and choosing nearest-hop where a CDN is the edge would collapse every user
 * into one rate-limit bucket. Sanitizing a value and deciding whose value to
 * believe are different questions, and this module only answers the first.
 */
export function nearestProxyAddress(request: { headers: { get(name: string): string | null } }): string | null {
  const chain = String(request.headers.get('x-forwarded-for') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return safeClientIp(chain.at(-1) ?? null);
}

export function correlationIdFromRequest(request: { headers: { get(name: string): string | null } }): string {
  return safeCorrelationId(request.headers.get('x-correlation-id'));
}

export function idempotencyKeyFromRequest(request: { headers: { get(name: string): string | null } }): string {
  return safeIdempotencyKey(request.headers.get('idempotency-key'));
}

export function userAgentFromRequest(request: { headers: { get(name: string): string | null } }): string | null {
  return safeUserAgent(request.headers.get('user-agent'));
}
