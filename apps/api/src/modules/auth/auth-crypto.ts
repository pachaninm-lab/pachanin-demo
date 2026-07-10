import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { requireSecret } from '../../common/config/secrets';
import type { Role } from '../../common/types/request-user';

const JWT_SECRET = requireSecret('JWT_SECRET');
const AUTH_HASH_SECRET = requireSecret('AUTH_HASH_SECRET');

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const SESSION_IDLE_TTL_MS = 12 * 60 * 60 * 1000;
export const REFRESH_FAMILY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = REFRESH_FAMILY_TTL_MS;
export const MFA_ELEVATION_TTL_MS = 10 * 60 * 1000;

export type AccessTokenClaims = {
  sub: string;
  sid: string;
  email: string;
  role: Role;
  orgId: string;
  tenantId: string;
  fullName?: string;
};

export function issueAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(
    {
      sid: claims.sid,
      email: claims.email,
      role: claims.role,
      orgId: claims.orgId,
      tenantId: claims.tenantId,
      fullName: claims.fullName,
    },
    JWT_SECRET,
    {
      subject: claims.sub,
      issuer: 'transparent-price-api',
      audience: 'platform-v7',
      jwtid: randomUUID(),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
  );
}

export function verifyAccessTokenSignature(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, JWT_SECRET, {
    issuer: 'transparent-price-api',
    audience: 'platform-v7',
  }) as jwt.JwtPayload;

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.sid !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.orgId !== 'string' ||
    typeof payload.tenantId !== 'string'
  ) {
    throw new Error('Incomplete access token claims');
  }

  return {
    sub: payload.sub,
    sid: payload.sid,
    email: payload.email,
    role: payload.role as Role,
    orgId: payload.orgId,
    tenantId: payload.tenantId,
    fullName: typeof payload.fullName === 'string' ? payload.fullName : undefined,
  };
}

export function createOpaqueRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function hmacFingerprint(value: string | undefined | null): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return createHmac('sha256', AUTH_HASH_SECRET).update(normalized, 'utf8').digest('hex');
}

export function accountKeyHash(email: string): string {
  const value = hmacFingerprint(email);
  if (!value) throw new Error('Email is required for account fingerprint');
  return value;
}
