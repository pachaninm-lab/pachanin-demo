import { serializeWithinCookieBudget } from './bounded-cookie';

export const STAFF_ACCESS_META_COOKIE = 'pc_staff_access_meta';

/**
 * The staff activation metadata cookie, kept inside the byte budget a browser
 * will actually store.
 *
 * `reason` is operator free text that the API accepts up to 2000 characters,
 * and the cookie value is percent-encoded, which costs six bytes for every
 * Cyrillic character. A 526-character Russian reason - unremarkable in this
 * product - already carries the cookie past 4096 bytes, and a browser handed an
 * oversized cookie stores nothing at all: the staff session is activated
 * upstream and then simply does not work, with no error reported anywhere.
 *
 * Only `reason` is shortened, and only here in the cookie. Nothing reads it
 * back from this cookie: the session check compares accessSessionId, staffRole,
 * accessMode and expiresAt, the revoke path reads accessSessionId, and the
 * activation response carries the untruncated reason straight from the
 * database, which stays the record of it.
 *
 * Returns null when the remaining fields do not fit on their own. The caller
 * then has an upstream session it cannot represent to the browser, which is a
 * failure to report rather than a cookie to write and hope about.
 */
export function staffMetadataCookieValue<T extends { reason: string | null }>(metadata: T): string | null {
  return serializeWithinCookieBudget(
    STAFF_ACCESS_META_COOKIE,
    // Spreading over an existing key keeps its position, so a metadata record
    // that already fits serializes byte-for-byte as it did before this bound.
    (reason) => encodeURIComponent(JSON.stringify({ ...metadata, reason: reason || null })),
    metadata.reason ?? '',
  );
}
