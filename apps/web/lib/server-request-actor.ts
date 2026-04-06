import { createHmac, timingSafeEqual } from 'crypto';
import { ACCESS_COOKIE } from './auth-cookies';
import { isPrivilegedSurfaceRole, roleMatches, toSurfaceRole, type SurfaceRoleKey } from '../../../shared/role-contract';

export type ServerRequestActor = {
  isAuthenticated: boolean;
  surfaceRole: SurfaceRoleKey;
  role: string;
  userId: string | null;
  email: string | null;
  source: 'jwt' | 'test-header' | 'anonymous';
  isPrivileged: boolean;
};

type TokenPayload = {
  sub?: string;
  userId?: string;
  email?: string;
  role?: string;
  surfaceRole?: string;
  exp?: number;
  type?: string;
};

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function parseJson<T>(value: Buffer): T | null {
  try {
    return JSON.parse(value.toString('utf8')) as T;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string) {
  const raw = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  const part = raw
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

function extractBearerToken(request: Request) {
  const authorization = String(request.headers.get('authorization') || '');
  if (authorization.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim();
  return '';
}

function resolveAccessSecret() {
  if (process.env.ACCESS_TOKEN_SECRET) return process.env.ACCESS_TOKEN_SECRET;
  if (process.env.NODE_ENV === 'test') return 'test-access-secret';
  return '';
}

function verifyHs256Jwt(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = parseJson<{ alg?: string }>(base64UrlDecode(headerSegment));
  const payload = parseJson<TokenPayload>(base64UrlDecode(payloadSegment));
  if (!header || !payload || header.alg !== 'HS256') return null;
  if (payload.type && payload.type !== 'access') return null;
  if (payload.exp && payload.exp * 1000 <= Date.now()) return null;
  const secret = resolveAccessSecret();
  if (!secret) return null;
  const expected = createHmac('sha256', secret).update(`${headerSegment}.${payloadSegment}`).digest();
  const provided = base64UrlDecode(signatureSegment);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  return payload;
}

export async function getServerRequestActor(request: Request): Promise<ServerRequestActor> {
  if (process.env.NODE_ENV === 'test') {
    const forcedRole = request.headers.get('x-test-surface-role');
    if (forcedRole) {
      const surfaceRole = toSurfaceRole(forcedRole);
      return {
        isAuthenticated: surfaceRole !== 'GUEST',
        surfaceRole,
        role: surfaceRole,
        userId: request.headers.get('x-test-user-id') || 'test-user',
        email: null,
        source: 'test-header',
        isPrivileged: isPrivilegedSurfaceRole(surfaceRole),
      };
    }
  }

  const token = readCookie(request, ACCESS_COOKIE) || extractBearerToken(request);
  if (!token) {
    return {
      isAuthenticated: false,
      surfaceRole: 'GUEST',
      role: 'GUEST',
      userId: null,
      email: null,
      source: 'anonymous',
      isPrivileged: false,
    };
  }

  const payload = verifyHs256Jwt(token);
  if (!payload) {
    return {
      isAuthenticated: false,
      surfaceRole: 'GUEST',
      role: 'GUEST',
      userId: null,
      email: null,
      source: 'anonymous',
      isPrivileged: false,
    };
  }

  const surfaceRole = toSurfaceRole(payload.surfaceRole || payload.role || 'GUEST');
  return {
    isAuthenticated: surfaceRole !== 'GUEST',
    surfaceRole,
    role: String(payload.role || surfaceRole),
    userId: payload.sub || payload.userId || null,
    email: payload.email || null,
    source: 'jwt',
    isPrivileged: isPrivilegedSurfaceRole(surfaceRole),
  };
}

export function requireAuthenticatedActor(actor: ServerRequestActor) {
  if (actor.isAuthenticated) return { ok: true as const };
  return { ok: false as const, status: 401, reason: 'auth_required' };
}

export function requireActorRole(actor: ServerRequestActor, allowedRoles: string[], reason = 'forbidden') {
  if (!actor.isAuthenticated) return { ok: false as const, status: 401, reason: 'auth_required' };
  if (roleMatches(actor.surfaceRole, allowedRoles)) return { ok: true as const };
  return { ok: false as const, status: 403, reason };
}

export function describeActor(actor: ServerRequestActor) {
  return actor.userId ? `${actor.surfaceRole}:${actor.userId}` : actor.surfaceRole;
}
