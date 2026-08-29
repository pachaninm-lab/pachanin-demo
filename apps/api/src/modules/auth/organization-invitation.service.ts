import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { hashPassword } from './password-hashing';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { RequestUser } from '../../common/types/request-user';
import { isStrongPassword } from '../../common/validators/strong-password.validator';
import {
  issueInvitationCredential,
  issueMfaRecoveryCredential,
  resolvePresentedCredential,
} from './opaque-token-authority';
import { AuthPrismaService } from './auth-prisma.service';
import { CURRENT_CONSENT_EVIDENCE, isCurrentConsent } from './consent-policy';
import {
  hashAuthMaterial,
  hashClientValue,
  secureEqual,
  sha256,
  stableJson,
} from './auth-crypto';
import type {
  AcceptOrganizationInvitationDto,
  ConfirmMfaRecoveryDto,
} from './dto/organization-access.dto';
import {
  canAssignOrganizationRole,
  isOrganizationHumanRole,
  type OrganizationHumanRole,
} from './organization-role-policy';
import { PersistentAuthRepository, type AuthSqlClient } from './persistent-auth.repository';

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * The MFA-recovery credential is minted here, delivered to a separate channel
 * (email) and presented back to the application, which makes it an out-of-band
 * authentication request. ASVS 5.0 V6.5.5 caps those at ten minutes; this was
 * thirty.
 *
 * An invitation is not the same kind of credential and keeps its own, much
 * longer lifetime: it admits nobody on its own, it starts a review by a human
 * administrator, and it is not a step in authenticating an existing account.
 * The cap belongs to the credential that completes an authentication.
 *
 * Anything that tells a user how long this link lasts must derive the number
 * from here rather than restate it, which is why the delivery payload carries
 * expiresInSeconds.
 */
export const MFA_RECOVERY_TTL_MS = 10 * 60 * 1000;

type AdminMembership = {
  id: string;
  role: OrganizationHumanRole;
  version: bigint;
  organizationId: string;
  organization: { tenantId: string; status: string; name: string };
};

type InvitationRow = {
  id: string;
  organization_id: string;
  tenant_id: string;
  organization_name: string;
  organization_status: string;
  invited_email: string;
  invited_email_hash: string;
  role: OrganizationHumanRole;
  status: string;
  token_hash: string;
  request_hash: string;
  correlation_id: string;
  expires_at: Date;
  version: bigint;
};

type MfaRecoveryRow = {
  id: string;
  user_id: string;
  membership_id: string;
  organization_id: string;
  tenant_id: string;
  token_hash: string;
  status: string;
  expires_at: Date;
  attempts: number;
  max_attempts: number;
  version: bigint;
  email: string;
  password_hash?: string;
  user_status?: string;
  user_deleted_at?: Date | null;
  membership_status?: string;
  organization_status?: string;
  has_other_membership?: boolean;
  has_staff_assignment?: boolean;
};

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value?: string): string | null {
  const input = String(value || '').trim();
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  return `${input.startsWith('+') ? '+' : ''}${digits}`;
}

function safeSecretEqual(leftValue: string, rightValue: string): boolean {
  const left = Buffer.from(leftValue, 'utf8');
  const right = Buffer.from(rightValue, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function deliveryAuthorized(provided?: string): boolean {
  const expected = String(process.env.ORGANIZATION_INVITATION_DELIVERY_KEY || '').trim();
  const candidate = String(provided || '').trim();
  return expected.length >= 32 && candidate.length >= 32 && safeSecretEqual(candidate, expected);
}

@Injectable()
export class OrganizationInvitationService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly authRepository: PersistentAuthRepository,
  ) {}

  async list(user: RequestUser) {
    const admin = await this.requireAdmin(user);
    const invitations = await this.prisma.$queryRaw<Array<{
      id: string;
      invited_email: string;
      role: string;
      status: string;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
      version: bigint;
      correlation_id: string;
    }>>(Prisma.sql`
      SELECT id, invited_email, role, status, expires_at, created_at, updated_at, version, correlation_id
      FROM auth.organization_invitations
      WHERE organization_id = ${admin.organizationId}
        AND tenant_id = ${admin.organization.tenantId}
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `);
    return {
      organizationId: admin.organizationId,
      invitations: invitations.map((item) => ({
        invitationId: item.id,
        email: item.invited_email,
        role: item.role,
        status: item.status === 'PENDING' && item.expires_at <= new Date() ? 'EXPIRED' : item.status,
        expiresAt: item.expires_at.toISOString(),
        createdAt: item.created_at.toISOString(),
        updatedAt: item.updated_at.toISOString(),
        version: item.version.toString(),
        correlationId: item.correlation_id,
      })),
    };
  }

  async create(
    user: RequestUser,
    emailInput: string,
    role: OrganizationHumanRole,
    idempotencyKeyInput: string,
    correlationId: string,
    deliveryKey?: string,
  ) {
    const admin = await this.requireAdmin(user);
    this.assertRoleWithinCeiling(admin.role, role);
    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyInput);
    const email = normalizeEmail(emailInput);
    const emailHash = hashAuthMaterial(`invitation-email:${email}`);
    const requestHash = hashAuthMaterial(stableJson({ organizationId: admin.organizationId, email, role }));
    const token = issueInvitationCredential();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.establishAdminIdentityContext(tx, user, admin);
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation:${admin.organizationId}:${emailHash}`}, 0))`);

      const existing = await tx.$queryRaw<Array<InvitationRow>>(Prisma.sql`
        SELECT
          invitation.*,
          ${admin.organization.name}::text AS organization_name,
          ${admin.organization.status}::text AS organization_status
        FROM auth.organization_invitations invitation
        WHERE invitation.idempotency_key = ${idempotencyKey}
          AND invitation.organization_id = ${admin.organizationId}
          AND invitation.tenant_id = ${admin.organization.tenantId}
        LIMIT 1
      `);
      if (existing[0]) {
        if (!secureEqual(existing[0].request_hash, requestHash)) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
        }
        return { invitation: existing[0], replayed: true as const };
      }

      const expired = await tx.$queryRaw<Array<{ id: string; version: bigint }>>(Prisma.sql`
        SELECT id, version
        FROM auth.organization_invitations
        WHERE organization_id = ${admin.organizationId}
          AND invited_email_hash = ${emailHash}
          AND status = 'PENDING'
          AND expires_at <= NOW()
        FOR UPDATE
      `);
      for (const item of expired) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE auth.organization_invitations
          SET status = 'EXPIRED', version = version + 1, updated_at = NOW()
          WHERE id = ${item.id} AND status = 'PENDING' AND version = ${item.version}
        `);
        await this.insertEvent(tx, {
          invitationId: item.id,
          actorUserId: user.id,
          eventType: 'EXPIRED',
          previousStatus: 'PENDING',
          newStatus: 'EXPIRED',
          reason: 'INVITATION_TTL_EXPIRED',
          correlationId,
          idempotencyKey: `expire-on-create:${item.id}:${item.version}`,
          invitationVersion: item.version + 1n,
        });
      }

      const [duplicateMembership] = await tx.$queryRaw<Array<{ membership_exists: boolean }>>(Prisma.sql`
        SELECT membership_exists
        FROM auth.organization_membership_exists_for_email(
          ${user.sessionId}, ${user.id}, ${admin.id}, ${admin.organizationId},
          ${admin.organization.tenantId}, ${email}
        )
      `);
      if (duplicateMembership?.membership_exists) {
        throw new ConflictException({ code: 'ORGANIZATION_MEMBERSHIP_ALREADY_EXISTS' });
      }

      const pendingInvitation = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM auth.organization_invitations
        WHERE organization_id = ${admin.organizationId}
          AND invited_email_hash = ${emailHash}
          AND status = 'PENDING'
        LIMIT 1
      `);
      if (pendingInvitation[0]) throw new ConflictException({ code: 'ORGANIZATION_INVITATION_ALREADY_PENDING' });

      const invitationId = token.credentialId;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.organization_invitations (
          id, organization_id, tenant_id, invited_email, invited_email_hash,
          role, token_hash, created_by_user_id, created_by_membership_id,
          idempotency_key, request_hash, correlation_id, expires_at
        ) VALUES (
          ${invitationId}, ${admin.organizationId}, ${admin.organization.tenantId}, ${email}, ${emailHash},
          ${role}, ${token.storedDigest}, ${user.id}, ${admin.id},
          ${idempotencyKey}, ${requestHash}, ${correlationId}, ${expiresAt}
        )
      `);
      await this.insertEvent(tx, {
        invitationId,
        actorUserId: user.id,
        eventType: 'CREATED',
        previousStatus: null,
        newStatus: 'PENDING',
        reason: 'ORGANIZATION_ADMIN_INVITATION',
        correlationId,
        idempotencyKey: `create:${idempotencyKey}`,
        invitationVersion: 0n,
        metadata: { role },
      });
      await this.audit(tx, user, 'auth.organization.invitation.create', 'SUCCESS', 'INVITATION_CREATED', {
        invitationId,
        role,
        correlationId,
      });
      return {
        invitation: {
          id: invitationId,
          invited_email: email,
          role,
          status: 'PENDING',
          expires_at: expiresAt,
          correlation_id: correlationId,
        },
        replayed: false as const,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });

    return {
      invitationId: result.invitation.id,
      status: result.invitation.status,
      expiresAt: result.invitation.expires_at.toISOString(),
      correlationId: result.invitation.correlation_id,
      replayed: result.replayed,
      emailDelivery: !result.replayed && deliveryAuthorized(deliveryKey)
        ? {
          email,
          token: token.rawToken,
          organizationName: admin.organization.name,
          role,
          expiresInSeconds: Math.floor(INVITATION_TTL_MS / 1000),
        }
        : undefined,
    };
  }

  async resend(
    user: RequestUser,
    invitationId: string,
    reason: string,
    idempotencyKeyInput: string,
    correlationId: string,
    deliveryKey?: string,
  ) {
    const admin = await this.requireAdmin(user);
    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyInput);
    const token = issueInvitationCredential();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.establishAdminIdentityContext(tx, user, admin);
      const replay = await tx.$queryRaw<Array<{ invitation_id: string }>>(Prisma.sql`
        SELECT invitation_id FROM auth.organization_invitation_events
        WHERE idempotency_key = ${`resend:${idempotencyKey}`}
        LIMIT 1
      `);
      if (replay[0]) {
        return {
          invitation: await this.requireInvitation(tx, replay[0].invitation_id, admin, false),
          replayed: true as const,
        };
      }

      const current = await this.requireInvitation(tx, invitationId, admin, true);
      if (current.status !== 'PENDING' || current.expires_at <= new Date()) {
        throw new ConflictException({ code: 'INVITATION_NOT_PENDING' });
      }
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.organization_invitations
        SET token_hash = ${token.storedDigest}, expires_at = ${expiresAt}, version = version + 1, updated_at = NOW()
        WHERE id = ${current.id} AND status = 'PENDING' AND version = ${current.version}
      `);
      if (updated !== 1) throw new ConflictException({ code: 'INVITATION_VERSION_CONFLICT' });
      await this.insertEvent(tx, {
        invitationId: current.id,
        actorUserId: user.id,
        eventType: 'RESENT',
        previousStatus: 'PENDING',
        newStatus: 'PENDING',
        reason,
        correlationId,
        idempotencyKey: `resend:${idempotencyKey}`,
        invitationVersion: current.version + 1n,
      });
      await this.audit(tx, user, 'auth.organization.invitation.resend', 'SUCCESS', reason, { invitationId, correlationId });
      return {
        invitation: { ...current, token_hash: token.storedDigest, expires_at: expiresAt, version: current.version + 1n },
        replayed: false as const,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });

    return {
      invitationId: result.invitation.id,
      status: result.invitation.status,
      expiresAt: result.invitation.expires_at.toISOString(),
      correlationId,
      replayed: result.replayed,
      emailDelivery: !result.replayed && deliveryAuthorized(deliveryKey)
        ? {
          email: result.invitation.invited_email,
          token: token.rawToken,
          organizationName: result.invitation.organization_name,
          role: result.invitation.role,
          expiresInSeconds: Math.floor(INVITATION_TTL_MS / 1000),
        }
        : undefined,
    };
  }

  async revoke(
    user: RequestUser,
    invitationId: string,
    reason: string,
    idempotencyKeyInput: string,
    correlationId: string,
  ) {
    const admin = await this.requireAdmin(user);
    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyInput);
    return this.prisma.$transaction(async (tx) => {
      await this.establishAdminIdentityContext(tx, user, admin);
      const replay = await tx.$queryRaw<Array<{ invitation_id: string }>>(Prisma.sql`
        SELECT invitation_id FROM auth.organization_invitation_events
        WHERE idempotency_key = ${`revoke:${idempotencyKey}`}
        LIMIT 1
      `);
      if (replay[0]) return { invitationId: replay[0].invitation_id, status: 'REVOKED', correlationId };

      const current = await this.requireInvitation(tx, invitationId, admin, true);
      if (current.status !== 'PENDING') throw new ConflictException({ code: 'INVITATION_NOT_PENDING' });
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.organization_invitations
        SET status = 'REVOKED', revoked_at = NOW(), revoked_by_user_id = ${user.id},
            revoke_reason = ${reason}, version = version + 1, updated_at = NOW()
        WHERE id = ${current.id} AND status = 'PENDING' AND version = ${current.version}
      `);
      if (updated !== 1) throw new ConflictException({ code: 'INVITATION_VERSION_CONFLICT' });
      await this.insertEvent(tx, {
        invitationId: current.id,
        actorUserId: user.id,
        eventType: 'REVOKED',
        previousStatus: 'PENDING',
        newStatus: 'REVOKED',
        reason,
        correlationId,
        idempotencyKey: `revoke:${idempotencyKey}`,
        invitationVersion: current.version + 1n,
      });
      await this.audit(tx, user, 'auth.organization.invitation.revoke', 'SUCCESS', reason, { invitationId, correlationId });
      return { invitationId, status: 'REVOKED', correlationId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
  }

  async accept(dto: AcceptOrganizationInvitationDto, correlationId: string, ip?: string, userAgent?: string) {
    if (!dto.acceptTerms || !dto.acceptPrivacy || !isCurrentConsent(dto.termsVersion, dto.privacyVersion)) {
      throw new BadRequestException({ code: 'CONSENT_VERSION_NOT_CURRENT' });
    }
    const parsed = resolvePresentedCredential(dto.token, 'iv');
    if (!parsed) throw new BadRequestException({ code: 'INVITATION_INVALID' });
    const passwordHash = await hashPassword(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        invitation_id: string;
        organization_id: string;
        tenant_id: string;
        organization_name: string;
        organization_status: string;
        invited_email: string;
        role: OrganizationHumanRole;
        invitation_status: string;
        expires_at: Date;
        invitation_version: bigint;
        existing_user_id: string | null;
        existing_password_hash: string | null;
        existing_user_status: string | null;
        existing_user_deleted_at: Date | null;
      }>>(Prisma.sql`
        SELECT *
        FROM auth.resolve_invitation_acceptance_credential(
          ${parsed.credentialId}, ${parsed.storedDigest}
        )
      `);
      const invitation = rows[0];
      if (!invitation || invitation.invitation_status !== 'PENDING') {
        return { kind: 'invalid' as const };
      }
      if (invitation.expires_at <= new Date()) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE auth.organization_invitations
          SET status = 'EXPIRED', version = version + 1, updated_at = NOW()
          WHERE id = ${invitation.invitation_id}
            AND status = 'PENDING'
            AND version = ${invitation.invitation_version}
        `);
        await this.insertEvent(tx, {
          invitationId: invitation.invitation_id,
          eventType: 'EXPIRED',
          previousStatus: 'PENDING',
          newStatus: 'EXPIRED',
          reason: 'INVITATION_TTL_EXPIRED',
          correlationId,
          idempotencyKey: `accept-expired:${invitation.invitation_id}:${invitation.invitation_version}`,
          invitationVersion: invitation.invitation_version + 1n,
        });
        return { kind: 'invalid' as const };
      }
      if (invitation.organization_status !== 'VERIFIED') return { kind: 'invalid' as const };

      const existingUser = invitation.existing_user_id
        ? {
          id: invitation.existing_user_id,
          passwordHash: invitation.existing_password_hash,
          status: invitation.existing_user_status,
          deletedAt: invitation.existing_user_deleted_at,
        }
        : null;
      if (
        existingUser
        && (
          existingUser.deletedAt
          || existingUser.status !== 'ACTIVE'
          || !existingUser.passwordHash
          || !await bcrypt.compare(dto.password, existingUser.passwordHash)
        )
      ) return { kind: 'invalid' as const };
      if (!existingUser && !isStrongPassword(dto.password)) {
        throw new BadRequestException({ code: 'PASSWORD_POLICY_FAILED' });
      }

      const userId = existingUser?.id || `user_${randomUUID()}`;
      const membershipId = `membership_${randomUUID()}`;
      const [accepted] = await tx.$queryRaw<Array<{
        accepted: boolean;
        user_id: string | null;
        membership_id: string | null;
        organization_id: string | null;
        tenant_id: string | null;
        organization_name: string | null;
        role: OrganizationHumanRole | null;
        invitation_version: bigint | null;
      }>>(Prisma.sql`
        SELECT *
        FROM auth.accept_organization_invitation_identity(
          ${invitation.invitation_id},
          ${parsed.storedDigest},
          ${invitation.invitation_version},
          ${userId},
          ${existingUser?.passwordHash ?? null},
          ${!existingUser},
          ${passwordHash},
          ${normalizePhone(dto.phone)},
          ${dto.fullName.trim()},
          ${membershipId}
        )
      `);
      if (
        !accepted?.accepted
        || !accepted.user_id
        || !accepted.membership_id
        || !accepted.organization_id
        || !accepted.tenant_id
        || !accepted.organization_name
        || !accepted.role
        || accepted.invitation_version === null
      ) return { kind: 'invalid' as const };

      await this.authRepository.ensureCredentialState(
        tx,
        accepted.user_id,
        `${dto.termsVersion.trim()}|${dto.privacyVersion.trim()}`,
        new Date(),
      );

      await this.insertEvent(tx, {
        invitationId: invitation.invitation_id,
        actorUserId: accepted.user_id,
        eventType: 'ACCEPTED',
        previousStatus: 'PENDING',
        newStatus: 'ACCEPTED',
        reason: 'EMAIL_LINK_AND_CREDENTIAL_VERIFIED',
        correlationId,
        idempotencyKey: `accept:${invitation.invitation_id}`,
        invitationVersion: accepted.invitation_version,
        metadata: { membershipId: accepted.membership_id, role: accepted.role },
      });
      await this.audit(tx, {
        id: accepted.user_id,
        orgId: accepted.organization_id,
        tenantId: accepted.tenant_id,
        membershipId: accepted.membership_id,
      } as RequestUser, 'auth.organization.invitation.accept', 'SUCCESS', 'INVITATION_ACCEPTED', {
        invitationId: invitation.invitation_id,
        correlationId,
        consent: CURRENT_CONSENT_EVIDENCE,
        ipHash: hashClientValue(ip),
        userAgentHash: hashClientValue(userAgent),
      });
      return {
        kind: 'accepted' as const,
        organizationId: accepted.organization_id,
        organizationName: accepted.organization_name,
        membershipId: accepted.membership_id,
        role: accepted.role,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });

    if (result.kind === 'invalid') throw new BadRequestException({ code: 'INVITATION_INVALID' });
    return { ok: true, ...result, nextAction: 'LOGIN', correlationId };
  }

  async changeMembershipRole(
    user: RequestUser,
    membershipId: string,
    role: OrganizationHumanRole,
    version: bigint,
    reason: string,
    idempotencyKeyInput: string,
    correlationId: string,
  ) {
    const admin = await this.requireAdmin(user);
    this.assertRoleWithinCeiling(admin.role, role);
    if (membershipId === admin.id) throw new ForbiddenException({ code: 'SELF_ROLE_CHANGE_FORBIDDEN' });
    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyInput);
    const requestHash = hashAuthMaterial(stableJson({ membershipId, command: 'ROLE_CHANGE', role, version: version.toString(), reason }));
    const replayed = await this.prisma.$transaction(async (tx) => {
      await this.establishAdminIdentityContext(tx, user, admin);
      if (await this.membershipCommandReplayed(tx, admin, idempotencyKey, requestHash, membershipId, 'ROLE_CHANGE')) return true;
      const [transition] = await tx.$queryRaw<Array<{ applied: boolean }>>(Prisma.sql`
        SELECT applied
        FROM auth.change_organization_membership_role(
          ${String(user.sessionId)}, ${user.id}, ${admin.id},
          ${admin.organizationId}, ${admin.organization.tenantId},
          ${membershipId}, ${version}, ${role}
        )
      `);
      if (!transition?.applied) throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' });
      await this.audit(tx, user, 'auth.organization.membership.role_change', 'SUCCESS', reason, {
        membershipId,
        role,
        correlationId,
      });
      await this.insertMembershipCommandEvent(tx, {
        membershipId,
        organizationId: admin.organizationId,
        actorUserId: user.id,
        command: 'ROLE_CHANGE',
        requestHash,
        idempotencyKey,
        correlationId,
        previousVersion: version,
        newVersion: version + 1n,
        metadata: { role },
      });
      return false;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
    return { membershipId, role, version: (version + 1n).toString(), correlationId, replayed };
  }

  async revokeMembership(
    user: RequestUser,
    membershipId: string,
    version: bigint,
    reason: string,
    idempotencyKeyInput: string,
    correlationId: string,
  ) {
    const admin = await this.requireAdmin(user);
    if (membershipId === admin.id) throw new ForbiddenException({ code: 'SELF_REVOKE_FORBIDDEN' });
    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyInput);
    const requestHash = hashAuthMaterial(stableJson({ membershipId, command: 'REVOKE', version: version.toString(), reason }));
    const replayed = await this.prisma.$transaction(async (tx) => {
      await this.establishAdminIdentityContext(tx, user, admin);
      if (await this.membershipCommandReplayed(tx, admin, idempotencyKey, requestHash, membershipId, 'REVOKE')) return true;
      const [transition] = await tx.$queryRaw<Array<{ outcome: string }>>(Prisma.sql`
        SELECT outcome
        FROM auth.revoke_organization_membership(
          ${String(user.sessionId)}, ${user.id}, ${admin.id},
          ${admin.organizationId}, ${admin.organization.tenantId},
          ${membershipId}, ${version}
        )
      `);
      if (transition?.outcome === 'NOT_FOUND') {
        throw new NotFoundException({ code: 'MEMBERSHIP_NOT_FOUND' });
      }
      if (transition?.outcome === 'LAST_ADMIN') {
        throw new ConflictException({ code: 'LAST_ORGANIZATION_ADMIN_REQUIRED' });
      }
      if (transition?.outcome !== 'APPLIED') {
        throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' });
      }
      await this.audit(tx, user, 'auth.organization.membership.revoke', 'SUCCESS', reason, {
        membershipId,
        correlationId,
      });
      await this.insertMembershipCommandEvent(tx, {
        membershipId,
        organizationId: admin.organizationId,
        actorUserId: user.id,
        command: 'REVOKE',
        requestHash,
        idempotencyKey,
        correlationId,
        previousVersion: version,
        newVersion: version + 1n,
        metadata: { status: 'REVOKED' },
      });
      return false;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
    return { membershipId, status: 'REVOKED', version: (version + 1n).toString(), correlationId, replayed };
  }

  async resetMembershipMfa(
    user: RequestUser,
    membershipId: string,
    version: bigint,
    reason: string,
    idempotencyKeyInput: string,
    correlationId: string,
    deliveryKey?: string,
  ) {
    const admin = await this.requireAdmin(user);
    if (membershipId === admin.id) throw new ForbiddenException({ code: 'SELF_MFA_RESET_FORBIDDEN' });
    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyInput);
    // Membership, actor, purpose and the server-issued request key — no
    // credential material of any kind. The recovery token minted below is 256
    // bits of randomness and belongs to the credential contour, so it never
    // enters this hash either.
    const requestHash = hashAuthMaterial(stableJson({
      purpose: 'auth.membership.mfa_reset',
      membershipId,
      actorId: user.id,
      requestId: idempotencyKey,
      version: version.toString(),
      reason,
    }));
    const token = issueMfaRecoveryCredential();
    const expiresAt = new Date(Date.now() + MFA_RECOVERY_TTL_MS);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.establishAdminIdentityContext(tx, user, admin);
      if (await this.membershipCommandReplayed(tx, admin, idempotencyKey, requestHash, membershipId, 'MFA_RESET')) {
        const [replayedChallenge] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id
          FROM auth.mfa_recovery_challenges
          WHERE idempotency_key = ${`mfa-recovery:${idempotencyKey}`}
          LIMIT 1
        `);
        const replay = replayedChallenge
          ? await tx.$queryRaw<MfaRecoveryRow[]>(Prisma.sql`
            SELECT *
            FROM auth.organization_mfa_recovery_snapshot(
              ${String(user.sessionId)}, ${user.id}, ${admin.id},
              ${admin.organizationId}, ${admin.organization.tenantId},
              ${replayedChallenge.id}
            )
          `)
          : [];
        if (!replay[0]) throw new ConflictException({ code: 'MFA_RECOVERY_REPLAY_NOT_FOUND' });
        return { challenge: replay[0], replayed: true as const };
      }
      const targets = await tx.$queryRaw<Array<{
        prepared: boolean;
        user_id: string;
        email: string;
        has_other_membership: boolean;
        has_staff_assignment: boolean;
        mfa_enabled: boolean;
        has_mfa_secret: boolean;
        new_version: bigint;
      }>>(Prisma.sql`
        SELECT
          prepared,
          target_user_id AS user_id,
          target_email AS email,
          has_other_membership,
          has_staff_assignment,
          mfa_enabled,
          has_mfa_secret,
          new_version
        FROM auth.prepare_organization_mfa_recovery_target(
          ${String(user.sessionId)}, ${user.id}, ${admin.id},
          ${admin.organizationId}, ${admin.organization.tenantId},
          ${membershipId}, ${version}
        )
      `);
      const target = targets[0];
      if (!target) throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' });
      if (target.has_other_membership || target.has_staff_assignment) {
        throw new ForbiddenException({ code: 'MFA_RECOVERY_PLATFORM_REVIEW_REQUIRED' });
      }
      if (!target.mfa_enabled || !target.has_mfa_secret) {
        throw new ConflictException({ code: 'MFA_NOT_ENROLLED' });
      }
      if (!target.prepared || target.new_version !== version + 1n) {
        throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' });
      }

      const pending = await tx.$queryRaw<Array<{ id: string; version: bigint; expires_at: Date }>>(Prisma.sql`
        SELECT id, version, expires_at
        FROM auth.mfa_recovery_challenges
        WHERE user_id = ${target.user_id} AND status = 'PENDING'
        FOR UPDATE
      `);
      for (const current of pending) {
        const expired = current.expires_at <= new Date();
        const status = expired ? 'EXPIRED' : 'REVOKED';
        await tx.$executeRaw(Prisma.sql`
          UPDATE auth.mfa_recovery_challenges
          SET status = ${status}, version = version + 1, updated_at = NOW()
          WHERE id = ${current.id} AND status = 'PENDING' AND version = ${current.version}
        `);
        await this.insertMfaRecoveryEvent(tx, {
          challengeId: current.id,
          actorUserId: user.id,
          eventType: status,
          previousStatus: 'PENDING',
          newStatus: status,
          reason: expired ? 'MFA_RECOVERY_TTL_EXPIRED' : 'MFA_RECOVERY_REISSUED',
          correlationId,
          idempotencyKey: `mfa-recovery-revoke:${current.id}:${current.version}`,
          challengeVersion: current.version + 1n,
        });
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.mfa_recovery_challenges (
          id, user_id, membership_id, organization_id, tenant_id,
          token_hash, created_by_user_id, reason, correlation_id,
          idempotency_key, request_hash, expires_at
        ) VALUES (
          ${token.credentialId}, ${target.user_id}, ${membershipId}, ${admin.organizationId}, ${admin.organization.tenantId},
          ${token.storedDigest}, ${user.id}, ${reason}, ${correlationId},
          ${`mfa-recovery:${idempotencyKey}`}, ${requestHash}, ${expiresAt}
        )
      `);
      await this.insertMfaRecoveryEvent(tx, {
        challengeId: token.credentialId,
        actorUserId: user.id,
        eventType: 'CREATED',
        previousStatus: null,
        newStatus: 'PENDING',
        reason,
        correlationId,
        idempotencyKey: `mfa-recovery-create:${idempotencyKey}`,
        challengeVersion: 0n,
      });
      await this.audit(tx, user, 'auth.organization.membership.mfa_recovery_initiate', 'SUCCESS', reason, {
        membershipId,
        targetUserId: target.user_id,
        correlationId,
      });
      await this.insertMembershipCommandEvent(tx, {
        membershipId,
        organizationId: admin.organizationId,
        actorUserId: user.id,
        command: 'MFA_RESET',
        requestHash,
        idempotencyKey,
        correlationId,
        previousVersion: version,
        newVersion: version + 1n,
        metadata: { targetUserId: target.user_id, stage: 'RECOVERY_CHALLENGE_CREATED' },
      });
      return {
        challenge: {
          id: token.credentialId,
          user_id: target.user_id,
          membership_id: membershipId,
          organization_id: admin.organizationId,
          tenant_id: admin.organization.tenantId,
          token_hash: token.storedDigest,
          status: 'PENDING',
          expires_at: expiresAt,
          attempts: 0,
          max_attempts: 5,
          version: 0n,
          email: target.email,
        } satisfies MfaRecoveryRow,
        replayed: false as const,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });

    return {
      membershipId,
      mfaRecoveryInitiated: true,
      status: result.challenge.status,
      expiresAt: result.challenge.expires_at.toISOString(),
      version: (version + 1n).toString(),
      correlationId,
      replayed: result.replayed,
      recoveryDelivery: !result.replayed && deliveryAuthorized(deliveryKey)
        ? {
            email: result.challenge.email,
            token: token.rawToken,
            expiresInSeconds: Math.floor(MFA_RECOVERY_TTL_MS / 1000),
          }
        : undefined,
    };
  }

  async confirmMfaRecovery(
    dto: ConfirmMfaRecoveryDto,
    correlationId: string,
    deliveryKey?: string,
    ip?: string,
    userAgent?: string,
  ) {
    if (!deliveryAuthorized(deliveryKey)) throw new BadRequestException({ code: 'MFA_RECOVERY_INVALID' });
    const parsed = resolvePresentedCredential(dto.token, 'mr');
    if (!parsed) throw new BadRequestException({ code: 'MFA_RECOVERY_INVALID' });

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<MfaRecoveryRow[]>(Prisma.sql`
        SELECT *
        FROM auth.resolve_mfa_recovery_identity(
          ${parsed.credentialId}, ${parsed.storedDigest}
        )
      `);
      const challenge = rows[0];
      if (!challenge || challenge.status !== 'PENDING') {
        return { kind: 'invalid' as const };
      }
      if (challenge.expires_at <= new Date()) {
        const changed = await tx.$executeRaw(Prisma.sql`
          UPDATE auth.mfa_recovery_challenges
          SET status = 'EXPIRED', version = version + 1, updated_at = NOW()
          WHERE id = ${challenge.id} AND status = 'PENDING' AND version = ${challenge.version}
        `);
        if (changed === 1) {
          await this.insertMfaRecoveryEvent(tx, {
            challengeId: challenge.id,
            actorUserId: challenge.user_id,
            eventType: 'EXPIRED',
            previousStatus: 'PENDING',
            newStatus: 'EXPIRED',
            reason: 'MFA_RECOVERY_TTL_EXPIRED',
            correlationId,
            idempotencyKey: `mfa-recovery-expired:${challenge.id}:${challenge.version}`,
            challengeVersion: challenge.version + 1n,
          });
        }
        return { kind: 'invalid' as const };
      }
      if (
        challenge.user_status !== 'ACTIVE'
        || challenge.user_deleted_at
        || challenge.membership_status !== 'ACTIVE'
        || challenge.organization_status !== 'VERIFIED'
        || challenge.has_other_membership
        || challenge.has_staff_assignment
      ) {
        return { kind: 'invalid' as const };
      }
      const validPassword = await bcrypt.compare(dto.password, String(challenge.password_hash || ''));
      if (!validPassword) {
        const terminal = challenge.attempts + 1 >= challenge.max_attempts;
        const changed = await tx.$executeRaw(Prisma.sql`
          UPDATE auth.mfa_recovery_challenges
          SET attempts = attempts + 1,
              status = CASE WHEN ${terminal} THEN 'REVOKED' ELSE status END,
              version = version + 1,
              updated_at = NOW()
          WHERE id = ${challenge.id} AND status = 'PENDING' AND version = ${challenge.version}
        `);
        if (changed !== 1) throw new ConflictException({ code: 'MFA_RECOVERY_VERSION_CONFLICT' });
        if (terminal) {
          await this.insertMfaRecoveryEvent(tx, {
            challengeId: challenge.id,
            actorUserId: challenge.user_id,
            eventType: 'REVOKED',
            previousStatus: 'PENDING',
            newStatus: 'REVOKED',
            reason: 'MFA_RECOVERY_ATTEMPTS_EXHAUSTED',
            correlationId,
            idempotencyKey: `mfa-recovery-attempts-exhausted:${challenge.id}`,
            challengeVersion: challenge.version + 1n,
            metadata: { attempts: challenge.attempts + 1 },
          });
        }
        await this.audit(tx, {
          id: challenge.user_id,
          membershipId: challenge.membership_id,
          orgId: challenge.organization_id,
          tenantId: challenge.tenant_id,
        } as RequestUser, 'auth.mfa_recovery.confirm', 'DENIED', terminal ? 'MFA_RECOVERY_ATTEMPTS_EXHAUSTED' : 'CURRENT_PASSWORD_INVALID', {
          correlationId,
          ipHash: hashClientValue(ip),
          userAgentHash: hashClientValue(userAgent),
          attempts: challenge.attempts + 1,
        });
        return { kind: 'invalid' as const };
      }

      const finalized = await tx.$queryRaw<Array<{
        user_id: string;
        membership_id: string;
        organization_id: string;
        tenant_id: string;
        email: string;
      }>>(Prisma.sql`
        SELECT *
        FROM auth.finalize_mfa_recovery_identity(
          ${challenge.id}, ${parsed.storedDigest},
          ${String(challenge.password_hash || '')}, ${challenge.version}
        )
      `);
      if (!finalized[0]) throw new ConflictException({ code: 'MFA_RECOVERY_IDENTITY_CONFLICT' });
      await this.authRepository.revokeAllUserSessions(tx, challenge.user_id, 'CONTROLLED_MFA_RECOVERY');
      await this.insertMfaRecoveryEvent(tx, {
        challengeId: challenge.id,
        actorUserId: challenge.user_id,
        eventType: 'CONSUMED',
        previousStatus: 'PENDING',
        newStatus: 'CONSUMED',
        reason: 'EMAIL_TOKEN_AND_CURRENT_PASSWORD_VERIFIED',
        correlationId,
        idempotencyKey: `mfa-recovery-consumed:${challenge.id}`,
        challengeVersion: challenge.version + 1n,
      });
      await this.audit(tx, {
        id: challenge.user_id,
        membershipId: challenge.membership_id,
        orgId: challenge.organization_id,
        tenantId: challenge.tenant_id,
      } as RequestUser, 'auth.mfa_recovery.confirm', 'SUCCESS', 'MFA_REENROLLMENT_REQUIRED', {
        correlationId,
        ipHash: hashClientValue(ip),
        userAgentHash: hashClientValue(userAgent),
      });
      return { kind: 'success' as const, email: challenge.email };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });

    if (result.kind === 'invalid') throw new BadRequestException({ code: 'MFA_RECOVERY_INVALID' });
    return {
      ok: true,
      sessionsRevoked: true,
      mfaReenrollmentRequired: true,
      nextAction: 'LOGIN',
      notificationDelivery: { email: result.email },
      correlationId,
    };
  }

  private async insertMfaRecoveryEvent(
    tx: AuthSqlClient,
    input: {
      challengeId: string;
      actorUserId?: string | null;
      eventType: 'CREATED' | 'REVOKED' | 'EXPIRED' | 'CONSUMED';
      previousStatus: string | null;
      newStatus: string;
      reason: string;
      correlationId: string;
      idempotencyKey: string;
      challengeVersion: bigint;
      metadata?: Record<string, unknown>;
    },
  ) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO auth.mfa_recovery_events (
        id, challenge_id, actor_user_id, event_type, previous_status,
        new_status, reason, correlation_id, idempotency_key,
        challenge_version, metadata
      ) VALUES (
        ${`mfa_rec_evt_${randomUUID()}`}, ${input.challengeId}, ${input.actorUserId || null},
        ${input.eventType}, ${input.previousStatus}, ${input.newStatus}, ${input.reason},
        ${input.correlationId}, ${input.idempotencyKey}, ${input.challengeVersion},
        ${JSON.stringify(input.metadata || {})}::jsonb
      )
    `);
  }

  private async membershipCommandReplayed(
    tx: AuthSqlClient,
    admin: AdminMembership,
    idempotencyKey: string,
    requestHash: string,
    membershipId: string,
    command: 'ROLE_CHANGE' | 'REVOKE' | 'MFA_RESET',
  ) {
    const rows = await tx.$queryRaw<Array<{
      membership_id: string;
      command: string;
      request_hash: string;
    }>>(Prisma.sql`
      SELECT membership_id, command, request_hash
      FROM auth.organization_membership_command_events
      WHERE idempotency_key = ${`membership-command:${idempotencyKey}`}
        AND organization_id = ${admin.organizationId}
      LIMIT 1
    `);
    const existing = rows[0];
    if (!existing) return false;
    if (
      existing.membership_id !== membershipId
      || existing.command !== command
      || !secureEqual(existing.request_hash, requestHash)
    ) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
    }
    return true;
  }

  private async insertMembershipCommandEvent(
    tx: AuthSqlClient,
    input: {
      membershipId: string;
      organizationId: string;
      actorUserId: string;
      command: 'ROLE_CHANGE' | 'REVOKE' | 'MFA_RESET';
      requestHash: string;
      idempotencyKey: string;
      correlationId: string;
      previousVersion: bigint;
      newVersion: bigint;
      metadata: Record<string, unknown>;
    },
  ) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO auth.organization_membership_command_events (
        id, membership_id, organization_id, actor_user_id, command,
        request_hash, idempotency_key, correlation_id,
        previous_version, new_version, metadata
      ) VALUES (
        ${`membership_evt_${randomUUID()}`}, ${input.membershipId}, ${input.organizationId},
        ${input.actorUserId}, ${input.command}, ${input.requestHash},
        ${`membership-command:${input.idempotencyKey}`}, ${input.correlationId},
        ${input.previousVersion}, ${input.newVersion}, ${JSON.stringify(input.metadata)}::jsonb
      )
    `);
  }

  private async requireAdmin(
    user: RequestUser,
    client: AuthSqlClient = this.prisma,
  ): Promise<AdminMembership> {
    if (!user.id || !user.orgId || !user.tenantId || !user.membershipId || !user.sessionId) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    const rows = await client.$queryRaw<Array<{
      membership_id: string;
      role: string;
      membership_version: bigint;
      organization_id: string;
      tenant_id: string;
      organization_status: string;
      organization_name: string;
    }>>(Prisma.sql`
      SELECT
        membership_id, role, membership_version, organization_id,
        tenant_id, organization_status, organization_name
      FROM auth.resolve_organization_admin_session(
        ${user.sessionId}, ${user.id}, ${user.membershipId}, ${user.orgId}, ${user.tenantId}
      )
    `);
    const membership = rows[0];
    if (!membership || !isOrganizationHumanRole(membership.role)) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    return {
      id: membership.membership_id,
      role: membership.role,
      version: membership.membership_version,
      organizationId: membership.organization_id,
      organization: {
        tenantId: membership.tenant_id,
        status: membership.organization_status,
        name: membership.organization_name,
      },
    };
  }

  private async establishAdminIdentityContext(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    expected: AdminMembership,
  ): Promise<void> {
    await tx.$queryRaw(Prisma.sql`
      SELECT
        set_config('app.current_user_id', ${user.id}, true),
        set_config('app.current_org_id', ${expected.organizationId}, true),
        set_config('app.current_tenant_id', ${expected.organization.tenantId}, true),
        set_config('app.current_role', ${user.role}, true),
        set_config('app.current_session_id', ${user.sessionId || ''}, true)
    `);
    const current = await this.requireAdmin(user, tx);
    if (
      current.id !== expected.id
      || current.organizationId !== expected.organizationId
      || current.organization.tenantId !== expected.organization.tenantId
      || current.role !== expected.role
    ) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
  }

  private assertRoleWithinCeiling(adminRole: OrganizationHumanRole, requestedRole: OrganizationHumanRole) {
    if (!canAssignOrganizationRole(adminRole, requestedRole)) {
      throw new ForbiddenException({ code: 'ROLE_PERMISSION_CEILING_EXCEEDED' });
    }
  }

  private requireIdempotencyKey(value: string): string {
    const key = String(value || '').trim();
    if (key.length < 16 || key.length > 128) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return key;
  }

  private async requireInvitation(
    tx: Prisma.TransactionClient,
    invitationId: string,
    admin: AdminMembership,
    lock: boolean,
  ): Promise<InvitationRow> {
    const suffix = lock ? Prisma.sql` FOR UPDATE OF invitation` : Prisma.empty;
    const rows = await tx.$queryRaw<InvitationRow[]>(Prisma.sql`
      SELECT
        invitation.*,
        ${admin.organization.name}::text AS organization_name,
        ${admin.organization.status}::text AS organization_status
      FROM auth.organization_invitations invitation
      WHERE invitation.id = ${invitationId}
        AND invitation.organization_id = ${admin.organizationId}
        AND invitation.tenant_id = ${admin.organization.tenantId}${suffix}
    `);
    if (!rows[0]) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND' });
    return rows[0];
  }

  private async insertEvent(
    tx: AuthSqlClient,
    input: {
      invitationId: string;
      actorUserId?: string | null;
      eventType: 'CREATED' | 'RESENT' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
      previousStatus: string | null;
      newStatus: string;
      reason: string;
      correlationId: string;
      idempotencyKey: string;
      invitationVersion: bigint;
      metadata?: Record<string, unknown>;
    },
  ) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO auth.organization_invitation_events (
        id, invitation_id, actor_user_id, event_type, previous_status, new_status,
        reason, correlation_id, idempotency_key, invitation_version, metadata
      ) VALUES (
        ${`inv_evt_${randomUUID()}`}, ${input.invitationId}, ${input.actorUserId || null}, ${input.eventType},
        ${input.previousStatus}, ${input.newStatus}, ${input.reason}, ${input.correlationId},
        ${input.idempotencyKey}, ${input.invitationVersion}, ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb
      )
    `);
  }

  private async audit(
    tx: AuthSqlClient,
    user: Pick<RequestUser, 'id' | 'membershipId' | 'orgId' | 'tenantId'>,
    action: string,
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED',
    reason: string,
    metadata: Record<string, unknown>,
  ) {
    const id = `auth_evt_${randomUUID()}`;
    const { chainKey, prevHash, nextSequence } = await this.authRepository.latestAuditChainPosition(
      tx,
      user.id,
      null,
    );
    const hash = sha256(stableJson({
      id, action, outcome, reason, metadata, prevHash, chainKey,
      chainSequence: nextSequence.toString(),
    }));
    await this.authRepository.insertAudit(tx, {
      id,
      userId: user.id,
      membershipId: user.membershipId,
      organizationId: user.orgId,
      tenantId: user.tenantId,
      action,
      outcome,
      reason,
      metadata,
      hash,
      prevHash,
      chainSequence: nextSequence,
    });
  }
}
