import type { PlatformRole } from '@/stores/usePlatformV7RStore';

/**
 * Phase 4C-pre — verified session identity for platform-v7 server cabinet access.
 *
 * The ONLY sanctioned source of a server-trusted role is a cryptographically
 * verified HS256 JWT (the token the API signs with JWT_SECRET). This module
 * deliberately does NOT read — and must never be fed from — the URL path, query
 * string, the writable `pc-role` cookie, `localStorage`, client-side role guards,
 * or the unverified `pc_session_present` JSON cookie. A demo/fake token
 * (`demo.<base64>`), a bad signature, a wrong/expired token, or an unmapped role
 * all resolve to `null` → the caller treats it as `unknown` and (in report-only)
 * never blocks.
 *
 * Edge-safe: uses Web Crypto (`crypto.subtle`), no Node-only APIs, never throws.
 */

// API Role (apps/api request-user) → platform-v7 cabinet role. Partial by design:
// API roles without a 1:1 cabinet (ACCOUNTING / GUEST) and cabinets without a 1:1
// API role (surveyor / bank / arbitrator / compliance) resolve to null = unknown.
const API_ROLE_TO_CABINET: Readonly<Record<string, PlatformRole>> = {
  FARMER: 'seller',
  BUYER: 'buyer',
  LOGISTICIAN: 'logistics',
  DRIVER: 'driver',
  LAB: 'lab',
  ELEVATOR: 'elevator',
  EXECUTIVE: 'executive',
  SUPPORT_MANAGER: 'operator',
  ADMIN: 'operator',
};

/** Maps a verified API role claim to a platform-v7 cabinet role, or null if unmapped. */
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

/**
 * Verifies an HS256 JWT against `secret` and returns its claims, or null. Never throws.
 * Rejects empty tokens, demo fake tokens, non-3-segment tokens, non-HS256 headers,
 * and bad signatures.
 */
export async function verifyHs256Jwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  if (!token || !secret) return null;
  if (token.startsWith('demo.')) return null; // demo fake token — not cryptographic
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

/**
 * Resolves the platform-v7 cabinet role from a verified JWT only. Returns null
 * (→ unknown) for any missing/demo/invalid/expired/unmapped case. Never throws.
 */
export async function readVerifiedCabinetRole(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number,
): Promise<PlatformRole | null> {
  if (!token) return null;
  const claims = await verifyHs256Jwt(token, secret);
  if (!claims) return null;
  if (typeof claims.exp === 'number' && claims.exp <= nowSeconds) return null; // expired
  if (typeof claims.nbf === 'number' && claims.nbf > nowSeconds) return null; // not yet valid
  return mapApiRoleToCabinetRole(claims.role);
}
