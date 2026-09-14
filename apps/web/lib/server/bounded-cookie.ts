/**
 * A single budget for everything this application writes into a cookie.
 *
 * RFC 6265 §6.1 obliges a user agent to support at least 4096 bytes per cookie,
 * counted over the name and the value together, and browsers implement that
 * minimum as their ceiling. A larger cookie is simply not stored: the
 * Set-Cookie header is accepted, the server sees no error, and the value is
 * never sent back. Every control that depends on the cookie then fails with no
 * message anywhere - the user is told nothing, and the server log records a
 * successful response.
 *
 * That silence is the reason this module exists. Writing an oversized cookie is
 * never a working outcome, so it is treated as a defect at the point of the
 * write rather than as a mystery at the point of the read.
 */

/** TextEncoder rather than Buffer: this runs in middleware on the Edge runtime too. */
const encoder = new TextEncoder();

export const MAX_COOKIE_NAME_AND_VALUE_BYTES = 4096;

export class CookieBudgetExceededError extends Error {
  readonly cookieName: string;
  readonly byteLength: number;

  constructor(cookieName: string, byteLength: number) {
    super(
      `cookie ${cookieName} would be written at ${byteLength} bytes, over the ${MAX_COOKIE_NAME_AND_VALUE_BYTES}-byte `
      + 'name-and-value budget a browser will store; the browser would discard it and the cookie would never be sent back',
    );
    this.name = 'CookieBudgetExceededError';
    this.cookieName = cookieName;
    this.byteLength = byteLength;
  }
}

/** Bytes on the wire, which is what the browser counts - not UTF-16 code units. */
export function cookieNameAndValueBytes(name: string, value: string): number {
  return encoder.encode(name).length + encoder.encode(value).length;
}

export function withinCookieBudget(name: string, value: string): boolean {
  return cookieNameAndValueBytes(name, value) <= MAX_COOKIE_NAME_AND_VALUE_BYTES;
}

/**
 * Assert the budget at the write. Returns the value unchanged so it reads as a
 * wrapper at the call site: `jar.set(NAME, boundedCookieValue(NAME, token), …)`.
 *
 * It throws rather than dropping the write. A caller that can legitimately
 * exceed the budget - because it carries variable-length data - must decide what
 * to shorten, which is what serializeWithinCookieBudget is for. A caller that
 * cannot has a bug, and a failed request is a better report of it than a session
 * that looks issued and does not work.
 */
export function boundedCookieValue(name: string, value: string): string {
  const byteLength = cookieNameAndValueBytes(name, value);
  if (byteLength > MAX_COOKIE_NAME_AND_VALUE_BYTES) {
    throw new CookieBudgetExceededError(name, byteLength);
  }
  return value;
}

/**
 * Build a cookie value around one variable-length piece of text, shortening that
 * text - and only that text - until the whole cookie fits.
 *
 * `serialize` must be a pure function of the text, and must produce the complete
 * cookie value. The text is cut on a code point boundary, so a surrogate pair is
 * never split in half, and the cut is marked with the ellipsis so a reader can
 * see the value is not the whole of it.
 *
 * Returns null when even the empty text does not fit: the caller is then asking
 * for something no browser will keep, and only the caller knows whether that is
 * a failure to report or a cookie to leave unwritten.
 */
export function serializeWithinCookieBudget(
  name: string,
  serialize: (text: string) => string,
  text: string,
  ellipsis = '…',
): string | null {
  const whole = serialize(text);
  if (withinCookieBudget(name, whole)) return whole;

  const empty = serialize('');
  if (!withinCookieBudget(name, empty)) return null;

  // Code points, not UTF-16 units, so the prefix is always valid text.
  const points = [...text];
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = serialize(points.slice(0, middle).join('') + ellipsis);
    if (withinCookieBudget(name, candidate)) low = middle;
    else high = middle - 1;
  }

  if (low <= 0) return empty;
  return serialize(points.slice(0, low).join('') + ellipsis);
}
