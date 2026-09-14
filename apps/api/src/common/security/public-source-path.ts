/**
 * The public-contour boundary for an AI grounding source link, decided by the
 * same parser that will later resolve it.
 *
 * This existed as a string test: an anchored prefix regex, `includes('..')`,
 * `includes('://')`, and a private-area regex. The value it judges is rendered
 * as `<a href>`, so the thing that actually resolves it is the browser's URL
 * parser - and the two do not agree. The WHATWG URL parser removes tab, line
 * feed and carriage return from a URL before parsing it, so `.<TAB>.` contains
 * no `..` for a string test and is exactly `..` for the parser. Measured:
 * `/platform-v7/.<TAB>./staff` passed every string check and resolves to
 * `/staff`; the same trick reaches `/admin/users`.
 *
 * ASVS V1.5.3 is precisely this - two parsers for one data type disagreeing.
 * The fix is not a better string test, it is to stop having a second parser:
 * the value is resolved here with the parser the browser uses, and the contour
 * rules are applied to what that parser produces.
 */

/**
 * A base that cannot be reached, so an absolute or protocol-relative href
 * changes origin and is refused rather than silently accepted. The same device
 * the web tier uses for redirect destinations.
 */
const PUBLIC_SOURCE_BASE = 'https://public-source.invalid/';

const PUBLIC_CONTOUR = /^\/platform-v7(?:\/|$)/u;

/** Areas inside the platform path that are not public, matched on the resolved path. */
export const PRIVATE_PUBLIC_SOURCE = /^\/platform-v7\/(?:deals|staff|admin|operator|buyer|seller|bank|logistics|driver|elevator|laboratory|surveyor|compliance|arbitrator|executive)(?:\/|$)/u;

/**
 * The canonical path for a public source, or null when the href does not
 * resolve to one. Returning the resolved form matters as much as the check:
 * storing the raw string would put the characters the parser reinterprets back
 * into circulation.
 */
export function publicPlatformSourcePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const candidate = raw.trim();
  if (!candidate) return null;

  let resolved: URL;
  let base: URL;
  try {
    base = new URL(PUBLIC_SOURCE_BASE);
    resolved = new URL(candidate, base);
  } catch {
    return null;
  }
  // An absolute href, a protocol-relative one, or anything carrying credentials
  // leaves the base origin and is not a path inside this application.
  if (resolved.origin !== base.origin) return null;
  if (resolved.username || resolved.password) return null;

  const path = resolved.pathname;
  if (!PUBLIC_CONTOUR.test(path)) return null;
  if (PRIVATE_PUBLIC_SOURCE.test(path)) return null;

  return `${path}${resolved.search}${resolved.hash}`;
}

export function isPublicPlatformSource(raw: unknown): boolean {
  return publicPlatformSourcePath(raw) !== null;
}
