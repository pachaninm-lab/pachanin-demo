import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { RequestUser } from '../../common/types/request-user';
import { isStrongPassword } from '../../common/validators/strong-password.validator';
import { AuthPrismaService } from './auth-prisma.service';
import { CURRENT_CONSENT_EVIDENCE, isCurrentConsent } from './consent-policy';
import {
  hashAuthMaterial,
  hashClientValue,
  makeOpaqueToken,
  parseOpaqueToken,
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
const MFA_RECOVERY_TTL_MS = 30 * 60 * 1000;
const ADMIN_MFA_FRESHNESS_MS = 15 * 60 * 1000;

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
    const token = makeOpaqueToken('iv');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation:${admin.organizationId}:${emailHash}`}, 0))`);

      const existing = await tx.$queryRaw<Array<InvitationRow>>(Prisma.sql`
        SELECT invitation.*, organization.name AS organization_name, organization.status AS organization_status
        FROM auth.organization_invitations invitation
        JOIN public.organizations organization ON organization.id = invitation.organization_id
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

      const duplicateMembership = await tx.userOrg.findFirst({
        where: {
          organizationId: admin.organizationId,
          user: { email, deletedAt: null },
        },
        select: { id: true },
      });
      if (duplicateMembership) throw new ConflictException({ code: 'ORGANIZATION_MEMBERSHIP_ALREADY_EXISTS' });

      const pendingInvitation = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM auth.organization_invitations
        WHERE organization_id = ${admin.organizationId}
          AND invited_email_hash = ${emailHash}
          AND status = 'PENDING'
        LIMIT 1
      `);
      if (pendingInvitation[0]) throw new ConflictException({ code: 'ORGANIZATION_INVITATION_ALREADY_PENDING' });

      const invitationId = token.id;
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.organization_invitations (
          id, organization_id, tenant_id, invited_email, invited_email_hash,
          role, token_hash, created_by_user_id, created_by_membership_id,
          idempotency_key, request_hash, correlation_id, expires_at
        ) VALUES (
          ${invitationId}, ${admin.organizationId}, ${admin.organization.tenantId}, ${email}, ${emailHash},
          ${role}, ${token.hash}, ${user.id}, ${admin.id},
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
          token: token.token,
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
    const token = makeOpaqueToken('iv');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const result = await this.prisma.$transaction(async (tx) => {
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
        SET token_hash = ${token.hash}, expires_at = ${expiresAt}, version = version + 1, updated_at = NOW()
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
        invitation: { ...current, token_hash: token.hash, expires_at: expiresAt, version: current.version + 1n },
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
          token: token.token,
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
    const parsed = parseOpaqueToken(dto.token, 'iv');
    if (!parsed) throw new BadRequestException({ code: 'INVITATION_INVALID' });
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<InvitationRow[]>(Prisma.sql`
        SELECT invitation.*, organization.name AS organization_name, organization.status AS organization_status
        FROM auth.organization_invitations invitation
        JOIN public.organizations organization ON organization.id = invitation.organization_id
        WHERE invitation.id = ${parsed.id}
        FOR UPDATE OF invitation, organization
      `);
      const invitation = rows[0];
      if (!invitation || !secureEqual(invitation.token_hash, parsed.hash) || invitation.status !== 'PENDING') {
        return { kind: 'invalid' as const };
      }
      if (invitation.expires_at <= new Date()) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE auth.organization_invitations
          SET status = 'EXPIRED', version = version + 1, updated_at = NOW()
          WHERE id = ${invitation.id} AND status = 'PENDING' AND version = ${invitation.version}
        `);
        await this.insertEvent(tx, {
          invitationId: invitation.id,
          eventType: 'EXPIRED',
          previousStatus: 'PENDING',
          newStatus: 'EXPIRED',
          reason: 'INVITATION_TTL_EXPIRED',
          correlationId,
          idempotencyKey: `accept-expired:${invitation.id}:${invitation.version}`,
          invitationVersion: invitation.version + 1n,
        });
        return { kind: 'invalid' as const };
      }
      if (invitation.organization_status !== 'VERIFIED') return { kind: 'invalid' as const };

      const existingUser = await tx.user.findUnique({
        where: { email: invitation.invited_email },
        select: { id: true, passwordHash: true, status: true, deletedAt: true },
      });
      if (
        existingUser
        && (existingUser.deletedAt || existingUser.status !== 'ACTIVE' || !await bcrypt.compare(dto.password, existingUser.passwordHash))
      ) return { kind: 'invalid' as const };
      if (!existingUser && !isStrongPassword(dto.password)) {
        throw new BadRequestException({ code: 'PASSWORD_POLICY_FAILED' });
      }

      const userId = existingUser?.id || `user_${randomUUID()}`;
      if (!existingUser) {
        await tx.user.create({
          data: {
            id: userId,
            email: invitation.invited_email,
            phone: normalizePhone(dto.phone),
            passwordHash,
            fullName: dto.fullName.trim(),
            status: 'ACTIVE',
          },
        });
      }
      const duplicate = await tx.userOrg.findUnique({
        where: { userId_organizationId: { userId, organizationId: invitation.organization_id } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException({ code: 'ORGANIZATION_MEMBERSHIP_ALREADY_EXISTS' });

      const membershipId = `membership_${randomUUID()}`;
      const membershipCount = await tx.userOrg.count({ where: { userId, status: 'ACTIVE' } });
      await tx.userOrg.create({
        data: {
          id: membershipId,
          userId,
          organizationId: invitation.organization_id,
          role: invitation.role,
          status: 'ACTIVE',
          isDefault: membershipCount === 0,
          isOrgAdmin: false,
          activatedAt: new Date(),
        },
      });
      await this.authRepository.ensureCredentialState(
        tx,
        userId,
        `${dto.termsVersion.trim()}|${dto.privacyVersion.trim()}`,
        new Date(),
      );

      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.organization_invitations
        SET status = 'ACCEPTED', accepted_at = NOW(), accepted_by_user_id = ${userId},
            accepted_membership_id = ${membershipId}, version = version + 1, updated_at = NOW()
        WHERE id = ${invitation.id} AND status = 'PENDING' AND version = ${invitation.version}
      `);
      if (updated !== 1) throw new ConflictException({ code: 'INVITATION_VERSION_CONFLICT' });
      await this.insertEvent(tx, {
        invitationId: invitation.id,
        actorUserId: userId,
        eventType: 'ACCEPTED',
        previousStatus: 'PENDING',
        newStatus: 'ACCEPTED',
        reason: 'EMAIL_LINK_AND_CREDENTIAL_VERIFIED',
        correlationId,
        idempotencyKey: `accept:${invitation.id}`,
        invitationVersion: invitation.version + 1n,
        metadata: { membershipId, role: invitation.role },
      });
      await this.audit(tx, {
        id: userId,
        orgId: invitation.organization_id,
        tenantId: invitation.tenant_id,
        membershipId,
      } as RequestUser, 'auth.organization.invitation.accept', 'SUCCESS', 'INVITATION_ACCEPTED', {
        invitationId: invitation.id,
        correlationId,
        consent: CURRENT_CONSENT_EVIDENCE,
        ipHash: hashClientValue(ip),
        userAgentHash: hashClientValue(userAgent),
      });
      return {
        kind: 'accepted' as const,
        organizationId: invitation.organization_id,
        organizationName: invitation.organization_name,
        membershipId,
        role: invitation.role,
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
      if (await this.membershipCommandReplayed(tx, admin, idempotencyKey, requestHash, membershipId, 'ROLE_CHANGE')) return true;
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_orgs membership
        SET role = ${role}, version = version + 1
        FROM public.organizations organization
        WHERE membership.id = ${membershipId}
          AND membership."organizationId" = ${admin.organizationId}
          AND membership."organizationId" = organization.id
          AND organization."tenantId" = ${admin.organization.tenantId}
          AND membership.status = 'ACTIVE'
          AND membership.version = ${version}
      `);
      if (updated !== 1) throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' });
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
      if (await this.membershipCommandReplayed(tx, admin, idempotencyKey, requestHash, membershipId, 'REVOKE')) return true;
      const targets = await tx.$queryRaw<Array<{ id: string; is_org_admin: boolean }>>(Prisma.sql`
        SELECT membership.id, membership.is_org_admin
        FROM public.user_orgs membership
        JOIN public.organizations organization ON organization.id = membership."organizationId"
        WHERE membership.id = ${membershipId}
          AND membership."organizationId" = ${admin.organizationId}
          AND organization."tenantId" = ${admin.organization.tenantId}
        FOR UPDATE OF membership
      `);
      const target = targets[0];
      if (!target) throw new NotFoundException({ code: 'MEMBERSHIP_NOT_FOUND' });
      if (target.is_org_admin) {
        const administrators = await tx.userOrg.count({
          where: { organizationId: admin.organizationId, status: 'ACTIVE', isOrgAdmin: true },
        });
        if (administrators <= 1) throw new ConflictException({ code: 'LAST_ORGANIZATION_ADMIN_REQUIRED' });
      }
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_orgs
        SET status = 'REVOKED', revoked_at = NOW(), "isDefault" = FALSE, version = version + 1
        WHERE id = ${target.id} AND status = 'ACTIVE' AND version = ${version}
      `);
      if (updated !== 1) throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' });
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
    const requestHash = hashAuthMaterial(stableJson({ membershipId, command: 'MFA_RESET', version: version.toString(), reason }));
    const token = makeOpaqueToken('mr');
    const expiresAt = new Date(Date.now() + MFA_RECOVERY_TTL_MS);
    const result = await this.prisma.$transaction(async (tx) => {
      if (await this.membershipCommandReplayed(tx, admin, idempotencyKey, requestHash, membershipId, 'MFA_RESET')) {
        const replay = await tx.$queryRaw<MfaRecoveryRow[]>(Prisma.sql`
          SELECT challenge.*, subject.email
          FROM auth.mfa_recovery_challenges challenge
          JOIN public.users subject ON subject.id = challenge.user_id
          WHERE challenge.idempotency_key = ${`mfa-recovery:${idempotencyKey}`}
          LIMIT 1
        `);
        if (!replay[0]) throw new ConflictException({ code: 'MFA_RECOVERY_REPLAY_NOT_FOUND' });
        return { challenge: replay[0], replayed: true as const };
      }
      const targets = await tx.$queryRaw<Array<{
        user_id: string;
        email: string;
        has_other_membership: boolean;
        has_staff_assignment: boolean;
        mfa_enabled: boolean;
        has_mfa_secret: boolean;
      }>>(Prisma.sql`
        SELECT
          membership."userId" AS user_id,
          subject.email,
          credential.mfa_enabled,
          (credential.mfa_secret_ciphertext IS NOT NULL) AS has_mfa_secret,
          EXISTS (
            SELECT 1
            FROM public.user_orgs other_membership
            WHERE other_membership."userId" = membership."userId"
              AND other_membership."organizationId" <> membership."organizationId"
              AND other_membership.status IN ('PENDING', 'ACTIVE', 'SUSPENDED')
          ) AS has_other_membership,
          EXISTS (
            SELECT 1
            FROM auth.staff_assignments assignment
            WHERE assignment.user_id = membership."userId"
              AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
              AND assignment.valid_from <= NOW()
              AND (assignment.valid_until IS NULL OR assignment.valid_until > NOW())
          ) AS has_staff_assignment
        FROM public.user_orgs membership
        JOIN public.organizations organization ON organization.id = membership."organizationId"
        JOIN public.users subject ON subject.id = membership."userId"
        JOIN auth.credential_states credential ON credential.user_id = subject.id
        WHERE membership.id = ${membershipId}
          AND membership."organizationId" = ${admin.organizationId}
          AND organization."tenantId" = ${admin.organization.tenantId}
          AND organization.status = 'VERIFIED'
          AND subject.status = 'ACTIVE'
          AND subject."deletedAt" IS NULL
          AND membership.status = 'ACTIVE'
          AND membership.version = ${version}
        FOR UPDATE OF membership, subject
      `);
      const target = targets[0];
      if (!target) throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' });
      if (target.has_other_membership || target.has_staff_assignment) {
        throw new ForbiddenException({ code: 'MFA_RECOVERY_PLATFORM_REVIEW_REQUIRED' });
      }
      if (!target.mfa_enabled || !target.has_mfa_secret) {
        throw new ConflictException({ code: 'MFA_NOT_ENROLLED' });
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
          ${token.id}, ${target.user_id}, ${membershipId}, ${admin.organizationId}, ${admin.organization.tenantId},
          ${token.hash}, ${user.id}, ${reason}, ${correlationId},
          ${`mfa-recovery:${idempotencyKey}`}, ${requestHash}, ${expiresAt}
        )
      `);
      const membershipUpdated = await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_orgs
        SET version = version + 1
        WHERE id = ${membershipId} AND version = ${version} AND status = 'ACTIVE'
      `);
      if (membershipUpdated !== 1) throw new ConflictException({ code: 'MEMBERSHIP_VERSION_CONFLICT' });
      await this.insertMfaRecoveryEvent(tx, {
        challengeId: token.id,
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
          id: token.id,
          user_id: target.user_id,
          membership_id: membershipId,
          organization_id: admin.organizationId,
          tenant_id: admin.organization.tenantId,
          token_hash: token.hash,
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
            token: token.token,
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
    const parsed = parseOpaqueToken(dto.token, 'mr');
    if (!parsed) throw new BadRequestException({ code: 'MFA_RECOVERY_INVALID' });

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<MfaRecoveryRow[]>(Prisma.sql`
        SELECT
          challenge.*,
          subject.email,
          subject."passwordHash" AS password_hash,
          subject.status AS user_status,
          subject."deletedAt" AS user_deleted_at,
          membership.status AS membership_status,
          organization.status AS organization_status,
          EXISTS (
            SELECT 1
            FROM public.user_orgs other_membership
            WHERE other_membership."userId" = challenge.user_id
              AND other_membership."organizationId" <> challenge.organization_id
              AND other_membership.status IN ('PENDING', 'ACTIVE', 'SUSPENDED')
          ) AS has_other_membership,
          EXISTS (
            SELECT 1
            FROM auth.staff_assignments assignment
            WHERE assignment.user_id = challenge.user_id
              AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
              AND assignment.valid_from <= NOW()
              AND (assignment.valid_until IS NULL OR assignment.valid_until > NOW())
          ) AS has_staff_assignment
        FROM auth.mfa_recovery_challenges challenge
        JOIN public.users subject ON subject.id = challenge.user_id
        JOIN public.user_orgs membership
          ON membership.id = challenge.membership_id
          AND membership."userId" = challenge.user_id
          AND membership."organizationId" = challenge.organization_id
        JOIN public.organizations organization
          ON organization.id = challenge.organization_id
          AND organization."tenantId" = challenge.tenant_id
        WHERE challenge.id = ${parsed.id}
        FOR UPDATE OF challenge, subject, membership
      `);
      const challenge = rows[0];
      if (!challenge || !secureEqual(challenge.token_hash, parsed.hash) || challenge.status !== 'PENDING') {
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

      const credentialUpdated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.credential_states
        SET mfa_enabled = TRUE,
            mfa_secret_ciphertext = NULL,
            mfa_key_version = NULL,
            mfa_backup_hashes = NULL,
            credential_version = credential_version + 1,
            updated_at = NOW()
        WHERE user_id = ${challenge.user_id}
      `);
      if (credentialUpdated !== 1) throw new NotFoundException({ code: 'CREDENTIAL_STATE_NOT_FOUND' });
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.users SET "mfaEnabled" = TRUE, "updatedAt" = NOW()
        WHERE id = ${challenge.user_id}
      `);
      const consumed = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.mfa_recovery_challenges
        SET status = 'CONSUMED', consumed_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE id = ${challenge.id} AND status = 'PENDING' AND version = ${challenge.version}
      `);
      if (consumed !== 1) throw new ConflictException({ code: 'MFA_RECOVERY_VERSION_CONFLICT' });
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

  private async requireAdmin(user: RequestUser): Promise<AdminMembership> {
    if (!user.id || !user.orgId || !user.tenantId || !user.membershipId || !user.isOrgAdmin) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    const mfaAt = Date.parse(String(user.mfaVerifiedAt || ''));
    if (!user.mfaVerified || !Number.isFinite(mfaAt) || Date.now() - mfaAt > ADMIN_MFA_FRESHNESS_MS) {
      throw new ForbiddenException({ code: 'FRESH_MFA_REQUIRED' });
    }
    const membership = await this.prisma.userOrg.findFirst({
      where: {
        id: user.membershipId,
        userId: user.id,
        organizationId: user.orgId,
        status: 'ACTIVE',
        isOrgAdmin: true,
        organization: { tenantId: user.tenantId, status: 'VERIFIED' },
      },
      select: {
        id: true,
        role: true,
        version: true,
        organizationId: true,
        organization: { select: { tenantId: true, status: true, name: true } },
      },
    });
    if (!membership || !isOrganizationHumanRole(membership.role)) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    return membership as AdminMembership;
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
      SELECT invitation.*, organization.name AS organization_name, organization.status AS organization_status
      FROM auth.organization_invitations invitation
      JOIN public.organizations organization ON organization.id = invitation.organization_id
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
    const prevHash = await this.authRepository.latestAuditHash(tx, user.id);
    const hash = sha256(stableJson({ id, action, outcome, reason, metadata, prevHash }));
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
    });
  }
}
