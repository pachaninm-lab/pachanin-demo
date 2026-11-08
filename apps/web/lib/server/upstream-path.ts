/**
 * Serialize catch-all route segments into the path of an upstream URL.
 *
 * Next.js hands a route handler its catch-all segments already percent-decoded
 * once. A decoded segment is data, and data concatenated into a URL is parsed
 * again by `fetch()`, under the WHATWG URL algorithm:
 *
 * - a segment `x?a=1#` starts a query and a fragment, so the upstream receives a
 *   different path from the one an allowlist approved, with a query it never
 *   saw;
 * - a segment `%2e%2e` (what the raw request `%252e%252e` decodes to) is a
 *   dot-segment, so the upstream path walks above the prefix the route meant to
 *   confine it to.
 *
 * Each segment is therefore percent-encoded on its own before it is joined, and
 * the upstream receives exactly the segments that were checked. A literal `.`
 * or `..` survives encoding unchanged and is still a dot-segment, so it is
 * refused rather than encoded.
 */
export function encodeUpstreamPath(segments: readonly string[]): string | null {
  if (segments.some((segment) => segment === '.' || segment === '..')) return null;
  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}
