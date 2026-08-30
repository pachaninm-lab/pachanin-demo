/**
 * Protocol safety for URLs this application accepts from a partner and later
 * fetches.
 *
 * ASVS 5.0 V1.2.2 asks that only safe URL protocols be permitted when a URL is
 * built or accepted from untrusted data, and names javascript: and data: as
 * ones to disallow. A partner registers a webhook URL through the partner API;
 * it was stored verbatim, with no validator of any kind at registration and no
 * check at either place that later fetches it.
 *
 * What this does NOT do is decide where the URL points. Blocking loopback,
 * link-local and private address ranges - and the DNS rebinding that defeats a
 * naive version of that check - is server-side request forgery, assessed
 * separately under V1.3.6, and it stays FAIL. A URL passing this check is
 * proved to use a safe scheme, not proved to be safe to fetch.
 */

/**
 * The schemes an outbound webhook may use.
 *
 * http is included deliberately. This requirement is about the scheme being a
 * safe kind, not about transport confidentiality - that is V12 - and narrowing
 * to https alone would silently break every partner already registered over
 * http, which is a product decision rather than this control's to make. It is
 * recorded here so the choice is visible rather than implied by an omission.
 */
export const SAFE_OUTBOUND_PROTOCOLS: readonly string[] = ['https:', 'http:'];

export type OutboundUrlProblem =
  | 'OUTBOUND_URL_UNPARSEABLE'
  | 'OUTBOUND_URL_PROTOCOL_NOT_ALLOWED'
  | 'OUTBOUND_URL_HAS_CREDENTIALS'
  | 'OUTBOUND_URL_NO_HOST';

/**
 * Returns the reason this URL may not be fetched, or null when it may.
 *
 * Returning a reason rather than throwing lets the dispatcher record a refusal
 * against one subscription and carry on with the rest, while the registration
 * endpoint turns the same reason into a rejection.
 */
export function outboundUrlProblem(raw: unknown): OutboundUrlProblem | null {
  if (typeof raw !== 'string' || raw.trim() === '') return 'OUTBOUND_URL_UNPARSEABLE';

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return 'OUTBOUND_URL_UNPARSEABLE';
  }

  if (!SAFE_OUTBOUND_PROTOCOLS.includes(parsed.protocol)) {
    return 'OUTBOUND_URL_PROTOCOL_NOT_ALLOWED';
  }

  // javascript: and data: carry their payload in the path and have no host, so
  // this also catches a scheme that were ever added to the allowlist by mistake.
  if (parsed.hostname === '') return 'OUTBOUND_URL_NO_HOST';

  // Credentials in the URL would be sent on every delivery, and would appear in
  // any log line that records the destination.
  if (parsed.username !== '' || parsed.password !== '') {
    return 'OUTBOUND_URL_HAS_CREDENTIALS';
  }

  return null;
}

/** True when the URL may be fetched. */
export function isSafeOutboundUrl(raw: unknown): boolean {
  return outboundUrlProblem(raw) === null;
}
