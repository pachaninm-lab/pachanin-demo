import type { PlatformRole } from '@/stores/usePlatformV7RStore';

/**
 * Verified session identity for platform-v7 server cabinet access.
 *
 * The only sanctioned source of a server-trusted role is a cryptographically
 * verified HS256 JWT signed by the API. URL, query, writable cookies,
 * localStorage and client role state are never authority sources.
 */

const API_ROLE_TO_CABINET: Readonly<Record<string, PlatformRole>> = {
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
};

const VALID_CABINET_ROLES: ReadonlySet<string> = new Set<PlatformRole>([
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
]);

export type VerifiedCabinetSessionContext = {
  role: PlatformRole;
  organizationId: string | null;
  tenantId: string | null;
  ownerAccess: boolean;
};

export function mapApiRoleToCabinetRole(apiRole: unknown): PlatformRole | null {
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
): Promise<PlatformRole | null> {
  if (!token) return null;
  const claims = await verifyHs256Jwt(token, secret);
  if (!claims) return null;
  if (typeof claims.exp === 'number' && claims.exp <= nowSeconds) return null;
  if (typeof claims.nbf === 'number' && claims.nbf > nowSeconds) return null;
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
        cab: role,
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
  const cab = claims.cab;
  if (typeof cab !== 'string' || !VALID_CABINET_ROLES.has(cab)) return null;
  return {
    role: cab as PlatformRole,
    organizationId: typeof claims.org === 'string' ? claims.org : null,
    tenantId: typeof claims.tenant === 'string' ? claims.tenant : null,
    ownerAccess: claims.ownerAccess === true,
  };
}

export async function readVerifiedCabinetSessionRole(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number,
): Promise<PlatformRole | null> {
  return (await readVerifiedCabinetSessionContext(token, secret, nowSeconds))?.role || null;
}
