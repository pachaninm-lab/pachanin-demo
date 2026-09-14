/**
 * Telling the user where a link is about to take them, before it takes them.
 *
 * The assistant cites sources it chose, and those citations are rendered as
 * anchors that open in a new tab. The destination is whatever the model
 * produced. ASVS V3.7.3 asks that the application say so before navigating
 * outside its own control, and let the person decline.
 *
 * "Outside its control" is decided against the origin of the page the link is
 * on, which is what the browser itself enforces - not against a list of hosts
 * that would drift from the deployment.
 */

/** Schemes a citation may use. Anything else is not a destination we will offer. */
const NAVIGABLE_PROTOCOLS = new Set(['https:', 'http:']);

export type OutboundDestination = {
  /** The absolute URL, as the browser will resolve it. */
  readonly href: string;
  /** The host to show the person, in the form they can recognize. */
  readonly host: string;
  /** False when the link stays on this origin and needs no warning. */
  readonly outbound: boolean;
};

/**
 * Resolve a citation URI against the page it is shown on.
 *
 * Returns null when the value is not a link this application will offer at all:
 * an unparseable URI, or a scheme that is not http(s) - javascript:, data: and
 * blob: are refused here rather than being confirmed and then opened.
 */
export function outboundDestination(raw: unknown, pageOrigin: string): OutboundDestination | null {
  if (typeof raw !== 'string') return null;
  const candidate = raw.trim();
  if (!candidate) return null;

  let url: URL;
  let origin: URL;
  try {
    origin = new URL(pageOrigin);
    url = new URL(candidate, origin);
  } catch {
    return null;
  }
  if (!NAVIGABLE_PROTOCOLS.has(url.protocol)) return null;

  return {
    href: url.toString(),
    host: displayHost(url),
    outbound: url.origin !== origin.origin,
  };
}

/**
 * The host as the browser resolved it, which for an internationalized name is
 * its punycode form.
 *
 * That is deliberate and it is the whole point of showing a host at all: the
 * ASCII form cannot be dressed up as a name it is not, while the decoded form
 * of a homograph reads exactly like the site it imitates. A person who sees
 * xn--80ak6aa92e.com has been told something true; one who sees "apple.com"
 * spelled in Cyrillic has not.
 */
export function displayHost(url: URL): string {
  return url.hostname;
}
