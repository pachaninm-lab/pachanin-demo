import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export type VerifiedCabinetRole = PlatformRole | 'organization';

/**
 * Verified session identity for platform-v7 server cabinet access.
 *
 * The only sanctioned source of a server-trusted role is a cryptographically
 * verified HS256 JWT signed by the API. URL, query, writable cookies,
 * localStorage and client role state are never authority sources.
 */

const API_ROLE_TO_CABINET: Readonly<Record<string, VerifiedCabinetRole>> = {
  FARMER: 'seller',
  BUYER: 'buyer',
  LOGISTICIAN: 'logistics',
  DRIVER: 'driver',
  SURVEYOR: 'surveyor',
  LAB: 'lab',
  ELEVATOR: 'elevator',
  ACCOUNTING: 'bank',
  BANK: 'bank',
  ARBITRATOR: 'arbitrator',
  COMPLIANCE_OFFICER: 'compliance',
  EXECUTIVE: 'executive',
  SUPPORT_MANAGER: 'operator',
  ADMIN: 'operator',
  GUEST: 'organization',
};

const VALID_CABINET_ROLES: ReadonlySet<string> = new Set<VerifiedCabinetRole>([
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive', 'organization',
]);

export type VerifiedCabinetSessionContext = {
  role: VerifiedCabinetRole;
  userId: string | null;
  membershipId: string | null;
  organizationId: string | null;
  tenantId: string | null;
  ownerAccess: boolean;
};

/**
 * Purpose binding for tokens this module accepts.
 *
 * Cabinet sessions and API access tokens are both HS256 under JWT_SECRET, so a
 * signature check alone says only that the platform minted the token - not what
 * it minted it for. Until now the two were told apart by which claim each
 * happened to carry: a cabinet token has `cab`, an access token does not, and
 * an access token carries no `role` claim so the role reader returned null for
 * it. Both are true today and neither is a check. Adding one `role` claim to
 * the access token, for any reason, would have turned the web tier into
 * something that derives a cabinet role from a credential minted for the API.
 *
 * ASVS V9.2.2 asks the receiving service to verify the type, and V9.2.3 the
 * audience. Both are verified here now, so the separation is structural.
 *
 * The access values are the API's own, restated because the web app cannot
 * import from it; tokenPurposeBinding.spec.ts reads access-token.ts and fails
 * if they ever drift apart.
 */
export const CABINET_TOKEN_TYPE = 'cabinet';
export const CABINET_TOKEN_AUDIENCE = 'pc-v7-cabinet';
const API_ACCESS_TOKEN_TYPE = 'access';
const API_ACCESS_ISSUER = 'transparent-price-api';
const API_ACCESS_AUDIENCE = 'transparent-price-platform';

/** `aud` is a string or an array of strings in RFC 7519; both must be handled. */
function audienceIncludes(claim: unknown, expected: string): boolean {
  if (typeof claim === 'string') return claim === expected;
  return Array.isArray(claim) && claim.includes(expected);
}

export function mapApiRoleToCabinetRole(apiRole: unknown): VerifiedCabinetRole | null {
  if (typeof apiRole !== 'string') return null;
  return API_ROLE_TO_CABINET[apiRole] ?? null;
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function base64UrlToJson(input: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(input);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function verifyHs256Jwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  if (!token || !secret) return null;
  if (token.startsWith('demo.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const header = base64UrlToJson(headerB64);
    if (!header || header.alg !== 'HS256') return null;
    const signature = base64UrlToBytes(signatureB64);
    if (!signature) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return null;
    return base64UrlToJson(payloadB64);
  } catch {
    return null;
  }
}

export async function readVerifiedCabinetRole(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number,
): Promise<VerifiedCabinetRole | null> {
  if (!token) return null;
  const claims = await verifyHs256Jwt(token, secret);
  if (!claims) return null;
  if (typeof claims.exp === 'number' && claims.exp <= nowSeconds) return null;
  if (typeof claims.nbf === 'number' && claims.nbf > nowSeconds) return null;
  // This reads a credential the API minted, so it is accepted only as what the
  // API minted it as. A cabinet session, a fixture token or anything else
  // signed with the same secret is refused here rather than inspected for a
  // role claim it was never meant to carry.
  if (claims.typ !== API_ACCESS_TOKEN_TYPE) return null;
  if (claims.iss !== API_ACCESS_ISSUER) return null;
  if (!audienceIncludes(claims.aud, API_ACCESS_AUDIENCE)) return null;
  return mapApiRoleToCabinetRole(claims.role);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function signCabinetSession(
  role: string,
  secret: string,
  opts: {
    readonly nowSeconds: number;
    readonly ttlSeconds: number;
    readonly userId?: string | null;
    readonly membershipId?: string | null;
    readonly organizationId?: string | null;
    readonly tenantId?: string | null;
    readonly ownerAccess?: boolean;
  },
): Promise<string | null> {
  if (!secret || !VALID_CABINET_ROLES.has(role)) return null;
  try {
    const enc = new TextEncoder();
    const header = bytesToBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const payload = bytesToBase64Url(
      enc.encode(JSON.stringify({
        typ: CABINET_TOKEN_TYPE,
        aud: CABINET_TOKEN_AUDIENCE,
        cab: role,
        sub: opts.userId || undefined,
        membership: opts.membershipId || undefined,
        org: opts.organizationId || undefined,
        tenant: opts.tenantId || undefined,
        ownerAccess: opts.ownerAccess === true,
        iat: opts.nowSeconds,
        exp: opts.nowSeconds + opts.ttlSeconds,
      })),
    );
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${payload}`));
    return `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
  } catch {
    return null;
  }
}

export async function readVerifiedCabinetSessionContext(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number,
): Promise<VerifiedCabinetSessionContext | null> {
  if (!token) return null;
  const claims = await verifyHs256Jwt(token, secret);
  if (!claims) return null;
  if (typeof claims.exp === 'number' && claims.exp <= nowSeconds) return null;
  if (typeof claims.nbf === 'number' && claims.nbf > nowSeconds) return null;
  if (claims.typ !== CABINET_TOKEN_TYPE) return null;
  if (!audienceIncludes(claims.aud, CABINET_TOKEN_AUDIENCE)) return null;
  const cab = claims.cab;
  if (typeof cab !== 'string' || !VALID_CABINET_ROLES.has(cab)) return null;
  return {
    role: cab as VerifiedCabinetRole,
    userId: typeof claims.sub === 'string' ? claims.sub : null,
    membershipId: typeof claims.membership === 'string' ? claims.membership : null,
    organizationId: typeof claims.org === 'string' ? claims.org : null,
    tenantId: typeof claims.tenant === 'string' ? claims.tenant : null,
    ownerAccess: claims.ownerAccess === true,
  };
}

export async function readVerifiedCabinetSessionRole(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number,
): Promise<VerifiedCabinetRole | null> {
  return (await readVerifiedCabinetSessionContext(token, secret, nowSeconds))?.role || null;
}
