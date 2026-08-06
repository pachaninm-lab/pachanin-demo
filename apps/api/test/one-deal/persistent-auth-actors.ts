import { createHmac } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';
import { PERSISTENT_ACTOR_USER_IDS } from './persistent-actor-identities';

const TEST_PASSWORD = 'demo1234';
const ACCESS_ISSUER = 'transparent-price-api';
const ACCESS_AUDIENCE = 'transparent-price-platform';
const MFA_REQUIRED_FIXTURE_ROLES = new Set<Role>([
  Role.BUYER,
  Role.ACCOUNTING,
  Role.COMPLIANCE_OFFICER,
  Role.ARBITRATOR,
]);

type MembershipRow = {
  id: string;
  organizationId: string;
  role: string;
  organization: { tenantId: string };
  user: { id: string; email: string; fullName: string };
};

type OpaqueAccessClaims = jwt.JwtPayload & {
  sub: string;
  sid: string;
  typ: 'access';
};

export type PersistentActorHarness = {
  actorsByRole: Map<Role, RequestUser>;
  accessTokensByRole: Map<Role, string>;
  primaryAuth: AuthService;
  verifierAuth: AuthService;
  primaryPrisma: AuthPrismaService;
  verifierPrisma: AuthPrismaService;
  verifyWithFreshInstance(): Promise<void>;
  disconnect(): Promise<void>;
};

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 character in TOTP setup secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totp(secret: string, unixMs = Date.now()): string {
  const counter = BigInt(Math.floor(unixMs / 30_000));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

function assertOpaqueAccessToken(accessToken: string, expectedUserId: string): OpaqueAccessClaims {
  const decoded = jwt.decode(accessToken);
  if (!decoded || typeof decoded === 'string') throw new Error('Access token did not decode to JWT claims');
  if (decoded.sub !== expectedUserId || decoded.typ !== 'access' || typeof decoded.sid !== 'string') {
    throw new Error('Access token does not contain the expected opaque identity claims');
  }
  for (const forbidden of ['role', 'orgId', 'organizationId', 'tenantId', 'membershipId']) {
    if (Object.prototype.hasOwnProperty.call(decoded, forbidden)) {
      throw new Error(`Access token leaked server-authoritative claim: ${forbidden}`);
    }
  }
  return decoded as OpaqueAccessClaims;
}

export async function createPersistentActorHarness(
  organizationIds: readonly string[],
): Promise<PersistentActorHarness> {
  const authUrl = String(process.env.AUTH_DATABASE_URL ?? '').trim();
  const jwtSecret = String(process.env.JWT_SECRET ?? '').trim();
  if (!authUrl) throw new Error('AUTH_DATABASE_URL is required for persistent auth actor proof');
  if (!jwtSecret) throw new Error('JWT_SECRET is required for persistent auth actor proof');

  const primaryPrisma = new AuthPrismaService();
  const verifierPrisma = new AuthPrismaService();
  const primaryAuth = new AuthService(new PersistentAuthRepository(primaryPrisma));
  const verifierAuth = new AuthService(new PersistentAuthRepository(verifierPrisma));
  await Promise.all([primaryPrisma.onModuleInit(), verifierPrisma.onModuleInit()]);

  try {
    const [{ current_user: currentUser }] = await primaryPrisma.$queryRaw<Array<{ current_user: string }>>`
      SELECT current_user
    `;
    if (currentUser !== 'one_deal_auth') {
      throw new Error(`Persistent auth harness connected as unexpected principal ${currentUser}`);
    }

    // Resolved through the bounded bootstrap functions rather than by scanning
    // public.users and public.user_orgs. Those scans used to work because this
    // principal held BYPASSRLS; without it a pre-context scan returns nothing,
    // which is the boundary doing its job. The seeded identifiers are known, so
    // the harness asks for exactly the twelve actors it created — the same
    // shape of read the login path performs.
    const rows = await primaryPrisma.$queryRaw<Array<{
      membership_id: string;
      organization_id: string;
      role: string;
      tenant_id: string;
      user_id: string;
      email: string;
      full_name: string;
    }>>`
      SELECT
        membership.membership_id,
        membership.organization_id,
        membership.role,
        membership.tenant_id,
        identity."id" AS user_id,
        identity."email",
        identity."fullName" AS full_name
      FROM unnest(${[...PERSISTENT_ACTOR_USER_IDS]}::text[]) AS seeded(user_id)
      JOIN LATERAL auth.resolve_login_identity_by_id(seeded.user_id) identity ON TRUE
      JOIN LATERAL auth.resolve_login_memberships_ordered(seeded.user_id) membership
        ON membership.is_default
      WHERE membership.organization_id = ANY(${[...organizationIds]}::text[])
      ORDER BY membership.role ASC
    `;

    const memberships: MembershipRow[] = rows.map((row) => ({
      id: row.membership_id,
      organizationId: row.organization_id,
      role: row.role,
      organization: { tenantId: row.tenant_id },
      user: { id: row.user_id, email: row.email, fullName: row.full_name },
    }));
    if (memberships.length === 0) {
      throw new Error('Persistent auth harness resolved no actors through the bootstrap surface');
    }

    const actorsByRole = new Map<Role, RequestUser>();
    const accessTokensByRole = new Map<Role, string>();

    for (const membership of memberships) {
      const role = membership.role as Role;
      const login = await primaryAuth.login({
        email: membership.user.email,
        password: TEST_PASSWORD,
      }) as any;
      const expectedMfa = MFA_REQUIRED_FIXTURE_ROLES.has(role);
      if (Boolean(login.mfaRequired) !== expectedMfa) {
        throw new Error(`Unexpected MFA requirement for ${role}: ${String(login.mfaRequired)}`);
      }

      let accessToken: string;
      if (expectedMfa) {
        if (login.accessToken || !login.challengeToken || !login.setupSecret) {
          throw new Error(`Role ${role} bypassed mandatory MFA enrollment`);
        }
        const verified = await verifierAuth.verifyMfa({
          challengeToken: login.challengeToken,
          code: totp(login.setupSecret),
        }) as any;
        accessToken = verified.accessToken;
        if (!accessToken || !verified.refreshToken) {
          throw new Error(`MFA verification did not issue tokens for ${role}`);
        }
      } else {
        accessToken = login.accessToken;
        if (!accessToken || !login.refreshToken) {
          throw new Error(`Persistent login did not issue tokens for ${role}`);
        }
      }

      const claims = assertOpaqueAccessToken(accessToken, membership.user.id);
      const actor = await verifierAuth.verifyAccessToken(accessToken);
      if (
        actor.id !== membership.user.id
        || actor.role !== role
        || actor.orgId !== membership.organizationId
        || actor.tenantId !== membership.organization.tenantId
        || actor.membershipId !== membership.id
        || !actor.sessionId
      ) {
        throw new Error(`PostgreSQL session projection mismatch for ${role}`);
      }
      if (expectedMfa && (!actor.mfaVerified || !actor.mfaVerifiedAt)) {
        throw new Error(`MFA state was not persisted for ${role}`);
      }

      const injectedClaimsToken = jwt.sign(
        {
          typ: 'access',
          sid: claims.sid,
          role: Role.ADMIN,
          orgId: 'org-attacker-controlled',
          organizationId: 'org-attacker-controlled',
          tenantId: 'tenant-attacker-controlled',
          membershipId: 'membership-attacker-controlled',
        },
        jwtSecret,
        {
          subject: membership.user.id,
          issuer: ACCESS_ISSUER,
          audience: ACCESS_AUDIENCE,
          expiresIn: '5m',
        },
      );
      const reauthorized = await primaryAuth.verifyAccessToken(injectedClaimsToken);
      if (
        reauthorized.role !== role
        || reauthorized.orgId !== membership.organizationId
        || reauthorized.tenantId !== membership.organization.tenantId
        || reauthorized.membershipId !== membership.id
      ) {
        throw new Error(`Injected JWT authority claims overrode PostgreSQL membership for ${role}`);
      }

      const sessions = await primaryPrisma.$queryRaw<Array<{
        id: string;
        status: string;
        membership_id: string;
        organization_id: string;
        tenant_id: string;
      }>>`
        SELECT id, status, membership_id, organization_id, tenant_id
        FROM auth.sessions
        WHERE id = ${actor.sessionId}
      `;
      const session = sessions[0];
      if (
        !session
        || session.status !== 'ACTIVE'
        || session.membership_id !== membership.id
        || session.organization_id !== membership.organizationId
        || session.tenant_id !== membership.organization.tenantId
      ) {
        throw new Error(`Persistent session row mismatch for ${role}`);
      }

      actorsByRole.set(role, actor);
      accessTokensByRole.set(role, accessToken);
    }

    if (actorsByRole.size !== 12 || accessTokensByRole.size !== 12) {
      throw new Error(`Expected 12 persistent actors, got ${actorsByRole.size}/${accessTokensByRole.size}`);
    }

    return {
      actorsByRole,
      accessTokensByRole,
      primaryAuth,
      verifierAuth,
      primaryPrisma,
      verifierPrisma,
      verifyWithFreshInstance: async () => {
        const freshPrisma = new AuthPrismaService();
        const freshAuth = new AuthService(new PersistentAuthRepository(freshPrisma));
        await freshPrisma.onModuleInit();
        try {
          for (const [role, token] of accessTokensByRole) {
            const expected = actorsByRole.get(role);
            const verified = await freshAuth.verifyAccessToken(token);
            if (!expected || verified.id !== expected.id || verified.sessionId !== expected.sessionId || verified.role !== role) {
              throw new Error(`Fresh API instance did not recover persistent session for ${role}`);
            }
          }
        } finally {
          await freshPrisma.onModuleDestroy();
        }
      },
      disconnect: async () => {
        await Promise.all([primaryPrisma.onModuleDestroy(), verifierPrisma.onModuleDestroy()]);
      },
    };
  } catch (error) {
    await Promise.allSettled([primaryPrisma.onModuleDestroy(), verifierPrisma.onModuleDestroy()]);
    throw error;
  }
}
