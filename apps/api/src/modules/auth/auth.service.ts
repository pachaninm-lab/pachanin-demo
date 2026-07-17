import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import {
  FINANCIAL_MFA_THRESHOLD_KOPECKS,
  RequestUser,
  Role,
  ROLES_REQUIRING_MFA,
} from '../../common/types/request-user';
import { requireSecret } from '../../common/config/secrets';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  buildOtpAuthUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashAuthMaterial,
  hashClientValue,
  makeOpaqueToken,
  parseOpaqueToken,
  secureEqual,
  sha256,
  stableJson,
  verifyTotp,
} from './auth-crypto';
import {
  AuthSqlClient,
  CredentialStateRow,
  IdentityRow,
  MfaChallengeRow,
  PersistentAuthRepository,
  SessionContextRow,
} from './persistent-auth.repository';

const JWT_SECRET = requireSecret('JWT_SECRET');
const ACCESS_TOKEN_TTL = '15m';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MFA_FRESHNESS_MS = 15 * 60 * 1000;
const CURRENT_CONSENT_VERSION = '1.2';
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('invalid-password-sentinel', 10);
const ACCESS_ISSUER = 'transparent-price-api';
const ACCESS_AUDIENCE = 'transparent-price-platform';

const SELF_REGISTERABLE_ROLES: ReadonlySet<Role> = new Set<Role>([
  Role.FARMER,
  Role.BUYER,
  Role.LOGISTICIAN,
  Role.DRIVER,
  Role.LAB,
  Role.ELEVATOR,
  Role.ACCOUNTING,
  // Независимый сюрвейер — такой же поставщик услуг сделки, как лаборатория и
  // элеватор: регистрируется сам, допуск даёт оператор верификацией организации.
  Role.SURVEYOR,
]);
const KNOWN_ROLES = new Set<string>(Object.values(Role));
const PRIVILEGED_MFA_ROLES = new Set<string>(ROLES_REQUIRING_MFA);
const SYNTHETIC_SEED_ENABLED = String(process.env.SEED_CANONICAL_TEST_DEAL ?? '').toLowerCase() === 'true';

export function canSelfRegisterRole(role: Role): boolean {
  return SELF_REGISTERABLE_ROLES.has(role);
}

export function requiresRoleMfa(role: Role): boolean {
  return PRIVILEGED_MFA_ROLES.has(role);
}

export function requiresRecentFinancialMfa(amountKopecks: number): boolean {
  return Number.isFinite(amountKopecks) && amountKopecks >= FINANCIAL_MFA_THRESHOLD_KOPECKS;
}

type SeedCompatibilityUser = {
  id: string;
  email: string;
  role: Role;
  orgId: string;
  fullName: string;
};

type AuthUserProjection = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  orgId: string;
  tenantId: string;
  membershipId: string;
  mfaVerified: boolean;
};

type AccessClaims = jwt.JwtPayload & {
  sub: string;
  sid: string;
  typ: 'access';
};

type MfaVerifyInput = {
  challengeToken: string;
  code: string;
};

@Injectable()
export class AuthService {
  private readonly seedCompatibilityUsers: SeedCompatibilityUser[] = [];

  constructor(private readonly repository: PersistentAuthRepository) {}

  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const accountHash = hashAuthMaterial(`account:${email}`);
    const identity = await this.repository.findIdentityByEmail(this.repository.prisma, email);
    const validPassword = await bcrypt.compare(dto.password, identity?.password_hash ?? DUMMY_PASSWORD_HASH);

    const result = await this.repository.transaction(async (tx) => {
      await this.repository.ensureLoginThrottle(tx, accountHash);
      const throttle = await this.repository.getLoginThrottle(tx, accountHash, true);
      const now = new Date();
      if (throttle?.locked_until && throttle.locked_until > now) {
        await this.audit(tx, {
          userId: identity?.user_id,
          membershipId: identity?.membership_id,
          organizationId: identity?.organization_id,
          tenantId: identity?.tenant_id,
          action: 'auth.login',
          outcome: 'DENIED',
          reason: 'ACCOUNT_TEMPORARILY_LOCKED',
          metadata: this.clientMetadata(userAgent, ip, { accountHash }),
        });
        return { kind: 'locked' as const, lockedUntil: throttle.locked_until };
      }

      if (!identity || !validPassword) {
        const failures = (throttle?.failures ?? 0) + 1;
        const lockedUntil = failures >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOGIN_LOCKOUT_MS)
          : null;
        await this.repository.setLoginThrottle(tx, accountHash, lockedUntil ? 0 : failures, lockedUntil);
        await this.audit(tx, {
          userId: identity?.user_id,
          membershipId: identity?.membership_id,
          organizationId: identity?.organization_id,
          tenantId: identity?.tenant_id,
          action: 'auth.login',
          outcome: 'FAILURE',
          reason: 'INVALID_CREDENTIALS',
          metadata: this.clientMetadata(userAgent, ip, { accountHash, locked: Boolean(lockedUntil) }),
        });
        return { kind: 'invalid' as const };
      }

      await this.assertIdentityUsable(tx, identity, 'auth.login');
      await this.repository.ensureCredentialState(tx, identity.user_id);
      const credential = await this.requireCredentialState(tx, identity.user_id, true);
      await this.repository.clearLoginThrottle(tx, accountHash);
      await this.repository.markLoginSuccess(tx, identity.user_id);

      const sessionId = `ses_${randomUUID()}`;
      const familyId = `rf_${randomUUID()}`;
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      const mfaRequired = requiresRoleMfa(this.role(identity.role)) || credential.mfa_enabled;
      await this.repository.createSession(tx, {
        id: sessionId,
        userId: identity.user_id,
        membershipId: identity.membership_id,
        organizationId: identity.organization_id,
        tenantId: identity.tenant_id,
        status: mfaRequired ? 'MFA_PENDING' : 'ACTIVE',
        refreshFamilyId: familyId,
        credentialVersion: credential.credential_version,
        userAgentHash: hashClientValue(userAgent),
        ipHash: hashClientValue(ip),
        expiresAt,
      });

      if (mfaRequired) {
        const enrollment = !credential.mfa_enabled || !credential.mfa_secret_ciphertext;
        let setupSecret: string | undefined;
        if (enrollment) {
          setupSecret = generateTotpSecret();
          const encrypted = encryptMfaSecret(setupSecret);
          await this.repository.setMfaSecret(tx, identity.user_id, encrypted.ciphertext, encrypted.keyVersion);
        }
        const challenge = makeOpaqueToken('mc');
        await this.repository.createMfaChallenge(tx, {
          id: challenge.id,
          sessionId,
          userId: identity.user_id,
          challengeTokenHash: challenge.hash,
          type: enrollment ? 'TOTP_ENROLL' : 'TOTP_VERIFY',
          expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS),
        });
        await this.audit(tx, {
          userId: identity.user_id,
          sessionId,
          membershipId: identity.membership_id,
          organizationId: identity.organization_id,
          tenantId: identity.tenant_id,
          action: 'auth.login.mfa_required',
          outcome: 'SUCCESS',
          metadata: this.clientMetadata(userAgent, ip, { enrollment }),
        });
        return {
          kind: 'mfa' as const,
          challengeToken: challenge.token,
          expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS).toISOString(),
          setupSecret,
          otpAuthUri: setupSecret ? buildOtpAuthUri(identity.email, setupSecret) : undefined,
          user: this.userProjection(identity, false),
        };
      }

      const tokens = await this.issueActiveTokens(tx, identity, {
        id: sessionId,
        familyId,
        credentialVersion: credential.credential_version,
        userAgent,
        ip,
      });
      await this.audit(tx, {
        userId: identity.user_id,
        sessionId,
        membershipId: identity.membership_id,
        organizationId: identity.organization_id,
        tenantId: identity.tenant_id,
        action: 'auth.login',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip),
      });
      return { kind: 'active' as const, ...tokens };
    });

    if (result.kind === 'locked') {
      const retryAfterSec = Math.max(1, Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000));
      throw new UnauthorizedException(`Account temporarily locked. Try again in ${retryAfterSec}s.`);
    }
    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid credentials');
    if (result.kind === 'mfa') {
      return {
        mfaRequired: true,
        challengeToken: result.challengeToken,
        challengeExpiresAt: result.expiresAt,
        setupSecret: result.setupSecret,
        otpAuthUri: result.otpAuthUri,
        user: result.user,
      };
    }
    return { mfaRequired: false, ...result };
  }

  async register(dto: RegisterDto | any) {
    const requestedRole = (dto.role as Role) || Role.GUEST;
    if (!canSelfRegisterRole(requestedRole)) {
      throw new ForbiddenException(
        'The selected role cannot be self-registered. Contact an administrator for access.',
      );
    }

    if (SYNTHETIC_SEED_ENABLED && dto.orgId && String(dto.email).endsWith('@demo.ru')) {
      return this.registerSyntheticSeedUser(dto, requestedRole);
    }

    const email = String(dto.email ?? '').trim().toLowerCase();
    const fullName = String(dto.fullName ?? '').trim();
    const orgInn = String(dto.orgInn ?? '').trim();
    const orgLegalName = String(dto.orgLegalName ?? '').trim();
    if (!email || !fullName || !orgInn || !orgLegalName) {
      throw new BadRequestException('Email, full name, organization name and INN are required.');
    }

    return this.repository.transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException('Email already registered');
      const existingOrganization = await tx.organization.findUnique({ where: { inn: orgInn } });
      if (existingOrganization) {
        throw new ConflictException('Organization already exists. Request an administrator invitation.');
      }

      const organization = await tx.organization.create({
        data: {
          id: `org_${randomUUID()}`,
          inn: orgInn,
          name: orgLegalName,
          type: String(dto.orgType ?? 'LEGAL'),
          status: 'PENDING',
          tenantId: `tenant_${randomUUID()}`,
          kycStatus: 'PENDING',
          amlStatus: 'CLEAR',
        },
      });
      const user = await tx.user.create({
        data: {
          id: `user_${randomUUID()}`,
          email,
          phone: dto.phone ? String(dto.phone) : null,
          passwordHash: await bcrypt.hash(String(dto.password), 12),
          fullName,
          status: 'ACTIVE',
        },
      });
      const membership = await tx.userOrg.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: requestedRole,
          isDefault: true,
        },
      });
      await this.repository.ensureCredentialState(
        tx,
        user.id,
        dto.consentVersion || CURRENT_CONSENT_VERSION,
        new Date(),
      );
      await this.audit(tx, {
        userId: user.id,
        membershipId: membership.id,
        organizationId: organization.id,
        tenantId: organization.tenantId,
        action: 'auth.register',
        outcome: 'SUCCESS',
        reason: 'ORGANIZATION_VERIFICATION_REQUIRED',
        metadata: { requestedRole },
      });
      return {
        status: 'PENDING_ORGANIZATION_VERIFICATION',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: requestedRole,
          orgId: organization.id,
          tenantId: organization.tenantId,
          membershipId: membership.id,
        },
      };
    });
  }

  async refresh(dto: { refreshToken: string }, userAgent?: string, ip?: string) {
    const parsed = parseOpaqueToken(dto.refreshToken, 'rt');
    if (!parsed) throw new UnauthorizedException('Invalid refresh token');

    const result = await this.repository.transaction(async (tx) => {
      const context = await this.repository.getRefreshContextForUpdate(tx, parsed.id);
      if (!context || !secureEqual(context.refresh_token_hash, parsed.hash)) {
        await this.audit(tx, {
          action: 'auth.refresh',
          outcome: 'DENIED',
          reason: 'REFRESH_TOKEN_NOT_FOUND',
          metadata: this.clientMetadata(userAgent, ip, { tokenId: parsed.id }),
        });
        return { kind: 'invalid' as const };
      }

      if (context.refresh_token_status !== 'ACTIVE' || context.refresh_token_consumed_at) {
        await this.repository.revokeFamily(
          tx,
          context.refresh_token_family_id,
          'REFRESH_TOKEN_REUSE_DETECTED',
          context.refresh_token_id,
        );
        await this.audit(tx, {
          userId: context.user_id,
          sessionId: context.session_id,
          membershipId: context.membership_id,
          organizationId: context.organization_id,
          tenantId: context.tenant_id,
          action: 'auth.refresh.reuse',
          outcome: 'DENIED',
          reason: 'REFRESH_TOKEN_REUSE_DETECTED',
          metadata: this.clientMetadata(userAgent, ip, { tokenId: parsed.id }),
        });
        return { kind: 'reuse' as const };
      }

      const invalidReason = this.sessionInvalidReason(context);
      if (invalidReason || context.refresh_token_expires_at <= new Date()) {
        await this.repository.revokeFamily(
          tx,
          context.refresh_token_family_id,
          invalidReason ?? 'REFRESH_TOKEN_EXPIRED',
        );
        await this.audit(tx, {
          userId: context.user_id,
          sessionId: context.session_id,
          membershipId: context.membership_id,
          organizationId: context.organization_id,
          tenantId: context.tenant_id,
          action: 'auth.refresh',
          outcome: 'DENIED',
          reason: invalidReason ?? 'REFRESH_TOKEN_EXPIRED',
          metadata: this.clientMetadata(userAgent, ip),
        });
        return { kind: 'invalid' as const };
      }

      const replacement = makeOpaqueToken('rt');
      await this.repository.rotateRefreshToken(tx, {
        currentTokenId: context.refresh_token_id,
        replacementTokenId: replacement.id,
        replacementTokenHash: replacement.hash,
        sessionId: context.session_id,
        familyId: context.refresh_token_family_id,
        replacementExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgentHash: hashClientValue(userAgent),
        ipHash: hashClientValue(ip),
      });
      await this.audit(tx, {
        userId: context.user_id,
        sessionId: context.session_id,
        membershipId: context.membership_id,
        organizationId: context.organization_id,
        tenantId: context.tenant_id,
        action: 'auth.refresh',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip, {
          rotatedFrom: context.refresh_token_id,
          rotatedTo: replacement.id,
        }),
      });
      return {
        kind: 'success' as const,
        accessToken: this.signAccessToken(
          context.user_id,
          context.session_id,
          context.current_credential_version,
        ),
        refreshToken: replacement.token,
        user: this.userProjection(context, Boolean(context.mfa_verified_at)),
      };
    });

    if (result.kind === 'reuse') {
      throw new UnauthorizedException('Refresh token reuse detected; session family revoked.');
    }
    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid or expired refresh token');
    return result;
  }

  async verifyMfa(dto: MfaVerifyInput, userAgent?: string, ip?: string) {
    const parsed = parseOpaqueToken(dto.challengeToken, 'mc');
    if (!parsed) throw new UnauthorizedException('Invalid MFA challenge');

    const result = await this.repository.transaction(async (tx) => {
      const challenge = await this.repository.getMfaChallengeForUpdate(tx, parsed.id);
      if (!challenge || !secureEqual(challenge.challenge_token_hash, parsed.hash)) {
        return { kind: 'invalid' as const };
      }
      const invalidReason = this.sessionInvalidReason(challenge, true);
      if (
        invalidReason
        || challenge.challenge_status !== 'PENDING'
        || challenge.challenge_expires_at <= new Date()
        || challenge.session_status !== 'MFA_PENDING'
      ) {
        await this.repository.revokeSession(tx, challenge.session_id, invalidReason ?? 'MFA_CHALLENGE_INVALID');
        await this.audit(tx, {
          userId: challenge.user_id,
          sessionId: challenge.session_id,
          membershipId: challenge.membership_id,
          organizationId: challenge.organization_id,
          tenantId: challenge.tenant_id,
          action: 'auth.mfa.verify',
          outcome: 'DENIED',
          reason: invalidReason ?? 'MFA_CHALLENGE_INVALID',
          metadata: this.clientMetadata(userAgent, ip),
        });
        return { kind: 'invalid' as const };
      }

      const credential = await this.requireCredentialState(tx, challenge.user_id, true);
      if (!credential.mfa_secret_ciphertext) return { kind: 'invalid' as const };
      const verification = this.verifyMfaCode(credential, dto.code);
      if (!verification) {
        const terminal = challenge.challenge_attempts + 1 >= challenge.challenge_max_attempts;
        await this.repository.recordMfaFailure(tx, challenge.challenge_id, terminal);
        if (terminal) await this.repository.revokeSession(tx, challenge.session_id, 'MFA_ATTEMPTS_EXHAUSTED');
        await this.audit(tx, {
          userId: challenge.user_id,
          sessionId: challenge.session_id,
          membershipId: challenge.membership_id,
          organizationId: challenge.organization_id,
          tenantId: challenge.tenant_id,
          action: 'auth.mfa.verify',
          outcome: 'FAILURE',
          reason: terminal ? 'MFA_ATTEMPTS_EXHAUSTED' : 'MFA_CODE_INVALID',
          metadata: this.clientMetadata(userAgent, ip, { attempts: challenge.challenge_attempts + 1 }),
        });
        return { kind: 'invalid' as const };
      }

      const enrollment = challenge.challenge_type === 'TOTP_ENROLL';
      const backup = enrollment ? generateBackupCodes() : null;
      const method = verification.method;
      const persistedBackupHashes = enrollment
        ? backup?.hashes
        : verification.method === 'BACKUP'
          ? verification.remainingBackupHashes
          : undefined;
      await this.repository.activateMfaSession(tx, {
        challengeId: challenge.challenge_id,
        sessionId: challenge.session_id,
        userId: challenge.user_id,
        method,
        enableMfa: enrollment,
        backupHashes: persistedBackupHashes,
      });
      const refresh = makeOpaqueToken('rt');
      await this.repository.createRefreshToken(tx, {
        id: refresh.id,
        sessionId: challenge.session_id,
        familyId: challenge.refresh_family_id,
        tokenHash: refresh.hash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        userAgentHash: hashClientValue(userAgent),
        ipHash: hashClientValue(ip),
      });
      await this.audit(tx, {
        userId: challenge.user_id,
        sessionId: challenge.session_id,
        membershipId: challenge.membership_id,
        organizationId: challenge.organization_id,
        tenantId: challenge.tenant_id,
        action: 'auth.mfa.verify',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip, { method, enrollment }),
      });
      return {
        kind: 'success' as const,
        accessToken: this.signAccessToken(
          challenge.user_id,
          challenge.session_id,
          challenge.current_credential_version,
        ),
        refreshToken: refresh.token,
        backupCodes: backup?.codes,
        user: this.userProjection(challenge, true),
      };
    });

    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid or expired MFA challenge');
    return result;
  }

  async logout(dto: { refreshToken?: string }, sessionId?: string) {
    if (!sessionId) return { success: true };
    await this.repository.transaction(async (tx) => {
      const context = await this.repository.getSessionContext(tx, sessionId, undefined, true);
      await this.repository.revokeSession(tx, sessionId, 'USER_LOGOUT');
      await this.audit(tx, {
        userId: context?.user_id,
        sessionId,
        membershipId: context?.membership_id,
        organizationId: context?.organization_id,
        tenantId: context?.tenant_id,
        action: 'auth.logout',
        outcome: 'SUCCESS',
        metadata: { refreshTokenPresented: Boolean(dto?.refreshToken) },
      });
    });
    return { success: true };
  }

  async me(user: RequestUser) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      tenantId: user.tenantId,
      membershipId: user.membershipId,
      fullName: user.fullName,
      surfaceRole: user.surfaceRole,
      mfaVerified: user.mfaVerified,
      mfaVerifiedAt: user.mfaVerifiedAt,
    };
  }

  async verifyAccessToken(token: string): Promise<RequestUser> {
    let claims: AccessClaims;
    try {
      const raw = jwt.verify(token, JWT_SECRET, {
        issuer: ACCESS_ISSUER,
        audience: ACCESS_AUDIENCE,
      });
      if (
        typeof raw === 'string'
        || raw.typ !== 'access'
        || typeof raw.sub !== 'string'
        || typeof raw.sid !== 'string'
      ) {
        throw new Error('Invalid access claims');
      }
      claims = raw as AccessClaims;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const context = await this.repository.getSessionContext(
      this.repository.prisma,
      claims.sid,
      claims.sub,
    );
    const reason = context ? this.sessionInvalidReason(context) : 'SESSION_NOT_FOUND';
    if (!context || reason) {
      if (context) {
        await this.repository.transaction(async (tx) => {
          await this.repository.revokeSession(tx, context.session_id, reason ?? 'SESSION_INVALID');
          await this.audit(tx, {
            userId: context.user_id,
            sessionId: context.session_id,
            membershipId: context.membership_id,
            organizationId: context.organization_id,
            tenantId: context.tenant_id,
            action: 'auth.access',
            outcome: 'DENIED',
            reason,
          });
        });
      }
      throw new UnauthorizedException(reason === 'SESSION_REVOKED' ? 'Session has been revoked' : 'Session is not active');
    }

    const role = this.role(context.role);
    if (requiresRoleMfa(role) && !context.mfa_verified_at) {
      throw new UnauthorizedException('MFA verification is required for this role');
    }
    await this.repository.touchSession(this.repository.prisma, context.session_id);
    return {
      id: context.user_id,
      email: context.email,
      fullName: context.full_name,
      role,
      orgId: context.organization_id,
      tenantId: context.tenant_id,
      membershipId: context.membership_id,
      sessionId: context.session_id,
      credentialVersion: context.current_credential_version,
      mfaVerified: Boolean(context.mfa_verified_at),
      mfaVerifiedAt: context.mfa_verified_at?.toISOString(),
    };
  }

  async revokeUserSessions(userId: string, reason = 'ADMIN_REVOKE') {
    await this.repository.transaction(async (tx) => {
      await this.repository.revokeAllUserSessions(tx, userId, reason);
      await this.audit(tx, {
        userId,
        action: 'auth.sessions.revoke_all',
        outcome: 'SUCCESS',
        reason,
      });
    });
    return { success: true, userId, reason };
  }

  assertRecentFinancialMfa(user: RequestUser, amountKopecks: number): void {
    if (!requiresRecentFinancialMfa(amountKopecks)) return;
    if (!user.mfaVerified || !user.mfaVerifiedAt) {
      throw new ForbiddenException('Recent MFA verification is required for this financial action.');
    }
    const age = Date.now() - new Date(user.mfaVerifiedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > MFA_FRESHNESS_MS) {
      throw new ForbiddenException('MFA verification is too old for this financial action.');
    }
  }

  async getUserData(requestingUserId: string) {
    const user = await this.repository.prisma.user.findUnique({
      where: { id: requestingUserId },
      include: { orgs: { include: { organization: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) throw new ForbiddenException('Account has been anonymized');
    const credential = await this.repository.getCredentialState(this.repository.prisma, user.id);
    return {
      exportedAt: new Date().toISOString(),
      exportVersion: '2.0',
      subject: '152-ФЗ Data Portability Export',
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
      },
      memberships: user.orgs.map((membership) => ({
        membershipId: membership.id,
        role: membership.role,
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        tenantId: membership.organization.tenantId,
        organizationStatus: membership.organization.status,
      })),
      consent: {
        version: credential?.consent_version ?? null,
        recordedAt: credential?.consent_at?.toISOString() ?? null,
        currentPolicyVersion: CURRENT_CONSENT_VERSION,
      },
      security: {
        mfaEnabled: credential?.mfa_enabled ?? false,
        credentialVersion: credential?.credential_version ?? 1,
      },
    };
  }

  async anonymizeUser(requestingUserId: string) {
    return this.repository.transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: requestingUserId } });
      if (!user) throw new NotFoundException('User not found');
      if (user.deletedAt) throw new ConflictException('Account already anonymized');
      const anonymizedAt = new Date();
      await this.repository.revokeAllUserSessions(tx, user.id, 'ACCOUNT_ANONYMIZED');
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `anon-${user.id}@deleted.invalid`,
          fullName: 'Anonymized User',
          phone: null,
          passwordHash: '',
          status: 'BLOCKED',
          deletedAt: anonymizedAt,
        },
      });
      await tx.$executeRaw(Prisma.sql`
        UPDATE auth.credential_states
        SET credential_version = credential_version + 1,
            mfa_secret_ciphertext = NULL,
            mfa_backup_hashes = NULL,
            updated_at = NOW()
        WHERE user_id = ${user.id}
      `);
      await this.audit(tx, {
        userId: user.id,
        action: 'auth.account.anonymize',
        outcome: 'SUCCESS',
        reason: 'USER_REQUEST',
      });
      return { success: true, anonymizedAt: anonymizedAt.toISOString() };
    });
  }

  sberBusinessStart(query: Record<string, string | undefined>) {
    return {
      provider: 'sber-business',
      status: 'not_configured',
      message: 'SberBusiness OAuth is not configured in this environment',
      query,
    };
  }

  sberBusinessCallback(_query: Record<string, string | undefined>, _userAgent?: string, _ip?: string) {
    return {
      provider: 'sber-business',
      status: 'not_configured',
      message: 'SberBusiness OAuth callback is not configured in this environment',
    };
  }

  oidcProviders() {
    return { providers: [], message: 'No OIDC providers configured' };
  }

  oidcAuthorizationUrl() {
    return { url: null, message: 'No OIDC provider configured' };
  }

  /** Synthetic E2E compatibility only. Runtime authorization never reads this cache. */
  listUsers() {
    return [...this.seedCompatibilityUsers];
  }

  /** Synthetic E2E compatibility only. Membership authority remains PostgreSQL UserOrg. */
  updateUserRole(userId: string, role: Role) {
    this.assertSyntheticSeedCompatibility();
    const user = this.seedCompatibilityUsers.find((item) => item.id === userId);
    if (!user) throw new Error(`Synthetic seed user ${userId} not found`);
    user.role = role;
    return { id: user.id, role };
  }

  /** Synthetic E2E compatibility only. Organization authority remains PostgreSQL UserOrg. */
  updateUserOrg(userId: string, orgId: string) {
    this.assertSyntheticSeedCompatibility();
    const user = this.seedCompatibilityUsers.find((item) => item.id === userId);
    if (!user) throw new Error(`Synthetic seed user ${userId} not found`);
    user.orgId = orgId;
    return { id: user.id, orgId };
  }

  private async registerSyntheticSeedUser(dto: any, role: Role) {
    this.assertSyntheticSeedCompatibility();
    const email = String(dto.email).trim().toLowerCase();
    const user = await this.repository.prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: await bcrypt.hash(String(dto.password), 10),
        fullName: String(dto.fullName ?? email),
        status: 'ACTIVE',
      },
      create: {
        id: `user_${randomUUID()}`,
        email,
        passwordHash: await bcrypt.hash(String(dto.password), 10),
        fullName: String(dto.fullName ?? email),
        status: 'ACTIVE',
      },
    });
    const projection: SeedCompatibilityUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role,
      orgId: String(dto.orgId),
    };
    const index = this.seedCompatibilityUsers.findIndex((item) => item.id === user.id);
    if (index >= 0) this.seedCompatibilityUsers[index] = projection;
    else this.seedCompatibilityUsers.push(projection);
    return { user: projection };
  }

  private assertSyntheticSeedCompatibility(): void {
    if (!SYNTHETIC_SEED_ENABLED || String(process.env.NODE_ENV).toLowerCase() === 'production') {
      throw new ForbiddenException('Synthetic identity compatibility is disabled.');
    }
  }

  private async issueActiveTokens(
    tx: AuthSqlClient,
    identity: IdentityRow,
    input: {
      id: string;
      familyId: string;
      credentialVersion: number;
      userAgent?: string;
      ip?: string;
    },
  ) {
    const refresh = makeOpaqueToken('rt');
    await this.repository.createRefreshToken(tx, {
      id: refresh.id,
      sessionId: input.id,
      familyId: input.familyId,
      tokenHash: refresh.hash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgentHash: hashClientValue(input.userAgent),
      ipHash: hashClientValue(input.ip),
    });
    return {
      accessToken: this.signAccessToken(identity.user_id, input.id, input.credentialVersion),
      refreshToken: refresh.token,
      user: this.userProjection(identity, false),
    };
  }

  private signAccessToken(userId: string, sessionId: string, credentialVersion: number): string {
    return jwt.sign(
      {
        typ: 'access',
        sid: sessionId,
        cv: credentialVersion,
      },
      JWT_SECRET,
      {
        subject: userId,
        issuer: ACCESS_ISSUER,
        audience: ACCESS_AUDIENCE,
        expiresIn: ACCESS_TOKEN_TTL,
        jwtid: randomUUID(),
      },
    );
  }

  private userProjection(identity: IdentityRow | SessionContextRow | MfaChallengeRow, mfaVerified: boolean): AuthUserProjection {
    return {
      id: identity.user_id,
      email: identity.email,
      fullName: identity.full_name,
      role: this.role(identity.role),
      orgId: identity.organization_id,
      tenantId: identity.tenant_id,
      membershipId: identity.membership_id,
      mfaVerified,
    };
  }

  private role(value: string): Role {
    if (!KNOWN_ROLES.has(value) || value === Role.BANK_CALLBACK) {
      throw new ForbiddenException('Membership role is not authorized for a human session.');
    }
    return value as Role;
  }

  private async assertIdentityUsable(
    tx: AuthSqlClient,
    identity: IdentityRow,
    action: string,
  ): Promise<void> {
    let reason: string | null = null;
    if (identity.user_status !== 'ACTIVE') reason = 'USER_NOT_ACTIVE';
    else if (identity.organization_status !== 'VERIFIED') reason = 'ORGANIZATION_NOT_VERIFIED';
    else if (!KNOWN_ROLES.has(identity.role) || identity.role === Role.BANK_CALLBACK) reason = 'MEMBERSHIP_ROLE_INVALID';
    if (!reason) return;
    await this.audit(tx, {
      userId: identity.user_id,
      membershipId: identity.membership_id,
      organizationId: identity.organization_id,
      tenantId: identity.tenant_id,
      action,
      outcome: 'DENIED',
      reason,
    });
    throw new ForbiddenException(reason);
  }

  private sessionInvalidReason(context: SessionContextRow, allowMfaPending = false): string | null {
    if (context.session_status === 'REVOKED') return 'SESSION_REVOKED';
    if (context.session_status === 'EXPIRED' || context.session_expires_at <= new Date()) return 'SESSION_EXPIRED';
    if (context.session_status !== 'ACTIVE' && !(allowMfaPending && context.session_status === 'MFA_PENDING')) {
      return 'SESSION_NOT_ACTIVE';
    }
    if (context.user_status !== 'ACTIVE') return 'USER_NOT_ACTIVE';
    if (context.organization_status !== 'VERIFIED') return 'ORGANIZATION_NOT_VERIFIED';
    if (context.session_credential_version !== context.current_credential_version) return 'CREDENTIAL_VERSION_CHANGED';
    if (!KNOWN_ROLES.has(context.role) || context.role === Role.BANK_CALLBACK) return 'MEMBERSHIP_ROLE_INVALID';
    return null;
  }

  private verifyMfaCode(
    credential: CredentialStateRow,
    code: string,
  ): { method: 'TOTP' } | { method: 'BACKUP'; remainingBackupHashes: string[] } | null {
    const secret = credential.mfa_secret_ciphertext
      ? decryptMfaSecret(credential.mfa_secret_ciphertext)
      : null;
    if (secret && verifyTotp(secret, code)) return { method: 'TOTP' };
    const hashes = Array.isArray(credential.mfa_backup_hashes)
      ? credential.mfa_backup_hashes.filter((item): item is string => typeof item === 'string')
      : [];
    const candidate = hashAuthMaterial(String(code).trim().toUpperCase());
    const matchedIndex = hashes.findIndex((item) => secureEqual(item, candidate));
    if (matchedIndex < 0) return null;
    return {
      method: 'BACKUP',
      remainingBackupHashes: hashes.filter((_, index) => index !== matchedIndex),
    };
  }

  private async requireCredentialState(
    tx: AuthSqlClient,
    userId: string,
    forUpdate = false,
  ): Promise<CredentialStateRow> {
    await this.repository.ensureCredentialState(tx, userId);
    const state = await this.repository.getCredentialState(tx, userId, forUpdate);
    if (!state) throw new Error(`Credential state for ${userId} was not created`);
    return state;
  }

  private clientMetadata(
    userAgent?: string,
    ip?: string,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      userAgentHash: hashClientValue(userAgent),
      ipHash: hashClientValue(ip),
      ...extra,
    };
  }

  private async audit(
    tx: AuthSqlClient,
    input: {
      userId?: string | null;
      sessionId?: string | null;
      membershipId?: string | null;
      organizationId?: string | null;
      tenantId?: string | null;
      action: string;
      outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
      reason?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const id = `auth_evt_${randomUUID()}`;
    const prevHash = await this.repository.latestAuditHash(tx, input.userId, input.sessionId);
    const hash = sha256(stableJson({ id, ...input, prevHash }));
    await this.repository.insertAudit(tx, { id, ...input, hash, prevHash });
  }
}
