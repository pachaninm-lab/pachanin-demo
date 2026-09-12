/**
 * ASVS 5.0 V3.7.2: a redirect leaves this origin only to an allowlisted place.
 *
 * Three routes guarded their redirect destination with `to.startsWith('/')` and
 * then built `new URL(to, request.url)`. A protocol-relative URL satisfies that
 * test and resolves off-site:
 *
 *     new URL('//evil.example/pwn', 'https://app.example.ru/x')
 *       -> https://evil.example/pwn
 *
 * So do `/\evil.example` and `///evil.example`, because the URL parser treats a
 * backslash as a slash in the authority position and collapses repeated slashes.
 * The check reads like an origin check and is a first-character check.
 *
 * This resolves the candidate the way the browser will and then compares the
 * resulting origin, which is the only comparison that cannot be spelled around.
 * Characters browsers strip from a URL before resolving it - tab, newline,
 * carriage return and other controls - are rejected outright rather than
 * normalised, because normalising them here would mean guessing which of them
 * this particular browser removes.
 */

const STRIPPED_BY_BROWSERS = /[\u0000-\u001F\u007F]/u;

/**
 * The same-origin path a destination resolves to, or null if it leaves the
 * origin, cannot be parsed, or is spelled in a way a browser would rewrite.
 *
 * Returns a root-relative string, never an absolute URL, so a caller cannot
 * accidentally hand an origin back to `new URL`.
 */
export function sameOriginDestination(raw: unknown, base: string): string | null {
  if (typeof raw !== 'string') return null;
  const candidate = raw.trim();
  if (!candidate) return null;
  if (STRIPPED_BY_BROWSERS.test(candidate)) return null;

  let resolved: URL;
  let origin: URL;
  try {
    origin = new URL(base);
    resolved = new URL(candidate, origin);
  } catch {
    return null;
  }
  if (resolved.origin !== origin.origin) return null;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

/**
 * The destination to redirect to: the candidate if it stays on this origin, and
 * the fallback otherwise. The fallback is resolved by the same rule, so a
 * mistake in a caller's fallback cannot reintroduce what this exists to prevent.
 */
export function safeRedirectDestination(raw: unknown, base: string, fallback = '/'): string {
  return sameOriginDestination(raw, base) ?? sameOriginDestination(fallback, base) ?? '/';
}
