/**
 * Classifies a non-OK auth-service answer to a password login.
 *
 * The BFF used to report every non-OK upstream status as INVALID_CREDENTIALS.
 * That made a wrong password, an organization that is not yet verified, a
 * missing API route and an API outage look identical, both to the person
 * signing in and in the server log. The classes below are the ones the auth
 * service already distinguishes:
 *
 * - 401/400: the credentials were not proven. Unknown and inactive accounts
 *   stay inside this class (the API maps USER_NOT_ACTIVE to 401), so no account
 *   enumeration is introduced here.
 * - 429: the pre-auth or account throttle answered.
 * - 403 with a post-proof access reason: the password WAS proven and the API
 *   deliberately names the membership/organization state. Only the exact
 *   reasons below are accepted; any other 403 is not trusted as a credential
 *   or access answer.
 * - anything else (403 without a known reason, 404, 5xx, malformed): the auth
 *   service did not give a usable answer.
 */
export type LoginFailureCode =
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'ACCESS_NOT_ACTIVE'
  | 'AUTH_SERVICE_UNAVAILABLE';

export type LoginFailureClass = {
  code: LoginFailureCode;
  status: 401 | 403 | 429 | 503;
};

export const POST_PROOF_ACCESS_DENIALS: ReadonlySet<string> = new Set([
  'NO_ACTIVE_MEMBERSHIP',
  'MEMBERSHIP_NOT_ACTIVE',
  'ORGANIZATION_NOT_VERIFIED',
  'MEMBERSHIP_ROLE_INVALID',
]);

function upstreamReason(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

export function classifyUpstreamLoginFailure(upstreamStatus: number, payload: unknown): LoginFailureClass {
  if (upstreamStatus === 429) return { code: 'RATE_LIMITED', status: 429 };
  if (upstreamStatus === 401 || upstreamStatus === 400) return { code: 'INVALID_CREDENTIALS', status: 401 };
  if (upstreamStatus === 403 && POST_PROOF_ACCESS_DENIALS.has(upstreamReason(payload))) {
    return { code: 'ACCESS_NOT_ACTIVE', status: 403 };
  }
  return { code: 'AUTH_SERVICE_UNAVAILABLE', status: 503 };
}

/**
 * One structured, redacted line per refused password login. It carries no
 * e-mail, password, token, cookie or IP: only the correlation id the browser
 * also receives, the classified code, the upstream status class and the
 * realm. That is enough to tell the classes above apart in production logs.
 */
export function logLoginRefusal(entry: {
  correlationId: string;
  controlPlane: boolean;
  code: string;
  upstreamStatus?: number;
  reason?: string;
}) {
  console.warn('auth_login_refused', JSON.stringify({
    correlationId: entry.correlationId,
    controlPlane: entry.controlPlane,
    code: entry.code,
    ...(typeof entry.upstreamStatus === 'number' ? { upstreamStatus: entry.upstreamStatus } : {}),
    ...(entry.reason ? { reason: entry.reason } : {}),
  }));
}
