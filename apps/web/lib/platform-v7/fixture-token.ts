/**
 * Audience binding for the controlled test fixture contour.
 *
 * Four surfaces accept a fixture token: the identity probe at /auth/me, the
 * staff proxy at /staff/[...path], the staff page, and the controlled branch of
 * the owner cabinet route. Each verified the signature and then admitted the
 * token on a purpose flag - testAccess, with owner or a role where relevant.
 * That is a real binding, and it is not the one ASVS 5.0 V9.2.3 asks for: it
 * says the token is a fixture token, not which service it was minted for. So a
 * token issued for any one of the four was accepted by the other three, and
 * replay across those service boundaries worked by construction.
 *
 * Each surface now has its own audience and accepts only that one.
 *
 * The type is checked as well, so a token that carries the right audience but
 * was issued as something else is refused rather than inspected further - the
 * two checks are independent and a mutation of either is caught on its own.
 *
 * No minting helper is exported, and none belongs here. Nothing in this
 * repository mints these tokens; they come from outside it. Adding a first-party
 * way to issue a credential that four surfaces trust would be a larger decision
 * than the one this closes, and the negative cases prove the refusals without
 * needing one.
 */

export const FIXTURE_TOKEN_TYPE = 'fixture';

export const FIXTURE_AUDIENCE = {
  /** GET /auth/me - reports the fixture identity. */
  identityProbe: 'pc-fixture-auth-me',
  /** /staff/[...path] - proxies staff API calls for the fixture owner. */
  staffProxy: 'pc-fixture-staff-proxy',
  /** The staff page's controlled identity verification. */
  staffPage: 'pc-fixture-staff-page',
  /** The controlled branch of /platform-v7/staff/open-cabinet. */
  ownerCabinet: 'pc-fixture-owner-cabinet',
} as const;

export type FixtureAudience = (typeof FIXTURE_AUDIENCE)[keyof typeof FIXTURE_AUDIENCE];

/** `aud` is a string or an array of strings in RFC 7519; both must be handled. */
function audienceIncludes(claim: unknown, expected: string): boolean {
  if (typeof claim === 'string') return claim === expected;
  return Array.isArray(claim) && claim.includes(expected);
}

/**
 * Whether these already-signature-verified claims were issued for this service.
 *
 * Signature verification stays with the caller, because each surface resolves
 * its own secret. This decides only the question the signature cannot answer:
 * the token is genuine, but was it meant for me.
 */
export function fixtureTokenIsForService(
  claims: Record<string, unknown> | null | undefined,
  audience: FixtureAudience,
): boolean {
  if (!claims) return false;
  if (claims.typ !== FIXTURE_TOKEN_TYPE) return false;
  return audienceIncludes(claims.aud, audience);
}
