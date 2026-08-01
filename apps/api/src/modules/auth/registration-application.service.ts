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
import { CURRENT_CONSENT_EVIDENCE, isCurrentConsent } from './consent-policy';
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

type RegistrationAttemptOutcome = 'APPLICATION_CREATED' | 'SUPPRESSED_EXISTING_ACCOUNT';

type ExistingSubmissionRow = {
  id: string | null;
  request_hash: string;
  status: string;
  correlation_id: string;
  idempotency_key: string;
  outcome: RegistrationAttemptOutcome;
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
  application_kind: 'NEW_ORGANIZATION' | 'JOIN_EXISTING_ORGANIZATION';
  requested_workspace: string;
  applicant_email: string;
  applicant_name: string;
};

type ApplicationStatusRow = {
  id: string;
  user_id: string;
  membership_id: string;
  organization_id: string;
  status: string;
  correlation_id: string;
  submitted_at: Date;
  updated_at: Date;
  expires_at: Date;
  decision_reason: string | null;
  version: bigint;
};

type PreviousApplicationRow = {
  id: string;
  kind: 'NEW_ORGANIZATION' | 'JOIN_EXISTING_ORGANIZATION';
  user_id: string;
  membership_id: string;
  organization_id: string;
  tenant_id: string;
  inn: string;
  status: string;
  version: bigint;
  expires_at: Date;
  user_status: string;
  user_deleted_at: Date | null;
  membership_status: string;
  organization_status: string;
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
      // The plaintext password never enters request/audit metadata. Its keyed
      // fingerprint does, so an idempotency key cannot silently accept a retry
      // that asks to install a different credential.
      passwordFingerprint: hashAuthMaterial(`registration-password:${dto.password}`),
    };
    if (!isCurrentConsent(normalized.termsVersion, normalized.privacyVersion)) {
      throw new BadRequestException({ code: 'CONSENT_VERSION_NOT_CURRENT' });
    }
    const requestHash = hashAuthMaterial(stableJson(normalized));

    const existing = await this.findByIdempotency(idempotencyKey);
    if (existing) {
      if (!registrationTokenHashMatches(existing.request_hash, requestHash)) {
        throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
      }
      return this.submissionResponse(existing);
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
      await this.lockRegistrationKeys(tx, [
        `registration-idempotency:${idempotencyKey}`,
        `registration-email:${normalized.email}`,
        `registration-inn:${normalized.orgInn}`,
      ]);

      const concurrent = await this.findByIdempotency(idempotencyKey, tx);
      if (concurrent) {
        if (!registrationTokenHashMatches(concurrent.request_hash, requestHash)) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' });
        }
        return { existing: concurrent } as const;
      }

      let effectiveUserId = userId;
      let effectiveMembershipId = membershipId;
      let reusableApplication: PreviousApplicationRow | null = null;
      const existingUser = await tx.user.findUnique({ where: { email: normalized.email }, select: { id: true } });
      if (existingUser) {
        const priorRows = await tx.$queryRaw<PreviousApplicationRow[]>(Prisma.sql`
          SELECT
            application.id,
            application.kind,
            application.user_id,
            application.membership_id,
            application.organization_id,
            organization."tenantId" AS tenant_id,
            application.inn,
            application.status,
            application.version,
            application.expires_at,
            subject.status AS user_status,
            subject."deletedAt" AS user_deleted_at,
            membership.status AS membership_status,
            organization.status AS organization_status
          FROM auth.registration_applications application
          JOIN public.users subject ON subject.id = application.user_id
          JOIN public.user_orgs membership ON membership.id = application.membership_id
          JOIN public.organizations organization ON organization.id = application.organization_id
          WHERE application.user_id = ${existingUser.id}
          ORDER BY application.created_at DESC, application.id DESC
          LIMIT 1
          FOR UPDATE OF application, subject, membership, organization
        `);
        const prior = priorRows[0] ?? null;
        if (prior && prior.expires_at <= now && !TERMINAL_STATUSES.has(prior.status)) {
          prior.version = await this.expireApplication(tx, prior, context.correlationId);
          prior.status = 'EXPIRED';
        }
        if (
          prior
          && ['EXPIRED', 'CANCELLED'].includes(prior.status)
          && prior.inn === normalized.orgInn
          && prior.user_deleted_at === null
          && ['PENDING_EMAIL_VERIFICATION', 'PENDING_APPROVAL'].includes(prior.user_status)
          && prior.membership_status === 'PENDING'
          && ['PENDING', 'VERIFIED'].includes(prior.organization_status)
        ) {
          reusableApplication = prior;
          effectiveUserId = prior.user_id;
          effectiveMembershipId = prior.membership_id;
        }
      }
      if (existingUser && !reusableApplication) {
        const suppressed = {
          id: null,
          request_hash: requestHash,
          status: 'EMAIL_VERIFICATION_REQUIRED',
          correlation_id: context.correlationId,
          idempotency_key: idempotencyKey,
          outcome: 'SUPPRESSED_EXISTING_ACCOUNT',
        } satisfies ExistingSubmissionRow;
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO auth.registration_public_attempts (
            id, idempotency_key, request_hash, correlation_id, outcome, application_id
          ) VALUES (
            ${`reg_attempt_${randomUUID()}`}, ${idempotencyKey}, ${requestHash},
            ${context.correlationId}, 'SUPPRESSED_EXISTING_ACCOUNT', NULL
          )
        `);
        await this.audit(tx, {
          action: 'auth.registration.submit',
          outcome: 'SUCCESS',
          reason: 'PUBLIC_REQUEST_ACCEPTED',
          metadata: { correlationId: context.correlationId, requestHash },
        });
        return { existing: suppressed } as const;
      }

      const existingOrganization = reusableApplication
        ? null
        : await tx.organization.findUnique({
            where: { inn: normalized.orgInn },
            select: { id: true, tenantId: true },
          });
      const kind = reusableApplication?.kind
        ?? (existingOrganization ? 'JOIN_EXISTING_ORGANIZATION' : 'NEW_ORGANIZATION');
      const organizationId = reusableApplication?.organization_id
        ?? existingOrganization?.id
        ?? `org_${randomUUID()}`;
      const tenantId = reusableApplication?.tenant_id
        ?? existingOrganization?.tenantId
        ?? `tenant_${randomUUID()}`;
      if (!existingOrganization && !reusableApplication) {
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

      if (reusableApplication) {
        await tx.user.update({
          where: { id: effectiveUserId },
          data: {
            phone: normalized.phone,
            passwordHash,
            fullName: normalized.fullName,
            status: 'PENDING_EMAIL_VERIFICATION',
          },
        });
        await tx.userOrg.update({
          where: { id: effectiveMembershipId },
          data: {
            role: Role.GUEST,
            status: 'PENDING',
            requestedWorkspace: normalized.workspace,
            isDefault: true,
            version: { increment: 1 },
          },
        });
        if (kind === 'NEW_ORGANIZATION') {
          await tx.$executeRaw(Prisma.sql`
            UPDATE public.organizations
            SET name = ${normalized.orgLegalName},
                type = ${normalized.orgType},
                ogrn = ${normalized.orgOgrn},
                kpp = ${normalized.orgKpp},
                region = ${normalized.region},
                version = version + 1,
                "updatedAt" = NOW()
            WHERE id = ${organizationId} AND status = 'PENDING'
          `);
        }
        await this.authRepository.revokeAllUserSessions(tx, effectiveUserId, 'REGISTRATION_RESTARTED');
      } else {
        await tx.user.create({
          data: {
            id: effectiveUserId,
            email: normalized.email,
            phone: normalized.phone,
            passwordHash,
            fullName: normalized.fullName,
            status: 'PENDING_EMAIL_VERIFICATION',
          },
        });
        await tx.userOrg.create({
          data: {
            id: effectiveMembershipId,
            userId: effectiveUserId,
            organizationId,
            role: Role.GUEST,
            status: 'PENDING',
            requestedWorkspace: normalized.workspace,
            isDefault: true,
          },
        });
      }
      await this.authRepository.ensureCredentialState(
        tx,
        effectiveUserId,
        `${normalized.termsVersion}|${normalized.privacyVersion}`,
        now,
      );
      if (reusableApplication) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE auth.credential_states
          SET credential_version = credential_version + 1,
              password_changed_at = ${now},
              failed_login_count = 0,
              locked_until = NULL,
              consent_version = ${`${normalized.termsVersion}|${normalized.privacyVersion}`},
              consent_at = ${now},
              updated_at = NOW()
          WHERE user_id = ${effectiveUserId}
        `);
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_applications (
          id, kind, user_id, organization_id, membership_id,
          requested_workspace, requested_role, status,
          correlation_id, idempotency_key, request_hash,
          legal_name, inn, kpp, ogrn, region, applicant_position,
          email, phone, terms_version, privacy_version,
          terms_content_hash, privacy_content_hash,
          terms_accepted_at, privacy_accepted_at,
          consent_ip_hash, consent_user_agent_hash,
          status_token_hash, expires_at
        ) VALUES (
          ${applicationId}, ${kind}, ${effectiveUserId}, ${organizationId}, ${effectiveMembershipId},
          ${normalized.workspace}, ${requestedRole}, 'EMAIL_VERIFICATION_REQUIRED',
          ${context.correlationId}, ${idempotencyKey}, ${requestHash},
          ${normalized.orgLegalName}, ${normalized.orgInn}, ${normalized.orgKpp}, ${normalized.orgOgrn},
          ${normalized.region}, ${normalized.position}, ${normalized.email}, ${normalized.phone},
          ${normalized.termsVersion}, ${normalized.privacyVersion},
          ${CURRENT_CONSENT_EVIDENCE.terms.contentHash}, ${CURRENT_CONSENT_EVIDENCE.privacy.contentHash},
          ${now}, ${now},
          ${hashClientValue(context.ip)}, ${hashClientValue(context.userAgent)},
          ${statusTokenHash}, ${applicationExpiresAt}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_email_challenges (
          id, application_id, user_id, token_hash, expires_at
        ) VALUES (
          ${emailToken.id}, ${applicationId}, ${effectiveUserId}, ${emailToken.hash}, ${emailExpiresAt}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_public_attempts (
          id, idempotency_key, request_hash, correlation_id, outcome, application_id
        ) VALUES (
          ${`reg_attempt_${randomUUID()}`}, ${idempotencyKey}, ${requestHash},
          ${context.correlationId}, 'APPLICATION_CREATED', ${applicationId}
        )
      `);
      await this.insertEvent(tx, {
        applicationId,
        actorUserId: effectiveUserId,
        actorKind: 'APPLICANT',
        previousStatus: null,
        newStatus: 'EMAIL_VERIFICATION_REQUIRED',
        reason: kind === 'NEW_ORGANIZATION' ? 'NEW_ORGANIZATION_SUBMITTED' : 'JOIN_REQUEST_SUBMITTED',
        correlationId: context.correlationId,
        idempotencyKey: `submit:${idempotencyKey}`,
        applicationVersion: 0n,
        metadata: {
          workspace: normalized.workspace,
          requestedRole,
          restarted: Boolean(reusableApplication),
          consent: CURRENT_CONSENT_EVIDENCE,
        },
      });
      await this.audit(tx, {
        userId: effectiveUserId,
        membershipId: effectiveMembershipId,
        organizationId,
        tenantId,
        action: 'auth.registration.submit',
        outcome: 'SUCCESS',
        reason: 'PUBLIC_REQUEST_ACCEPTED',
        metadata: { applicationId, correlationId: context.correlationId, consent: CURRENT_CONSENT_EVIDENCE },
      });

      return {
        existing: {
          id: applicationId,
          request_hash: requestHash,
          status: 'EMAIL_VERIFICATION_REQUIRED',
          correlation_id: context.correlationId,
          idempotency_key: idempotencyKey,
          outcome: 'APPLICATION_CREATED',
        } satisfies ExistingSubmissionRow,
        emailDelivery: deliveryAuthorized(context.deliveryKey)
          ? { email: normalized.email, token: emailToken.token, expiresInSeconds: Math.floor(REGISTRATION_EMAIL_TTL_MS / 1000) }
          : undefined,
      } as const;
    });

    return this.submissionResponse(result.existing, result.emailDelivery);
  }

  async verifyEmail(tokenInput: string, correlationId: string, deliveryKey?: string) {
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
          application.membership_id,
          application.kind AS application_kind,
          application.requested_workspace,
          application.email AS applicant_email,
          applicant."fullName" AS applicant_name
        FROM auth.registration_email_challenges challenge
        JOIN auth.registration_applications application
          ON application.id = challenge.application_id
        JOIN public.users applicant ON applicant.id = challenge.user_id
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
      const challengeUpdated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_email_challenges
        SET status = 'CONSUMED', consumed_at = ${now}, updated_at = NOW()
        WHERE id = ${challenge.id} AND status = 'PENDING'
      `);
      if (challengeUpdated !== 1) {
        throw new ConflictException({ code: 'REGISTRATION_VERSION_CONFLICT' });
      }
      const applicationUpdated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_applications
        SET status = 'ORGANIZATION_VERIFICATION_PENDING',
            email_verified_at = ${now},
            version = ${nextVersion},
            updated_at = NOW()
        WHERE id = ${challenge.application_id}
          AND status = 'EMAIL_VERIFICATION_REQUIRED'
          AND version = ${challenge.application_version}
      `);
      if (applicationUpdated !== 1) {
        throw new ConflictException({ code: 'REGISTRATION_VERSION_CONFLICT' });
      }
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

      const joinNotificationDelivery = challenge.application_kind === 'JOIN_EXISTING_ORGANIZATION'
        && deliveryAuthorized(deliveryKey)
        ? {
            recipients: (await tx.userOrg.findMany({
              where: {
                organizationId: challenge.organization_id,
                status: 'ACTIVE',
                isOrgAdmin: true,
                user: { status: 'ACTIVE', deletedAt: null },
              },
              select: { user: { select: { email: true } } },
              take: 20,
            })).map(({ user }) => user.email),
            applicantName: challenge.applicant_name,
            applicantEmail: challenge.applicant_email,
            requestedWorkspace: challenge.requested_workspace,
          }
        : undefined;

      return {
        ok: true,
        applicationId: challenge.application_id,
        status: 'ORGANIZATION_VERIFICATION_PENDING',
        nextAction: nextAction('ORGANIZATION_VERIFICATION_PENDING'),
        statusToken: deriveRegistrationStatusToken(challenge.application_id, challenge.idempotency_key),
        joinNotificationDelivery,
        correlationId,
      };
    });
  }

  async resendEmail(emailInput: string, correlationId: string, deliveryKey?: string) {
    const email = String(emailInput || '').trim().toLowerCase();
    const emailToken = issueRegistrationEmailToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REGISTRATION_EMAIL_TTL_MS);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockRegistrationKeys(tx, [`registration-email:${email}`]);
      const applications = await tx.$queryRaw<Array<{
        id: string;
        user_id: string;
        membership_id: string;
        organization_id: string;
        version: bigint;
        latest_challenge_at: Date | null;
      }>>(Prisma.sql`
        SELECT
          application.id,
          application.user_id,
          application.membership_id,
          application.organization_id,
          application.version,
          challenge.created_at AS latest_challenge_at
        FROM auth.registration_applications application
        LEFT JOIN LATERAL (
          SELECT created_at
          FROM auth.registration_email_challenges
          WHERE application_id = application.id
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        ) challenge ON TRUE
        WHERE application.email = ${email}
          AND application.status = 'EMAIL_VERIFICATION_REQUIRED'
          AND application.expires_at > NOW()
        ORDER BY application.created_at DESC
        LIMIT 1
        FOR UPDATE OF application
      `);
      const application = applications[0];
      if (!application) {
        await this.audit(tx, {
          action: 'auth.registration.email_resend',
          outcome: 'SUCCESS',
          reason: 'PUBLIC_REQUEST_ACCEPTED',
          metadata: { correlationId, accountHash: hashAuthMaterial(`account:${email}`) },
        });
        return { deliver: false as const };
      }
      if (application.latest_challenge_at && now.getTime() - application.latest_challenge_at.getTime() < 60_000) {
        return { deliver: false as const };
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_email_challenges
        SET status = 'REVOKED', updated_at = NOW()
        WHERE application_id = ${application.id} AND status = 'PENDING'
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_email_challenges (
          id, application_id, user_id, token_hash, expires_at
        ) VALUES (
          ${emailToken.id}, ${application.id}, ${application.user_id}, ${emailToken.hash}, ${expiresAt}
        )
      `);
      const nextVersion = application.version + 1n;
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_applications
        SET version = ${nextVersion}, updated_at = NOW()
        WHERE id = ${application.id}
          AND status = 'EMAIL_VERIFICATION_REQUIRED'
          AND version = ${application.version}
      `);
      if (updated !== 1) throw new ConflictException({ code: 'REGISTRATION_VERSION_CONFLICT' });
      await this.insertEvent(tx, {
        applicationId: application.id,
        actorUserId: application.user_id,
        actorKind: 'APPLICANT',
        previousStatus: 'EMAIL_VERIFICATION_REQUIRED',
        newStatus: 'EMAIL_VERIFICATION_REQUIRED',
        reason: 'EMAIL_VERIFICATION_RESENT',
        correlationId,
        idempotencyKey: `email-resend:${emailToken.id}`,
        applicationVersion: nextVersion,
      });
      await this.audit(tx, {
        userId: application.user_id,
        membershipId: application.membership_id,
        organizationId: application.organization_id,
        action: 'auth.registration.email_resend',
        outcome: 'SUCCESS',
        reason: 'EMAIL_VERIFICATION_RESENT',
        metadata: { applicationId: application.id, correlationId },
      });
      return { deliver: true as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });

    return {
      accepted: true,
      cooldownSeconds: 60,
      correlationId,
      emailDelivery: result.deliver && deliveryAuthorized(deliveryKey)
        ? { email, token: emailToken.token, expiresInSeconds: Math.floor(REGISTRATION_EMAIL_TTL_MS / 1000) }
        : undefined,
    };
  }

  async status(statusToken: string) {
    const normalizedToken = String(statusToken ?? '').trim();
    if (!normalizedToken.startsWith('rst_reg_') || normalizedToken.length > 512) {
      throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    }
    const tokenHash = hashRegistrationStatusToken(normalizedToken);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ApplicationStatusRow[]>(Prisma.sql`
        SELECT
          id, user_id, membership_id, organization_id, status, correlation_id,
          submitted_at, updated_at, expires_at, decision_reason, version
        FROM auth.registration_applications
        WHERE status_token_hash = ${tokenHash}
        LIMIT 1
        FOR UPDATE
      `);
      const application = rows[0];
      if (!application) throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });

      if (application.expires_at <= new Date() && !TERMINAL_STATUSES.has(application.status)) {
        application.version = await this.expireApplication(tx, application, application.correlation_id);
        application.status = 'EXPIRED';
        application.updated_at = new Date();
      }
      return {
        applicationId: application.id,
        status: application.status,
        nextAction: nextAction(application.status),
        submittedAt: application.submitted_at.toISOString(),
        updatedAt: application.updated_at.toISOString(),
        reason: ['REJECTED', 'SUSPENDED', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(application.status)
          ? application.decision_reason
          : null,
        version: application.version.toString(),
        correlationId: application.correlation_id,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
  }

  async provideAdditionalInformation(statusTokenInput: string, responseInput: string, correlationId: string) {
    const statusToken = String(statusTokenInput || '').trim();
    const response = String(responseInput || '').trim();
    if (!statusToken.startsWith('rst_reg_') || statusToken.length > 512 || response.length < 8 || response.length > 4000) {
      throw new BadRequestException({ code: 'REGISTRATION_INFORMATION_INVALID' });
    }
    const tokenHash = hashRegistrationStatusToken(statusToken);

    return this.prisma.$transaction(async (tx) => {
      const applications = await tx.$queryRaw<Array<{
        id: string;
        user_id: string;
        membership_id: string;
        organization_id: string;
        status: string;
        version: bigint;
        expires_at: Date;
      }>>(Prisma.sql`
        SELECT id, user_id, membership_id, organization_id, status, version, expires_at
        FROM auth.registration_applications
        WHERE status_token_hash = ${tokenHash}
        FOR UPDATE
      `);
      const application = applications[0];
      if (
        !application
        || application.status !== 'ADDITIONAL_INFORMATION_REQUIRED'
        || application.expires_at <= new Date()
      ) {
        throw new BadRequestException({ code: 'REGISTRATION_INFORMATION_INVALID' });
      }

      const nextVersion = application.version + 1n;
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_applications
        SET status = 'ORGANIZATION_VERIFICATION_PENDING',
            version = ${nextVersion},
            updated_at = NOW()
        WHERE id = ${application.id}
          AND status = 'ADDITIONAL_INFORMATION_REQUIRED'
          AND version = ${application.version}
      `);
      if (updated !== 1) throw new ConflictException({ code: 'REGISTRATION_VERSION_CONFLICT' });

      await this.insertEvent(tx, {
        applicationId: application.id,
        actorUserId: application.user_id,
        actorKind: 'APPLICANT',
        previousStatus: 'ADDITIONAL_INFORMATION_REQUIRED',
        newStatus: 'ORGANIZATION_VERIFICATION_PENDING',
        reason: 'APPLICANT_INFORMATION_PROVIDED',
        correlationId,
        idempotencyKey: `additional-information:${application.id}:${nextVersion}`,
        applicationVersion: nextVersion,
        metadata: { response },
      });
      await this.audit(tx, {
        userId: application.user_id,
        membershipId: application.membership_id,
        organizationId: application.organization_id,
        action: 'auth.registration.additional_information',
        outcome: 'SUCCESS',
        reason: 'APPLICANT_INFORMATION_PROVIDED',
        metadata: { applicationId: application.id, correlationId, responseHash: sha256(response) },
      });

      return {
        ok: true,
        applicationId: application.id,
        status: 'ORGANIZATION_VERIFICATION_PENDING',
        nextAction: nextAction('ORGANIZATION_VERIFICATION_PENDING'),
        version: nextVersion.toString(),
        correlationId,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
  }


  private async lockRegistrationKeys(client: AuthSqlClient, keys: string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await client.$queryRaw<Array<{ acquired: number }>>(Prisma.sql`
        SELECT 1::int AS acquired
        FROM (
          SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
        ) AS registration_lock
      `);
    }
  }

  private async expireApplication(
    tx: AuthSqlClient,
    application: Pick<PreviousApplicationRow, 'id' | 'user_id' | 'membership_id' | 'organization_id' | 'status' | 'version'>,
    correlationId: string,
  ): Promise<bigint> {
    if (TERMINAL_STATUSES.has(application.status)) return application.version;
    const nextVersion = application.version + 1n;
    const updated = await tx.$executeRaw(Prisma.sql`
      UPDATE auth.registration_applications
      SET status = 'EXPIRED',
          version = ${nextVersion},
          updated_at = NOW()
      WHERE id = ${application.id}
        AND status = ${application.status}
        AND version = ${application.version}
        AND expires_at <= NOW()
    `);
    if (updated !== 1) throw new ConflictException({ code: 'REGISTRATION_VERSION_CONFLICT' });
    await tx.$executeRaw(Prisma.sql`
      UPDATE auth.registration_email_challenges
      SET status = 'EXPIRED', updated_at = NOW()
      WHERE application_id = ${application.id} AND status = 'PENDING'
    `);
    await this.insertEvent(tx, {
      applicationId: application.id,
      actorKind: 'SYSTEM',
      previousStatus: application.status,
      newStatus: 'EXPIRED',
      reason: 'APPLICATION_TTL_EXPIRED',
      correlationId,
      idempotencyKey: `expired:${application.id}:${nextVersion}`,
      applicationVersion: nextVersion,
    });
    await this.audit(tx, {
      userId: application.user_id,
      membershipId: application.membership_id,
      organizationId: application.organization_id,
      action: 'auth.registration.expired',
      outcome: 'SUCCESS',
      reason: 'APPLICATION_TTL_EXPIRED',
      metadata: { applicationId: application.id, correlationId },
    });
    return nextVersion;
  }

  private async findByIdempotency(
    idempotencyKey: string,
    client: AuthSqlClient = this.prisma,
  ): Promise<ExistingSubmissionRow | null> {
    const rows = await client.$queryRaw<ExistingSubmissionRow[]>(Prisma.sql`
      SELECT
        application.id,
        attempt.request_hash,
        COALESCE(application.status, 'EMAIL_VERIFICATION_REQUIRED') AS status,
        attempt.correlation_id,
        attempt.idempotency_key,
        attempt.outcome
      FROM auth.registration_public_attempts attempt
      LEFT JOIN auth.registration_applications application
        ON application.id = attempt.application_id
      WHERE attempt.idempotency_key = ${idempotencyKey}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private submissionResponse(
    submission: ExistingSubmissionRow,
    emailDelivery?: { email: string; token: string; expiresInSeconds: number },
  ) {
    const publicResponse = {
      accepted: true,
      status: 'EMAIL_VERIFICATION_REQUIRED',
      nextAction: 'VERIFY_EMAIL',
      correlationId: submission.correlation_id,
    };
    if (!emailDelivery || submission.outcome !== 'APPLICATION_CREATED' || !submission.id) {
      return publicResponse;
    }
    return {
      ...publicResponse,
      applicationId: submission.id,
      statusToken: deriveRegistrationStatusToken(submission.id, submission.idempotency_key),
      emailDelivery,
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
    const prevHash = await this.authRepository.latestAuditHash(tx, input.userId);
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
