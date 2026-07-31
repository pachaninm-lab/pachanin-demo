import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID, timingSafeEqual } from 'crypto';
import { Role } from '../../common/types/request-user';
import { AuthPrismaService } from './auth-prisma.service';
import { hashAuthMaterial, hashClientValue, sha256, stableJson } from './auth-crypto';
import { type PublicWorkspaceClass, RegisterDto } from './dto/register.dto';
import { PersistentAuthRepository, type AuthSqlClient } from './persistent-auth.repository';
import {
  deriveRegistrationStatusToken,
  hashRegistrationStatusToken,
  issueRegistrationEmailToken,
  parseRegistrationEmailToken,
  REGISTRATION_APPLICATION_TTL_MS,
  REGISTRATION_EMAIL_TTL_MS,
  registrationTokenHashMatches,
} from './registration-token';

const WORKSPACE_ROLE: Readonly<Record<PublicWorkspaceClass, Role>> = {
  seller: Role.FARMER,
  buyer: Role.BUYER,
  logistics: Role.LOGISTICIAN,
  driver: Role.DRIVER,
  elevator: Role.ELEVATOR,
  lab: Role.LAB,
  surveyor: Role.SURVEYOR,
  bank: Role.ACCOUNTING,
  employee: Role.GUEST,
};

const TERMINAL_STATUSES = new Set(['ACTIVATED', 'REJECTED', 'CANCELLED', 'EXPIRED']);

type ExistingApplicationRow = {
  id: string;
  request_hash: string;
  status: string;
  correlation_id: string;
  idempotency_key: string;
  requested_workspace: PublicWorkspaceClass;
  kind: string;
};

type EmailChallengeRow = {
  id: string;
  application_id: string;
  user_id: string;
  token_hash: string;
  status: string;
  expires_at: Date;
  application_status: string;
  application_version: bigint;
  idempotency_key: string;
  organization_id: string;
  membership_id: string;
};

type ApplicationStatusRow = {
  id: string;
  kind: string;
  status: string;
  correlation_id: string;
  requested_workspace: PublicWorkspaceClass;
  submitted_at: Date;
  updated_at: Date;
  expires_at: Date;
  decision_reason: string | null;
  version: bigint;
};

function safeSecretEqual(leftValue: string, rightValue: string): boolean {
  const left = Buffer.from(leftValue, 'utf8');
  const right = Buffer.from(rightValue, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function deliveryAuthorized(provided?: string): boolean {
  const expected = String(process.env.REGISTRATION_DELIVERY_KEY ?? '').trim();
  const candidate = String(provided ?? '').trim();
  return expected.length >= 32 && candidate.length >= 32 && safeSecretEqual(candidate, expected);
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return `${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

function nextAction(status: string): string {
  switch (status) {
    case 'EMAIL_VERIFICATION_REQUIRED': return 'VERIFY_EMAIL';
    case 'PHONE_VERIFICATION_REQUIRED': return 'VERIFY_PHONE';
    case 'ORGANIZATION_VERIFICATION_PENDING': return 'WAIT_FOR_REVIEW';
    case 'ADDITIONAL_INFORMATION_REQUIRED': return 'PROVIDE_ADDITIONAL_INFORMATION';
    case 'APPROVED': return 'WAIT_FOR_ACTIVATION';
    case 'ACTIVATED': return 'LOGIN';
    case 'REJECTED': return 'CONTACT_SUPPORT';
    case 'SUSPENDED': return 'CONTACT_SUPPORT';
    case 'EXPIRED': return 'START_NEW_APPLICATION';
    case 'CANCELLED': return 'START_NEW_APPLICATION';
    default: return 'WAIT';
  }
}

export function roleForWorkspace(workspace: PublicWorkspaceClass): Role {
  return WORKSPACE_ROLE[workspace];
}

@Injectable()
export class RegistrationApplicationService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly authRepository: PersistentAuthRepository,
  ) {}

  async submit(
    dto: RegisterDto,
    context: {
      idempotencyKey?: string;
      correlationId: string;
      deliveryKey?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    const idempotencyKey = String(context.idempotencyKey ?? '').trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }

    const normalized = {
      email: dto.email.trim().toLowerCase(),
      phone: normalizePhone(dto.phone),
      fullName: dto.fullName.trim(),
      position: dto.position.trim(),
      orgLegalName: dto.orgLegalName.trim(),
      orgInn: dto.orgInn.replace(/\D/g, ''),
      orgKpp: dto.orgKpp?.replace(/\D/g, '') || null,
      orgOgrn: dto.orgOgrn?.replace(/\D/g, '') || null,
      orgType: dto.orgType,
      region: dto.region.trim(),
      workspace: dto.workspace,
      termsVersion: dto.termsVersion.trim(),
      privacyVersion: dto.privacyVersion.trim(),
    };
    const requestHash = hashAuthMaterial(stableJson(normalized));

    const existing = await this.findByIdempotency(idempotencyKey);
    if (existing) {
      if (!registrationTokenHashMatches(existing.request_hash, requestHash)) {
        throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
      }
      return this.submissionResponse(existing, undefined);
    }

    const requestedRole = roleForWorkspace(normalized.workspace);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailToken = issueRegistrationEmailToken();
    const now = new Date();
    const applicationExpiresAt = new Date(now.getTime() + REGISTRATION_APPLICATION_TTL_MS);
    const emailExpiresAt = new Date(now.getTime() + REGISTRATION_EMAIL_TTL_MS);
    const applicationId = `reg_${randomUUID()}`;
    const userId = `user_${randomUUID()}`;
    const membershipId = `membership_${randomUUID()}`;
    const statusToken = deriveRegistrationStatusToken(applicationId, idempotencyKey);
    const statusTokenHash = hashRegistrationStatusToken(statusToken);

    const result = await this.prisma.$transaction(async (tx) => {
      const concurrent = await this.findByIdempotency(idempotencyKey, tx);
      if (concurrent) {
        if (!registrationTokenHashMatches(concurrent.request_hash, requestHash)) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
        }
        return { existing: concurrent } as const;
      }

      const existingUser = await tx.user.findUnique({ where: { email: normalized.email }, select: { id: true } });
      if (existingUser) {
        throw new ConflictException({
          code: 'REGISTRATION_ACCOUNT_ALREADY_EXISTS',
          message: 'Use sign in or access recovery.',
        });
      }

      const existingOrganization = await tx.organization.findUnique({
        where: { inn: normalized.orgInn },
        select: { id: true, tenantId: true },
      });
      const kind = existingOrganization ? 'JOIN_EXISTING_ORGANIZATION' : 'NEW_ORGANIZATION';
      const organizationId = existingOrganization?.id ?? `org_${randomUUID()}`;
      const tenantId = existingOrganization?.tenantId ?? `tenant_${randomUUID()}`;

      if (!existingOrganization) {
        await tx.organization.create({
          data: {
            id: organizationId,
            inn: normalized.orgInn,
            ogrn: normalized.orgOgrn,
            name: normalized.orgLegalName,
            type: normalized.orgType,
            status: 'PENDING',
            tenantId,
            kycStatus: 'PENDING',
            amlStatus: 'CLEAR',
          },
        });
        await tx.$executeRaw(Prisma.sql`
          UPDATE public.organizations
          SET kpp = ${normalized.orgKpp}, region = ${normalized.region}
          WHERE id = ${organizationId}
        `);
      }

      await tx.user.create({
        data: {
          id: userId,
          email: normalized.email,
          phone: normalized.phone,
          passwordHash,
          fullName: normalized.fullName,
          status: 'PENDING_EMAIL_VERIFICATION',
        },
      });
      await tx.userOrg.create({
        data: {
          id: membershipId,
          userId,
          organizationId,
          role: Role.GUEST,
          isDefault: true,
        },
      });
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_orgs
        SET status = 'PENDING', requested_workspace = ${normalized.workspace}
        WHERE id = ${membershipId}
      `);
      await this.authRepository.ensureCredentialState(
        tx,
        userId,
        `${normalized.termsVersion}|${normalized.privacyVersion}`,
        now,
      );

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_applications (
          id, kind, user_id, organization_id, membership_id,
          requested_workspace, requested_role, status,
          correlation_id, idempotency_key, request_hash,
          legal_name, inn, kpp, ogrn, region, applicant_position,
          email, phone, terms_version, privacy_version,
          terms_accepted_at, privacy_accepted_at,
          consent_ip_hash, consent_user_agent_hash,
          status_token_hash, expires_at
        ) VALUES (
          ${applicationId}, ${kind}, ${userId}, ${organizationId}, ${membershipId},
          ${normalized.workspace}, ${requestedRole}, 'EMAIL_VERIFICATION_REQUIRED',
          ${context.correlationId}, ${idempotencyKey}, ${requestHash},
          ${normalized.orgLegalName}, ${normalized.orgInn}, ${normalized.orgKpp}, ${normalized.orgOgrn},
          ${normalized.region}, ${normalized.position}, ${normalized.email}, ${normalized.phone},
          ${normalized.termsVersion}, ${normalized.privacyVersion}, ${now}, ${now},
          ${hashClientValue(context.ip)}, ${hashClientValue(context.userAgent)},
          ${statusTokenHash}, ${applicationExpiresAt}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_email_challenges (
          id, application_id, user_id, token_hash, expires_at
        ) VALUES (
          ${emailToken.id}, ${applicationId}, ${userId}, ${emailToken.hash}, ${emailExpiresAt}
        )
      `);
      await this.insertEvent(tx, {
        applicationId,
        actorUserId: userId,
        actorKind: 'APPLICANT',
        previousStatus: null,
        newStatus: 'EMAIL_VERIFICATION_REQUIRED',
        reason: kind === 'NEW_ORGANIZATION' ? 'NEW_ORGANIZATION_SUBMITTED' : 'JOIN_REQUEST_SUBMITTED',
        correlationId: context.correlationId,
        idempotencyKey: `submit:${idempotencyKey}`,
        applicationVersion: 0n,
        metadata: { workspace: normalized.workspace, requestedRole },
      });
      await this.audit(tx, {
        userId,
        membershipId,
        organizationId,
        tenantId,
        action: 'auth.registration.submit',
        outcome: 'SUCCESS',
        reason: kind,
        metadata: {
          applicationId,
          requestedWorkspace: normalized.workspace,
          requestedRole,
          correlationId: context.correlationId,
        },
      });

      return {
        existing: {
          id: applicationId,
          request_hash: requestHash,
          status: 'EMAIL_VERIFICATION_REQUIRED',
          correlation_id: context.correlationId,
          idempotency_key: idempotencyKey,
          requested_workspace: normalized.workspace,
          kind,
        } satisfies ExistingApplicationRow,
        emailDelivery: deliveryAuthorized(context.deliveryKey)
          ? { email: normalized.email, token: emailToken.token, expiresInSeconds: Math.floor(REGISTRATION_EMAIL_TTL_MS / 1000) }
          : undefined,
      } as const;
    });

    return this.submissionResponse(result.existing, result.emailDelivery);
  }

  async verifyEmail(tokenInput: string, correlationId: string) {
    const parsed = parseRegistrationEmailToken(tokenInput);
    if (!parsed) throw new BadRequestException({ code: 'REGISTRATION_EMAIL_TOKEN_INVALID' });
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<EmailChallengeRow[]>(Prisma.sql`
        SELECT
          challenge.id,
          challenge.application_id,
          challenge.user_id,
          challenge.token_hash,
          challenge.status,
          challenge.expires_at,
          application.status AS application_status,
          application.version AS application_version,
          application.idempotency_key,
          application.organization_id,
          application.membership_id
        FROM auth.registration_email_challenges challenge
        JOIN auth.registration_applications application
          ON application.id = challenge.application_id
        WHERE challenge.id = ${parsed.id}
        FOR UPDATE OF challenge, application
      `);
      const challenge = rows[0];
      if (
        !challenge
        || challenge.status !== 'PENDING'
        || challenge.expires_at <= now
        || !registrationTokenHashMatches(challenge.token_hash, parsed.hash)
      ) {
        throw new BadRequestException({ code: 'REGISTRATION_EMAIL_TOKEN_INVALID' });
      }

      if (challenge.application_status !== 'EMAIL_VERIFICATION_REQUIRED') {
        throw new BadRequestException({ code: 'REGISTRATION_STATE_CONFLICT' });
      }

      const nextVersion = challenge.application_version + 1n;
      await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_email_challenges
        SET status = 'CONSUMED', consumed_at = ${now}, updated_at = NOW()
        WHERE id = ${challenge.id} AND status = 'PENDING'
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_applications
        SET status = 'ORGANIZATION_VERIFICATION_PENDING',
            email_verified_at = ${now},
            version = ${nextVersion},
            updated_at = NOW()
        WHERE id = ${challenge.application_id}
          AND status = 'EMAIL_VERIFICATION_REQUIRED'
          AND version = ${challenge.application_version}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.users
        SET status = 'PENDING_APPROVAL', "updatedAt" = NOW()
        WHERE id = ${challenge.user_id}
      `);
      await this.insertEvent(tx, {
        applicationId: challenge.application_id,
        actorUserId: challenge.user_id,
        actorKind: 'APPLICANT',
        previousStatus: 'EMAIL_VERIFICATION_REQUIRED',
        newStatus: 'ORGANIZATION_VERIFICATION_PENDING',
        reason: 'EMAIL_VERIFIED',
        correlationId,
        idempotencyKey: `email-verified:${challenge.id}`,
        applicationVersion: nextVersion,
      });
      await this.audit(tx, {
        userId: challenge.user_id,
        membershipId: challenge.membership_id,
        organizationId: challenge.organization_id,
        action: 'auth.registration.email_verified',
        outcome: 'SUCCESS',
        reason: 'EMAIL_VERIFIED',
        metadata: { applicationId: challenge.application_id, correlationId },
      });

      return {
        ok: true,
        applicationId: challenge.application_id,
        status: 'ORGANIZATION_VERIFICATION_PENDING',
        nextAction: nextAction('ORGANIZATION_VERIFICATION_PENDING'),
        statusToken: deriveRegistrationStatusToken(challenge.application_id, challenge.idempotency_key),
        correlationId,
      };
    });
  }

  async status(statusToken: string) {
    const normalizedToken = String(statusToken ?? '').trim();
    if (!normalizedToken.startsWith('rst_reg_') || normalizedToken.length > 512) {
      throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    }
    const tokenHash = hashRegistrationStatusToken(normalizedToken);
    const rows = await this.prisma.$queryRaw<ApplicationStatusRow[]>(Prisma.sql`
      SELECT
        id, kind, status, correlation_id, requested_workspace,
        submitted_at, updated_at, expires_at, decision_reason, version
      FROM auth.registration_applications
      WHERE status_token_hash = ${tokenHash}
      LIMIT 1
    `);
    const application = rows[0];
    if (!application) throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });

    const effectiveStatus = application.expires_at <= new Date() && !TERMINAL_STATUSES.has(application.status)
      ? 'EXPIRED'
      : application.status;
    return {
      applicationId: application.id,
      kind: application.kind,
      status: effectiveStatus,
      requestedWorkspace: application.requested_workspace,
      nextAction: nextAction(effectiveStatus),
      submittedAt: application.submitted_at.toISOString(),
      updatedAt: application.updated_at.toISOString(),
      reason: ['REJECTED', 'SUSPENDED', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(effectiveStatus)
        ? application.decision_reason
        : null,
      version: application.version.toString(),
      correlationId: application.correlation_id,
    };
  }


  private async findByIdempotency(
    idempotencyKey: string,
    client: AuthSqlClient = this.prisma,
  ): Promise<ExistingApplicationRow | null> {
    const rows = await client.$queryRaw<ExistingApplicationRow[]>(Prisma.sql`
      SELECT id, request_hash, status, correlation_id, idempotency_key, requested_workspace, kind
      FROM auth.registration_applications
      WHERE idempotency_key = ${idempotencyKey}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private submissionResponse(
    application: ExistingApplicationRow,
    emailDelivery?: { email: string; token: string; expiresInSeconds: number },
  ) {
    return {
      accepted: true,
      applicationId: application.id,
      kind: application.kind,
      status: application.status,
      requestedWorkspace: application.requested_workspace,
      nextAction: nextAction(application.status),
      statusToken: deriveRegistrationStatusToken(application.id, application.idempotency_key),
      correlationId: application.correlation_id,
      ...(emailDelivery ? { emailDelivery } : {}),
    };
  }


  private async insertEvent(
    client: AuthSqlClient,
    input: {
      applicationId: string;
      actorUserId?: string | null;
      actorKind: 'APPLICANT' | 'ORGANIZATION_ADMIN' | 'PLATFORM_REVIEWER' | 'SYSTEM';
      previousStatus: string | null;
      newStatus: string;
      reason: string;
      correlationId: string;
      idempotencyKey: string;
      applicationVersion: bigint;
      metadata?: Record<string, unknown>;
    },
  ) {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.registration_application_events (
        id, application_id, actor_user_id, actor_kind,
        previous_status, new_status, reason, correlation_id,
        idempotency_key, application_version, metadata
      ) VALUES (
        ${`reg_evt_${randomUUID()}`}, ${input.applicationId}, ${input.actorUserId ?? null}, ${input.actorKind},
        ${input.previousStatus}, ${input.newStatus}, ${input.reason}, ${input.correlationId},
        ${input.idempotencyKey}, ${input.applicationVersion},
        ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb
      )
    `);
  }

  private async audit(
    tx: AuthSqlClient,
    input: {
      userId?: string | null;
      membershipId?: string | null;
      organizationId?: string | null;
      tenantId?: string | null;
      action: string;
      outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
      reason?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ) {
    const id = `auth_evt_${randomUUID()}`;
    const prevHash = await this.authRepository.latestAuditHash(tx, input.userId, input.organizationId);
    const hash = sha256(stableJson({ id, ...input, prevHash }));
    await this.authRepository.insertAudit(tx, {
      id,
      userId: input.userId,
      membershipId: input.membershipId,
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason,
      metadata: input.metadata,
      hash,
      prevHash,
    });
  }
}
