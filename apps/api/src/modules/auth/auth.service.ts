import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { upgradePasswordHashIfNeeded, verifyPassword } from './password-hashing';
import { randomUUID } from 'crypto';
import {
  FINANCIAL_MFA_THRESHOLD_KOPECKS,
  RequestUser,
  Role,
  ROLES_REQUIRING_MFA,
} from '../../common/types/request-user';
import { AccessClaims, signAccessToken, verifyAccessClaims } from './access-token';
import { appendAuthAudit } from './auth-audit';
import { LoginDto } from './dto/login.dto';
import {
  buildOtpAuthUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashAuthMaterial,
  hashClientValue,
  secureEqual,
  sha256,
  stableJson,
  matchTotpCounter,
} from './auth-crypto';
import { CURRENT_CONSENT_VERSION } from './consent-policy';
import {
  digestMfaBackupCode,
  issueMembershipSelectionCredential,
  issueMfaChallengeCredential,
  issueRefreshCredential,
  resolvePresentedCredential,
} from './opaque-token-authority';
import {
  AccountAuthorityContext,
  AuthSqlClient,
  CredentialStateRow,
  IdentityRow,
  MfaChallengeRow,
  PersistentAuthRepository,
  SessionContextRow,
} from './persistent-auth.repository';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * How long a session may sit unused before it stops being one.
 *
 * The absolute cap is thirty days and is re-checked on every request, but an
 * absolute cap does not bound idle exposure: until this was added, a session
 * left untouched on a shared or lost device stayed valid for the whole thirty
 * days. The timestamp to bound it with was already stored and already
 * maintained - every authenticated request touches last_seen_at, throttled to
 * one write a minute - and nothing read it.
 *
 * One hour for an ordinary session, fifteen minutes for a privileged one.
 *
 * The first version of this control used twelve hours, and the reasoning
 * recorded for it argued that drivers, elevator operators and surveyors are
 * interrupted by the job rather than by choice, so a shorter limit would be met
 * by keeping a tab awake rather than by better security. That argument was
 * rejected by the owner, and the rejection is the right one: it treated the
 * session as the only way to preserve work. The answer to an interrupted shift
 * is to keep the state and let the person reauthenticate back into it, not to
 * leave an authenticated session lying open on a device in a truck cab for
 * half a day. An idle limit that is generous because logging back in is
 * inconvenient is a limit set by the UX budget rather than by risk.
 *
 * The privileged tier is decided from the role already on the session row that
 * this same function is validating - not from staffRoles, not from a second
 * lookup - so there is one authority for who is privileged and it is the same
 * one the rest of the request uses. The set is ROLES_REQUIRING_MFA, which is
 * this platform's existing definition of a privileged actor; inventing a second
 * notion of "privileged" here is precisely the inconsistency V6.3.4 is about.
 *
 * Neither number stands alone in front of the risky operations: financial
 * commands above a threshold already demand recently verified MFA regardless of
 * session age, and that step-up is not relaxed to compensate for a shorter idle
 * window. The idle limit bounds ambient exposure.
 *
 * Two constants. If the operational answer is a different number, these are the
 * lines to change.
 */
export const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const PRIVILEGED_SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * The idle limit that applies to a session held by this role.
 *
 * Takes the role as it appears on the session context row, so an unknown or
 * malformed value falls to the shorter-lived ordinary limit rather than to no
 * limit at all.
 */
export function idleTimeoutMsForRole(role: string | null | undefined): number {
  return ROLES_REQUIRING_MFA.includes(role as Role)
    ? PRIVILEGED_SESSION_IDLE_TIMEOUT_MS
    : SESSION_IDLE_TIMEOUT_MS;
}

const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MEMBERSHIP_SELECTION_TTL_MS = 5 * 60 * 1000;
const MFA_FRESHNESS_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

const KNOWN_ROLES = new Set<string>(Object.values(Role));
const PRIVILEGED_MFA_ROLES = new Set<string>(ROLES_REQUIRING_MFA);

export function requiresRoleMfa(role: Role): boolean {
  return PRIVILEGED_MFA_ROLES.has(role);
}

export function requiresRecentFinancialMfa(amountKopecks: number): boolean {
  return Number.isFinite(amountKopecks) && amountKopecks >= FINANCIAL_MFA_THRESHOLD_KOPECKS;
}

type AuthUserProjection = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  orgId: string;
  tenantId: string;
  membershipId: string;
  isOrgAdmin: boolean;
  mfaVerified: boolean;
};

type MfaVerifyInput = {
  challengeToken: string;
  code: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly repository: PersistentAuthRepository) {}

  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const accountHash = hashAuthMaterial(`account:${email}`);

    // The only authority available before password proof is the three-field
    // credential projection. Membership, organization, tenant, role and MFA
    // state are deliberately unavailable here.
    const loginCredential = await this.repository.findLoginCredentialByEmail(
      this.repository.prisma,
      email,
    );
    const validPassword = await verifyPassword(dto.password, loginCredential?.password_hash);

    const result = await this.repository.transaction(async (tx) => {
      await this.repository.ensureLoginThrottle(tx, accountHash);
      const throttle = await this.repository.getLoginThrottle(tx, accountHash, true);
      const now = new Date();
      if (throttle?.locked_until && throttle.locked_until > now) {
        await this.audit(tx, {
          userId: loginCredential?.user_id,
          action: 'auth.login',
          outcome: 'DENIED',
          reason: 'ACCOUNT_TEMPORARILY_LOCKED',
          metadata: this.clientMetadata(userAgent, ip, { accountHash }),
        });
        return { kind: 'locked' as const, lockedUntil: throttle.locked_until };
      }

      if (!loginCredential || !validPassword) {
        const failures = (throttle?.failures ?? 0) + 1;
        const lockedUntil = failures >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOGIN_LOCKOUT_MS)
          : null;
        await this.repository.setLoginThrottle(tx, accountHash, lockedUntil ? 0 : failures, lockedUntil);
        await this.audit(tx, {
          userId: loginCredential?.user_id,
          action: 'auth.login',
          outcome: 'FAILURE',
          reason: 'INVALID_CREDENTIALS',
          metadata: this.clientMetadata(userAgent, ip, { accountHash, locked: Boolean(lockedUntil) }),
        });
        return { kind: 'invalid' as const };
      }

      // Re-read the credential in the serializable transaction. A password
      // reset between bcrypt and this point invalidates the proof before any
      // membership authority or session can be created.
      const currentLoginCredential = await this.repository.findLoginCredentialByEmail(tx, email);
      if (
        !currentLoginCredential
        || currentLoginCredential.user_id !== loginCredential.user_id
        || !secureEqual(currentLoginCredential.password_hash, loginCredential.password_hash)
      ) {
        await this.audit(tx, {
          userId: loginCredential.user_id,
          action: 'auth.login',
          outcome: 'DENIED',
          reason: 'CREDENTIAL_CHANGED_DURING_LOGIN',
          metadata: this.clientMetadata(userAgent, ip, { accountHash }),
        });
        return { kind: 'invalid' as const };
      }

      // All membership and tenant projections begin only after password proof.
      const memberships = await this.repository.findIdentitiesByUser(
        tx,
        currentLoginCredential.user_id,
      );
      const usableMemberships = memberships.filter((membership) => this.identityUsable(membership));
      if (usableMemberships.length === 0) {
        const reason = memberships[0]
          ? this.identityInvalidReason(memberships[0]) ?? 'NO_ACTIVE_MEMBERSHIP'
          : 'NO_ACTIVE_MEMBERSHIP';
        await this.audit(tx, {
          userId: currentLoginCredential.user_id,
          action: 'auth.login',
          outcome: 'DENIED',
          reason,
          metadata: this.clientMetadata(userAgent, ip, { accountHash }),
        });
        return { kind: 'no_context' as const, reason };
      }
      const selectedIdentity = usableMemberships[0];
      await this.repository.ensureCredentialState(tx, currentLoginCredential.user_id);
      const credential = await this.requireCredentialState(tx, currentLoginCredential.user_id, true);
      await this.repository.clearLoginThrottle(tx, accountHash);
      await this.repository.markLoginSuccess(tx, currentLoginCredential.user_id);

      if (usableMemberships.length > 1) {
        const issuedSelection = issueMembershipSelectionCredential();
        const expiresAt = new Date(Date.now() + MEMBERSHIP_SELECTION_TTL_MS);
        await this.repository.createMembershipSelectionChallenge(tx, {
          id: issuedSelection.credentialId,
          userId: currentLoginCredential.user_id,
          tokenHash: issuedSelection.storedDigest,
          credentialVersion: credential.credential_version,
          expiresAt,
        });
        await this.audit(tx, {
          userId: currentLoginCredential.user_id,
          action: 'auth.login.membership_selection_required',
          outcome: 'SUCCESS',
          metadata: this.clientMetadata(userAgent, ip, { membershipCount: usableMemberships.length }),
        });
        return {
          kind: 'membership' as const,
          challengeToken: issuedSelection.rawToken,
          expiresAt: expiresAt.toISOString(),
          memberships: usableMemberships.map((membership) => ({
            membershipId: membership.membership_id,
            organizationId: membership.organization_id,
            organizationName: membership.organization_name,
            role: this.role(membership.role),
            isOrgAdmin: membership.is_org_admin,
          })),
        };
      }

      return this.createLoginSession(tx, selectedIdentity, credential, userAgent, ip);
    });

    // The legacy hash is rewritten here, after the login decision and only for a
    // login that succeeded — never between the password proof and the
    // transaction's re-read. That re-read exists to refuse a proof whose
    // credential changed underneath it, and a rewrite placed before it IS such a
    // change: it made every first login of a bcrypt account fail with
    // CREDENTIAL_CHANGED_DURING_LOGIN. The guard was right; the moment was wrong.
    // Nothing here can turn a correct password into a refusal, because the
    // decision is already made and this value is not read.
    const loginDenied = result.kind === 'locked'
      || result.kind === 'invalid'
      || result.kind === 'no_context';
    if (loginCredential && validPassword && !loginDenied) {
      await upgradePasswordHashIfNeeded(
        dto.password,
        loginCredential.password_hash,
        (next, conditionalOn) => this.repository.upgradePasswordHashFormat(
          this.repository.prisma,
          loginCredential.user_id,
          next,
          conditionalOn,
        ),
      );
    }

    if (result.kind === 'locked') {
      const retryAfterSec = Math.max(1, Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000));
      throw new UnauthorizedException(`Account temporarily locked. Try again in ${retryAfterSec}s.`);
    }
    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid credentials');
    if (result.kind === 'no_context') {
      // Registration creates an inactive identity before approval. Keep that
      // lifecycle state indistinguishable from an unknown public account, but
      // preserve actionable membership and organization denials after proof.
      if (result.reason === 'USER_NOT_ACTIVE') {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw new ForbiddenException(result.reason);
    }
    if (result.kind === 'membership') {
      return {
        membershipSelectionRequired: true,
        challengeToken: result.challengeToken,
        challengeExpiresAt: result.expiresAt,
        memberships: result.memberships,
      };
    }
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

  async selectMembership(
    dto: { challengeToken: string; membershipId: string },
    userAgent?: string,
    ip?: string,
  ) {
    const parsed = resolvePresentedCredential(dto.challengeToken, 'ms');
    if (!parsed) throw new UnauthorizedException('Invalid membership selection');
    const result = await this.repository.transaction(async (tx) => {
      const challenge = await this.repository.getMembershipSelectionChallengeForUpdate(tx, parsed.credentialId);
      if (!challenge || !secureEqual(challenge.token_hash, parsed.storedDigest)) return { kind: 'invalid' as const };
      if (
        challenge.status !== 'PENDING'
        || challenge.expires_at <= new Date()
        || challenge.credential_version !== challenge.current_credential_version
      ) {
        await this.repository.recordMembershipSelectionFailure(tx, challenge.id, true);
        return { kind: 'invalid' as const };
      }

      const identity = await this.repository.findIdentityByUserAndMembership(
        tx,
        challenge.user_id,
        dto.membershipId,
      );
      if (!identity || !this.identityUsable(identity)) {
        const terminal = challenge.attempts + 1 >= challenge.max_attempts;
        await this.repository.recordMembershipSelectionFailure(tx, challenge.id, terminal);
        await this.audit(tx, {
          userId: challenge.user_id,
          action: 'auth.login.membership_selection',
          outcome: 'DENIED',
          reason: 'MEMBERSHIP_SELECTION_INVALID',
          metadata: this.clientMetadata(userAgent, ip, { attempts: challenge.attempts + 1 }),
        });
        return { kind: 'invalid' as const };
      }

      await this.repository.consumeMembershipSelectionChallenge(tx, challenge.id);
      const credential = await this.requireCredentialState(tx, identity.user_id, true);
      await this.audit(tx, {
        userId: identity.user_id,
        membershipId: identity.membership_id,
        organizationId: identity.organization_id,
        tenantId: identity.tenant_id,
        action: 'auth.login.membership_selection',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip),
      });
      return this.createLoginSession(tx, identity, credential, userAgent, ip);
    });

    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid or expired membership selection');
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


  async refresh(dto: { refreshToken: string }, userAgent?: string, ip?: string) {
    const parsed = resolvePresentedCredential(dto.refreshToken, 'rt');
    if (!parsed) throw new UnauthorizedException('Invalid refresh token');

    const result = await this.repository.transaction(async (tx) => {
      const context = await this.repository.getRefreshContextForUpdate(tx, parsed.credentialId);
      if (!context || !secureEqual(context.refresh_token_hash, parsed.storedDigest)) {
        await this.audit(tx, {
          action: 'auth.refresh',
          outcome: 'DENIED',
          reason: 'REFRESH_TOKEN_NOT_FOUND',
          metadata: this.clientMetadata(userAgent, ip, { tokenId: parsed.credentialId }),
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
          metadata: this.clientMetadata(userAgent, ip, { tokenId: parsed.credentialId }),
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

      const issuedReplacement = issueRefreshCredential();
      await this.repository.rotateRefreshToken(tx, {
        currentTokenId: context.refresh_token_id,
        replacementTokenId: issuedReplacement.credentialId,
        replacementTokenHash: issuedReplacement.storedDigest,
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
          rotatedTo: issuedReplacement.credentialId,
        }),
      });
      return {
        kind: 'success' as const,
        accessToken: this.signAccessToken(
          context.user_id,
          context.session_id,
          context.current_credential_version,
        ),
        refreshToken: issuedReplacement.rawToken,
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
    const parsed = resolvePresentedCredential(dto.challengeToken, 'mc');
    if (!parsed) throw new UnauthorizedException('Invalid MFA challenge');

    const result = await this.repository.transaction(async (tx) => {
      const challenge = await this.repository.getMfaChallengeForUpdate(tx, parsed.credentialId);
      if (!challenge || !secureEqual(challenge.challenge_token_hash, parsed.storedDigest)) {
        return { kind: 'invalid' as const };
      }
      const invalidReason = this.sessionInvalidReason(challenge, true);
      const loginChallengeType = ['TOTP_ENROLL', 'TOTP_VERIFY'].includes(challenge.challenge_type);
      const challengeReason = !loginChallengeType
        ? 'MFA_CHALLENGE_FLOW_MISMATCH'
        : challenge.challenge_status !== 'PENDING'
          ? 'MFA_CHALLENGE_NOT_PENDING'
          : challenge.challenge_expires_at <= new Date()
            ? 'MFA_CHALLENGE_EXPIRED'
            : challenge.session_status !== 'MFA_PENDING'
              ? 'MFA_SESSION_NOT_PENDING'
              : invalidReason;
      if (
        challengeReason
      ) {
        // A consumed login challenge or a STEP_UP challenge can be replayed after
        // its session became ACTIVE. Such a replay must fail, but must never become
        // an unauthenticated session-revocation primitive.
        if (challenge.session_status === 'MFA_PENDING') {
          await this.repository.revokeSession(tx, challenge.session_id, challengeReason);
        }
        await this.audit(tx, {
          userId: challenge.user_id,
          sessionId: challenge.session_id,
          membershipId: challenge.membership_id,
          organizationId: challenge.organization_id,
          tenantId: challenge.tenant_id,
          action: 'auth.mfa.verify',
          outcome: 'DENIED',
          reason: challengeReason,
          metadata: this.clientMetadata(userAgent, ip),
        });
        return { kind: 'invalid' as const };
      }

      const credential = await this.requireCredentialState(tx, challenge.user_id, true);
      if (!credential.mfa_secret_ciphertext) return { kind: 'invalid' as const };
      const verification = await this.verifyMfaCode(tx, credential, dto.code);
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
      const issuedRefresh = issueRefreshCredential();
      await this.repository.createRefreshToken(tx, {
        id: issuedRefresh.credentialId,
        sessionId: challenge.session_id,
        familyId: challenge.refresh_family_id,
        tokenHash: issuedRefresh.storedDigest,
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
        refreshToken: issuedRefresh.rawToken,
        backupCodes: backup?.codes,
        user: this.userProjection(challenge, true),
      };
    });

    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid or expired MFA challenge');
    return result;
  }

  async startMfaStepUp(user: RequestUser, userAgent?: string, ip?: string) {
    if (!user.sessionId) throw new UnauthorizedException('Active session is required');

    return this.repository.transaction(async (tx) => {
      const context = await this.repository.getSessionContext(tx, user.sessionId as string, user.id, true);
      const invalidReason = context ? this.sessionInvalidReason(context) : 'SESSION_NOT_FOUND';
      if (!context || invalidReason) throw new UnauthorizedException('Session is not active');

      const credential = await this.requireCredentialState(tx, context.user_id, true);
      if (!credential.mfa_enabled || !credential.mfa_secret_ciphertext) {
        throw new ForbiddenException('MFA enrollment is required before step-up verification');
      }

      await this.repository.expirePendingMfaChallenges(tx, context.session_id, 'STEP_UP');
      const issuedChallenge = issueMfaChallengeCredential();
      const expiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS);
      await this.repository.createMfaChallenge(tx, {
        id: issuedChallenge.credentialId,
        sessionId: context.session_id,
        userId: context.user_id,
        challengeTokenHash: issuedChallenge.storedDigest,
        type: 'STEP_UP',
        expiresAt,
      });
      await this.audit(tx, {
        userId: context.user_id,
        sessionId: context.session_id,
        membershipId: context.membership_id,
        organizationId: context.organization_id,
        tenantId: context.tenant_id,
        action: 'auth.mfa.step_up.start',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip),
      });
      return {
        ok: true,
        challengeToken: issuedChallenge.rawToken,
        expiresAt: expiresAt.toISOString(),
        methods: ['totp', 'backup_code'] as const,
      };
    });
  }

  async verifyMfaStepUp(
    user: RequestUser,
    dto: MfaVerifyInput,
    userAgent?: string,
    ip?: string,
  ) {
    if (!user.sessionId) throw new UnauthorizedException('Active session is required');
    const parsed = resolvePresentedCredential(dto.challengeToken, 'mc');
    if (!parsed) throw new UnauthorizedException('Invalid MFA step-up challenge');

    const result = await this.repository.transaction(async (tx) => {
      const challenge = await this.repository.getMfaChallengeForUpdate(tx, parsed.credentialId);
      if (
        !challenge
        || !secureEqual(challenge.challenge_token_hash, parsed.storedDigest)
        || challenge.challenge_type !== 'STEP_UP'
        || challenge.session_id !== user.sessionId
        || challenge.user_id !== user.id
      ) {
        return { kind: 'invalid' as const };
      }
      const invalidReason = this.sessionInvalidReason(challenge);
      if (
        invalidReason
        || challenge.challenge_status !== 'PENDING'
        || challenge.challenge_expires_at <= new Date()
      ) {
        if (challenge.challenge_status === 'PENDING') {
          await this.repository.recordMfaFailure(tx, challenge.challenge_id, true);
        }
        await this.audit(tx, {
          userId: challenge.user_id,
          sessionId: challenge.session_id,
          membershipId: challenge.membership_id,
          organizationId: challenge.organization_id,
          tenantId: challenge.tenant_id,
          action: 'auth.mfa.step_up.verify',
          outcome: 'DENIED',
          reason: invalidReason ?? 'MFA_STEP_UP_CHALLENGE_INVALID',
          metadata: this.clientMetadata(userAgent, ip),
        });
        return { kind: 'invalid' as const };
      }

      const credential = await this.requireCredentialState(tx, challenge.user_id, true);
      if (!credential.mfa_enabled || !credential.mfa_secret_ciphertext) {
        return { kind: 'invalid' as const };
      }
      const verification = await this.verifyMfaCode(tx, credential, dto.code);
      if (!verification) {
        const terminal = challenge.challenge_attempts + 1 >= challenge.challenge_max_attempts;
        await this.repository.recordMfaFailure(tx, challenge.challenge_id, terminal);
        await this.audit(tx, {
          userId: challenge.user_id,
          sessionId: challenge.session_id,
          membershipId: challenge.membership_id,
          organizationId: challenge.organization_id,
          tenantId: challenge.tenant_id,
          action: 'auth.mfa.step_up.verify',
          outcome: 'FAILURE',
          reason: terminal ? 'MFA_STEP_UP_ATTEMPTS_EXHAUSTED' : 'MFA_STEP_UP_CODE_INVALID',
          metadata: this.clientMetadata(userAgent, ip, { attempts: challenge.challenge_attempts + 1 }),
        });
        return { kind: 'invalid' as const };
      }

      const verifiedAt = await this.repository.activateMfaStepUp(tx, {
        challengeId: challenge.challenge_id,
        sessionId: challenge.session_id,
        userId: challenge.user_id,
        method: verification.method,
        backupHashes: verification.method === 'BACKUP' ? verification.remainingBackupHashes : undefined,
      });
      await this.audit(tx, {
        userId: challenge.user_id,
        sessionId: challenge.session_id,
        membershipId: challenge.membership_id,
        organizationId: challenge.organization_id,
        tenantId: challenge.tenant_id,
        action: 'auth.mfa.step_up.verify',
        outcome: 'SUCCESS',
        metadata: this.clientMetadata(userAgent, ip, { method: verification.method }),
      });
      return { kind: 'success' as const, verifiedAt };
    });

    if (result.kind === 'invalid') throw new UnauthorizedException('Invalid or expired MFA step-up challenge');
    return { ok: true, mfaVerified: true, mfaVerifiedAt: result.verifiedAt.toISOString() };
  }

  async logout(dto: { refreshToken?: string }, sessionId?: string) {
    const parsedRefresh = dto.refreshToken ? resolvePresentedCredential(dto.refreshToken, 'rt') : null;
    await this.repository.transaction(async (tx) => {
      let context: SessionContextRow | null = sessionId
        ? await this.repository.getSessionContext(tx, sessionId, undefined, true)
        : null;
      if (!context && parsedRefresh) {
        const refreshContext = await this.repository.getRefreshContextForUpdate(tx, parsedRefresh.credentialId);
        if (refreshContext && secureEqual(refreshContext.refresh_token_hash, parsedRefresh.storedDigest)) {
          context = refreshContext;
        }
      }
      if (!context) return;
      await this.repository.revokeSession(tx, context.session_id, 'USER_LOGOUT');
      await this.audit(tx, {
        userId: context?.user_id,
        sessionId: context.session_id,
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
      isOrgAdmin: user.isOrgAdmin,
      fullName: user.fullName,
      surfaceRole: user.surfaceRole,
      mfaVerified: user.mfaVerified,
      mfaVerifiedAt: user.mfaVerifiedAt,
    };
  }

  async verifyAccessToken(token: string): Promise<RequestUser> {
    const claims: AccessClaims = verifyAccessClaims(token);

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
    if ((requiresRoleMfa(role) || context.is_org_admin) && !context.mfa_verified_at) {
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
      isOrgAdmin: context.is_org_admin,
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

  async getUserData(requestingUser: RequestUser) {
    const context = this.accountAuthorityContext(requestingUser);
    const account = await this.repository.accountDataExport(this.repository.prisma, context);
    if (!account) throw new NotFoundException('Account export is unavailable');
    return {
      exportedAt: new Date().toISOString(),
      exportVersion: '2.0',
      subject: '152-ФЗ Data Portability Export',
      profile: {
        id: account.user_id,
        email: account.email,
        fullName: account.full_name,
        phone: account.phone,
        createdAt: new Date(account.created_at).toISOString(),
      },
      memberships: account.membership_data.map((membership) => ({
        membershipId: membership.membershipId,
        role: membership.role,
        organizationId: membership.organizationId,
        organizationName: membership.organizationName,
        tenantId: membership.tenantId,
        organizationStatus: membership.organizationStatus,
      })),
      consent: {
        version: account.consent_version,
        recordedAt: account.consent_at ? new Date(account.consent_at).toISOString() : null,
        currentPolicyVersion: CURRENT_CONSENT_VERSION,
      },
      security: {
        mfaEnabled: account.mfa_enabled,
        credentialVersion: account.credential_version,
      },
    };
  }

  async anonymizeUser(requestingUser: RequestUser) {
    const context = this.accountAuthorityContext(requestingUser);
    return this.repository.transaction(async (tx) => {
      const result = await this.repository.anonymizeAccountIdentity(tx, context);
      if (!result?.applied || !result.anonymized_at) {
        throw new ConflictException('Account is already anonymized or the session is no longer active');
      }
      await this.audit(tx, {
        userId: context.userId,
        sessionId: context.sessionId,
        membershipId: context.membershipId,
        organizationId: context.organizationId,
        tenantId: context.tenantId,
        action: 'auth.account.anonymize',
        outcome: 'SUCCESS',
        reason: 'USER_REQUEST',
      });
      return { success: true, anonymizedAt: new Date(result.anonymized_at).toISOString() };
    });
  }

  private accountAuthorityContext(user: RequestUser): AccountAuthorityContext {
    if (!user.id || !user.sessionId || !user.membershipId || !user.orgId || !user.tenantId) {
      throw new UnauthorizedException('Authenticated account context is incomplete');
    }
    return {
      userId: user.id,
      sessionId: user.sessionId,
      membershipId: user.membershipId,
      organizationId: user.orgId,
      tenantId: user.tenantId,
    };
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

  private async createLoginSession(
    tx: AuthSqlClient,
    identity: IdentityRow,
    credential: CredentialStateRow,
    userAgent?: string,
    ip?: string,
  ) {
    const sessionId = `ses_${randomUUID()}`;
    const familyId = `rf_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const mfaRequired = requiresRoleMfa(this.role(identity.role)) || identity.is_org_admin || credential.mfa_enabled;
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
      const issuedChallenge = issueMfaChallengeCredential();
      const challengeExpiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS);
      await this.repository.createMfaChallenge(tx, {
        id: issuedChallenge.credentialId,
        sessionId,
        userId: identity.user_id,
        challengeTokenHash: issuedChallenge.storedDigest,
        type: enrollment ? 'TOTP_ENROLL' : 'TOTP_VERIFY',
        expiresAt: challengeExpiresAt,
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
        challengeToken: issuedChallenge.rawToken,
        expiresAt: challengeExpiresAt.toISOString(),
        setupSecret,
        otpAuthUri: setupSecret ? buildOtpAuthUri(identity.email, setupSecret) : undefined,
        // A pending-MFA response never discloses organization, tenant or
        // membership authority. The complete projection is returned only
        // after successful challenge verification.
        user: { email: identity.email, role: this.role(identity.role) },
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
    const issuedRefresh = issueRefreshCredential();
    await this.repository.createRefreshToken(tx, {
      id: issuedRefresh.credentialId,
      sessionId: input.id,
      familyId: input.familyId,
      tokenHash: issuedRefresh.storedDigest,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgentHash: hashClientValue(input.userAgent),
      ipHash: hashClientValue(input.ip),
    });
    return {
      accessToken: this.signAccessToken(identity.user_id, input.id, input.credentialVersion),
      refreshToken: issuedRefresh.rawToken,
      user: this.userProjection(identity, false),
    };
  }

  private signAccessToken(userId: string, sessionId: string, credentialVersion: number): string {
    return signAccessToken(userId, sessionId, credentialVersion);
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
      isOrgAdmin: identity.is_org_admin,
      mfaVerified,
    };
  }

  private role(value: string): Role {
    if (!KNOWN_ROLES.has(value) || value === Role.BANK_CALLBACK) {
      throw new ForbiddenException('Membership role is not authorized for a human session.');
    }
    return value as Role;
  }

  private identityInvalidReason(identity: IdentityRow): string | null {
    let reason: string | null = null;
    if (identity.user_status !== 'ACTIVE') reason = 'USER_NOT_ACTIVE';
    else if (identity.membership_status !== 'ACTIVE') reason = 'MEMBERSHIP_NOT_ACTIVE';
    else if (identity.organization_status !== 'VERIFIED') reason = 'ORGANIZATION_NOT_VERIFIED';
    else if (!KNOWN_ROLES.has(identity.role) || identity.role === Role.BANK_CALLBACK) reason = 'MEMBERSHIP_ROLE_INVALID';
    return reason;
  }

  private identityUsable(identity: IdentityRow): boolean {
    return identity.user_status === 'ACTIVE'
      && identity.membership_status === 'ACTIVE'
      && identity.organization_status === 'VERIFIED'
      && KNOWN_ROLES.has(identity.role)
      && identity.role !== Role.BANK_CALLBACK;
  }

  private sessionInvalidReason(context: SessionContextRow, allowMfaPending = false): string | null {
    if (context.session_status === 'REVOKED') return 'SESSION_REVOKED';
    if (context.session_status === 'EXPIRED' || context.session_expires_at <= new Date()) return 'SESSION_EXPIRED';
    // Evaluated before touchSession runs, so the reading is the previous
    // activity rather than this request's own.
    if (context.session_last_seen_at.getTime() + idleTimeoutMsForRole(context.role) <= Date.now()) {
      return 'SESSION_IDLE_TIMEOUT';
    }
    if (context.session_status !== 'ACTIVE' && !(allowMfaPending && context.session_status === 'MFA_PENDING')) {
      return 'SESSION_NOT_ACTIVE';
    }
    if (context.user_status !== 'ACTIVE') return 'USER_NOT_ACTIVE';
    if (context.membership_status !== 'ACTIVE') return 'MEMBERSHIP_NOT_ACTIVE';
    if (context.organization_status !== 'VERIFIED') return 'ORGANIZATION_NOT_VERIFIED';
    if (context.session_credential_version !== context.current_credential_version) return 'CREDENTIAL_VERSION_CHANGED';
    if (!KNOWN_ROLES.has(context.role) || context.role === Role.BANK_CALLBACK) return 'MEMBERSHIP_ROLE_INVALID';
    return null;
  }

  /**
   * Async because a TOTP match is not an acceptance until the time step it
   * proves has been consumed, and consuming is a database write.
   *
   * The consume lives here rather than in the callers on purpose. There are
   * three call sites, and a control that each of them has to remember to invoke
   * is a control that one of them will eventually not invoke - which is how the
   * matching backup-code path stayed correct while this one did not. Here there
   * is no way to obtain a TOTP acceptance without having consumed it.
   */
  private async verifyMfaCode(
    client: AuthSqlClient,
    credential: CredentialStateRow,
    code: string,
  ): Promise<{ method: 'TOTP' } | { method: 'BACKUP'; remainingBackupHashes: string[] } | null> {
    const secret = credential.mfa_secret_ciphertext
      ? decryptMfaSecret(credential.mfa_secret_ciphertext)
      : null;
    if (secret) {
      const counter = matchTotpCounter(secret, code);
      if (counter !== null) {
        // A replayed or stale counter advances nothing, and a refusal to
        // advance is a refusal to authenticate. Fail closed.
        const consumed = await this.repository.consumeTotpCounter(client, credential.user_id, counter);
        return consumed ? { method: 'TOTP' } : null;
      }
    }
    const hashes = Array.isArray(credential.mfa_backup_hashes)
      ? credential.mfa_backup_hashes.filter((item): item is string => typeof item === 'string')
      : [];
    const candidate = digestMfaBackupCode(code);
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
    // The position is part of the signed fact: a replayed or reordered event
    // cannot present the same hash from a different place in the chain.
    await appendAuthAudit(this.repository, tx, input);
  }
}
