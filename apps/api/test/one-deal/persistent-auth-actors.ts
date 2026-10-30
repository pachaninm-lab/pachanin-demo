import { createHmac, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { AuthPrismaService } from '../../src/modules/auth/auth-prisma.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';
import { OrganizationInvitationService } from '../../src/modules/auth/organization-invitation.service';
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

export function totp(secret: string, unixMs = Date.now()): string {
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

function seededEmail(userId: string): string {
  if (!userId.endsWith('-e2e')) throw new Error(`Unexpected persistent actor id ${userId}`);
  return `${userId.slice(0, -'-e2e'.length)}@demo.ru`;
}

async function proveRestrictedMfaRecovery(
  primaryAuth: AuthService,
  verifierAuth: AuthService,
  primaryPrisma: AuthPrismaService,
) {
  const adminUrl = new URL(String(process.env.ONE_DEAL_ADMIN_URL ?? ''));
  const authUrl = new URL(String(process.env.AUTH_DATABASE_URL ?? ''));
  if (process.env.NODE_ENV !== 'test'
    || !['localhost', '127.0.0.1', 'postgres'].includes(adminUrl.hostname)
    || adminUrl.host !== authUrl.host || adminUrl.pathname !== authUrl.pathname
    || !/^\/one_deal_(e2e|restore)$/.test(adminUrl.pathname)
    || adminUrl.username === authUrl.username) {
    throw new Error('Restricted MFA proof requires separate principals in the same disposable one-deal database');
  }
  const check = (condition: unknown, reason: string) => { if (!condition) throw new Error(reason); };
  const denied = async (operation: Promise<unknown>, status: number) => {
    const result = await Promise.allSettled([operation]);
    check(result[0].status === 'rejected', 'Expected a genuine rejected auth proof');
    if (result[0].status === 'rejected') {
      check(result[0].reason?.getStatus?.() === status, 'Auth denial must not be a database/fixture error');
    }
  };
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  const previousDeliveryKey = process.env.ORGANIZATION_INVITATION_DELIVERY_KEY;
  const configuredDeliveryKey = previousDeliveryKey?.trim() ?? '';
  const deliveryKey = configuredDeliveryKey.length >= 32
    ? configuredDeliveryKey : randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  process.env.ORGANIZATION_INVITATION_DELIVERY_KEY = deliveryKey;
  try {
    // Only seed fresh disposable identities as admin. All authentication,
    // enrollment and recovery operations below use the restricted API clients.
    const key = randomUUID();
    const organization = await admin.organization.create({ data: {
      inn: '79' + BigInt('0x' + key.replaceAll('-', '').slice(0, 12)).toString().padStart(10, '0').slice(-10),
      name: 'Restricted MFA proof', status: 'VERIFIED', kycStatus: 'APPROVED', amlStatus: 'CLEAR', verifiedAt: new Date(),
    } });
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const createSubject = async (suffix: string, role: Role, isOrgAdmin: boolean) => {
      const user = await admin.user.create({ data: {
        email: `restricted-${suffix}-${key}@auth.test`, passwordHash, fullName: 'Restricted MFA proof', status: 'ACTIVE',
      } });
      const membership = await admin.userOrg.create({ data: {
        userId: user.id, organizationId: organization.id, role, status: 'ACTIVE', isDefault: true, isOrgAdmin,
      } });
      return { user, membership };
    };
    const manager = await createSubject('manager', Role.BUYER, true);
    const subject = await createSubject('subject', Role.COMPLIANCE_OFFICER, false);
    const login = async (email: string) => {
      const result = await primaryAuth.login({ email, password: TEST_PASSWORD }) as any;
      check(result.mfaRequired === false && result.user?.mfaVerified === false && result.accessToken,
        'Restricted password login must issue an honest ACTIVE session');
      const actor = await verifierAuth.verifyAccessToken(result.accessToken);
      check(actor.mfaVerified === false, 'Fresh API must observe password assurance');
      return { token: String(result.accessToken), actor };
    };
    const enroll = async (session: Awaited<ReturnType<typeof login>>) => {
      const challenge = await primaryAuth.startMfaStepUp(session.actor);
      check(challenge.enrollmentRequired === true && challenge.setupSecret, 'Explicit enrollment must provide its own secret');
      const [state] = await primaryPrisma.$queryRaw<Array<{ mfa_last_totp_counter: bigint | null }>>`
        SELECT mfa_last_totp_counter FROM auth.credential_states WHERE user_id = ${session.actor.id}
      `;
      check(state.mfa_last_totp_counter === null, 'New authenticator must not inherit the retired secret counter');
      const proof = await verifierAuth.verifyMfaStepUp(session.actor, {
        challengeToken: challenge.challengeToken, code: totp(challenge.setupSecret!),
      });
      check(proof.mfaVerified === true && proof.backupCodes?.length === 8, 'Actual TOTP enrollment must produce eight backup codes');
      check((await primaryAuth.verifyAccessToken(session.token)).mfaVerified === true, 'Restricted API must recover actual TOTP assurance');
      return { challenge, secret: challenge.setupSecret!, codes: proof.backupCodes! };
    };
    const managerSession = await login(manager.user.email);
    await enroll(managerSession);
    const subjectSession = await login(subject.user.email);
    const enrollment = await enroll(subjectSession);
    const hashes = async () => (await primaryPrisma.$queryRaw<Array<{ mfa_backup_hashes: unknown }>>`
      SELECT mfa_backup_hashes FROM auth.credential_states WHERE user_id = ${subject.user.id}
    `)[0].mfa_backup_hashes;
    const originalHashes = await hashes();
    const followup = await primaryAuth.startMfaStepUp(subjectSession.actor);
    const [consumed] = await primaryPrisma.$queryRaw<Array<{ mfa_last_totp_counter: bigint | null }>>`
      SELECT mfa_last_totp_counter FROM auth.credential_states WHERE user_id = ${subject.user.id}
    `;
    check(consumed.mfa_last_totp_counter !== null, 'Enrollment must consume a real TOTP counter');
    // The runtime accepts only the current step. Wait for the actual consumed
    // step to end rather than submitting a future code or changing its policy.
    const delay = Math.max(0, (Number(consumed.mfa_last_totp_counter) + 1) * 30_000 + 100 - Date.now());
    check(delay <= 30_100, 'Consumed counter must belong to the current or a past step');
    await new Promise<void>(resolve => setTimeout(resolve, delay));
    const usedTotpCode = totp(enrollment.secret);
    await verifierAuth.verifyMfaStepUp(subjectSession.actor, {
      challengeToken: followup.challengeToken, code: usedTotpCode,
    });
    check(JSON.stringify(await hashes()) === JSON.stringify(originalHashes), 'TOTP must preserve all backup hashes');
    const replayTotp = await primaryAuth.startMfaStepUp(subjectSession.actor);
    await denied(verifierAuth.verifyMfaStepUp(subjectSession.actor, {
      challengeToken: replayTotp.challengeToken, code: usedTotpCode,
    }), 401);
    const finalizer = async (userId: string) => (await primaryPrisma.$queryRaw<Array<{ updated: boolean }>>`
      SELECT updated FROM auth.finalize_authenticated_user_mfa(
        ${userId}, ${subjectSession.actor.sessionId!}, ${enrollment.challenge.challengeToken.split('.')[0]}
      )
    `)[0].updated;
    check(await finalizer(manager.user.id) === false, 'Finalizer must reject another existing identity');
    check(await finalizer(subject.user.id) === false, 'Finalizer must reject a historical proof in a later transaction');

    const spend = await primaryAuth.startMfaStepUp(subjectSession.actor);
    await verifierAuth.verifyMfaStepUp(subjectSession.actor, { challengeToken: spend.challengeToken, code: enrollment.codes[0] });
    const replay = await primaryAuth.startMfaStepUp(subjectSession.actor);
    await denied(verifierAuth.verifyMfaStepUp(subjectSession.actor, { challengeToken: replay.challengeToken, code: enrollment.codes[0] }), 401);
    const sessions = await Promise.all([login(subject.user.email), login(subject.user.email)]);
    const challenges = await Promise.all(sessions.map(session => primaryAuth.startMfaStepUp(session.actor)));
    const results = await Promise.allSettled(sessions.map((session, index) =>
      (index ? verifierAuth : primaryAuth).verifyMfaStepUp(session.actor, {
        challengeToken: challenges[index].challengeToken, code: enrollment.codes[1],
      })));
    check(results.filter(result => result.status === 'fulfilled').length === 1, 'Concurrent backup proof must have exactly one winner');
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status === 'rejected') check(result.reason?.getStatus?.() === 401, 'Concurrent loser must be an auth denial');
      else check(result.value.mfaVerified === true, 'Concurrent winner must prove actual MFA');
      const actor = await verifierAuth.verifyAccessToken(sessions[index].token);
      check(actor.mfaVerified === (result.status === 'fulfilled'), 'Concurrent loser must retain honest password assurance');
    }
    const remainingHashes = await hashes();
    check(Array.isArray(remainingHashes) && remainingHashes.length === 6, 'Two consumed backup codes must leave exactly six');

    const recovery = new OrganizationInvitationService(primaryPrisma, new PersistentAuthRepository(primaryPrisma));
    const initiated = await recovery.resetMembershipMfa(
      await verifierAuth.verifyAccessToken(managerSession.token), subject.membership.id, subject.membership.version,
      'Restricted MFA recovery after support identity review', `restricted-reset-${key}`, `restricted-recovery-${key}`, deliveryKey,
    );
    check(initiated.recoveryDelivery?.token, 'Authorized recovery must produce its bound delivery token');
    const recoveryToken = initiated.recoveryDelivery!.token;
    const beforeWrongPassword = await hashes();
    await denied(recovery.confirmMfaRecovery({ token: recoveryToken, password: 'wrong-password' }, `restricted-wrong-${key}`, deliveryKey), 400);
    check(JSON.stringify(await hashes()) === JSON.stringify(beforeWrongPassword), 'Wrong recovery password must leave credentials unchanged');
    check((await verifierAuth.verifyAccessToken(subjectSession.token)).mfaVerified === true, 'Wrong recovery proof must not revoke the current session');
    const recovered = await recovery.confirmMfaRecovery({ token: recoveryToken, password: TEST_PASSWORD }, `restricted-confirm-${key}`, deliveryKey);
    check(recovered.sessionsRevoked === true && recovered.mfaReenrollmentRequired === true, 'Recovery must revoke sessions and require fresh enrollment');
    for (const oldSession of [subjectSession, ...sessions]) await denied(verifierAuth.verifyAccessToken(oldSession.token), 401);
    await denied(recovery.confirmMfaRecovery({ token: recoveryToken, password: TEST_PASSWORD }, `restricted-replay-${key}`, deliveryKey), 400);
    const recoveredSession = await login(subject.user.email);
    const restored = await enroll(recoveredSession);
    check(restored.secret !== enrollment.secret, 'Recovery must replace the old TOTP secret');
    const freshPrisma = new AuthPrismaService();
    try {
      await freshPrisma.onModuleInit();
      const freshAuth = new AuthService(new PersistentAuthRepository(freshPrisma));
      check((await freshAuth.verifyAccessToken(recoveredSession.token)).mfaVerified === true, 'New API instance must recover completed re-enrollment');
    } finally { await freshPrisma.onModuleDestroy(); }
  } finally {
    if (previousDeliveryKey === undefined) delete process.env.ORGANIZATION_INVITATION_DELIVERY_KEY;
    else process.env.ORGANIZATION_INVITATION_DELIVERY_KEY = previousDeliveryKey;
    await admin.$disconnect();
  }
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

    await proveRestrictedMfaRecovery(primaryAuth, verifierAuth, primaryPrisma);

    // Do not rediscover identities with the retired resolve_login_identity* or
    // resolve_login_memberships* functions. The harness knows the twelve fixture
    // email addresses it seeded and enters through AuthService.login exactly as
    // a real client does: three-field credential lookup, bcrypt proof, then the
    // bounded membership/context lookup. The authoritative role/tenant/org is
    // read only from the resulting server-side session projection.
    const actorsByRole = new Map<Role, RequestUser>();
    const accessTokensByRole = new Map<Role, string>();

    for (const expectedUserId of PERSISTENT_ACTOR_USER_IDS) {
      const email = seededEmail(expectedUserId);
      const login = await primaryAuth.login({
        email,
        password: TEST_PASSWORD,
      }) as any;
      const role = login?.user?.role as Role | undefined;
      if (!role) throw new Error(`Persistent login did not resolve a role for ${expectedUserId}`);
      const expectedMfa = MFA_REQUIRED_FIXTURE_ROLES.has(role);
      if (login.mfaRequired !== false || !login.accessToken || !login.refreshToken || login.user.mfaVerified !== false) {
        throw new Error(`Password login did not issue an honest active session for ${role}`);
      }
      const accessToken: string = login.accessToken;
      const passwordActor = await verifierAuth.verifyAccessToken(accessToken);
      if (passwordActor.mfaVerified) throw new Error(`Password login falsely attested MFA for ${role}`);
      // Deal fixtures explicitly prove possession for the protected commands
      // exercised below; opening a cabinet itself requires only the password.
      if (expectedMfa) {
        const enrollment = await primaryAuth.startMfaStepUp(passwordActor);
        if (!enrollment.setupSecret) throw new Error(`Fixture ${role} requires explicit MFA enrollment`);
        const verified = await verifierAuth.verifyMfaStepUp(passwordActor, {
          challengeToken: enrollment.challengeToken, code: totp(enrollment.setupSecret),
        });
        if (!verified.mfaVerified) throw new Error(`MFA possession was not verified for ${role}`);
      }

      const claims = assertOpaqueAccessToken(accessToken, expectedUserId);
      const actor = await verifierAuth.verifyAccessToken(accessToken);
      if (
        actor.id !== expectedUserId
        || actor.role !== role
        || !organizationIds.includes(actor.orgId)
        || !actor.tenantId
        || !actor.membershipId
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
          subject: expectedUserId,
          issuer: ACCESS_ISSUER,
          audience: ACCESS_AUDIENCE,
          expiresIn: '5m',
        },
      );
      const reauthorized = await primaryAuth.verifyAccessToken(injectedClaimsToken);
      if (
        reauthorized.role !== role
        || reauthorized.orgId !== actor.orgId
        || reauthorized.tenantId !== actor.tenantId
        || reauthorized.membershipId !== actor.membershipId
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
        || session.membership_id !== actor.membershipId
        || session.organization_id !== actor.orgId
        || session.tenant_id !== actor.tenantId
      ) {
        throw new Error(`Persistent session row mismatch for ${role}`);
      }

      if (actorsByRole.has(role)) throw new Error(`Duplicate persistent actor role ${role}`);
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
