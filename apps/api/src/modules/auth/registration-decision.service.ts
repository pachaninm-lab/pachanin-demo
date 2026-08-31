import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID, timingSafeEqual } from 'crypto';
import type { RequestUser, Role } from '../../common/types/request-user';
import { AuthMailOutboxService } from '../auth-mail/auth-mail-outbox.service';
import { registrationDecisionMail } from '../auth-mail/auth-mail-templates';
import { AuthPrismaService } from './auth-prisma.service';
import { sha256, stableJson } from './auth-crypto';
import { PUBLIC_WORKSPACE_CLASSES, type PublicWorkspaceClass } from './dto/register.dto';
import type { AuthSqlClient } from './persistent-auth.repository';
import { PersistentAuthRepository } from './persistent-auth.repository';
import { roleForWorkspace } from './registration-application.service';
import {
  canAssignOrganizationRole,
  isOrganizationHumanRole,
  type OrganizationHumanRole,
} from './organization-role-policy';

export type RegistrationDecision = 'APPROVE' | 'REJECT' | 'REQUEST_INFORMATION' | 'SUSPEND';
type DecisionActorKind = 'ORGANIZATION_ADMIN' | 'PLATFORM_REVIEWER';
const REVIEW_MFA_FRESHNESS_MS = 15 * 60 * 1000;
const PLATFORM_REVIEWER_ROLES = new Set(['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF']);
const REGISTRATION_DECISION_MAIL_TTL_MS = 24 * 60 * 60 * 1000;
const REGISTRATION_DECISION_DELIVERY_TIMEOUT_MS = 50_000;

type RegistrationDecisionResponse = {
  applicationId: string;
  status: string;
  nextAction: 'LOGIN' | 'WAIT';
  version: string;
  correlationId: string;
  replayed: boolean;
  notificationDelivery?: { status: 'SENT' };
};

type RegistrationDecisionTransactionResult = {
  response: RegistrationDecisionResponse;
  mailIdempotencyKey: string;
};

function deliveryAuthorized(provided?: string): boolean {
  const expected = Buffer.from(String(process.env.REGISTRATION_DELIVERY_KEY || '').trim(), 'utf8');
  const candidate = Buffer.from(String(provided || '').trim(), 'utf8');
  return expected.length >= 32 && candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

type LockedApplication = {
  id: string;
  kind: 'NEW_ORGANIZATION' | 'JOIN_EXISTING_ORGANIZATION';
  user_id: string;
  organization_id: string;
  membership_id: string;
  requested_workspace: string;
  requested_role: Role;
  status: string;
  version: bigint;
  correlation_id: string;
  organization_status: string;
  tenant_id: string;
};

type OrganizationAdmin = {
  membershipId: string;
  organizationId: string;
  tenantId: string;
  role: OrganizationHumanRole;
};

@Injectable()
export class RegistrationDecisionService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly authRepository: PersistentAuthRepository,
    private readonly mailOutbox: AuthMailOutboxService,
  ) {}

  async listPlatformReviewQueue(reviewer: RequestUser) {
    this.requireFreshMfa(reviewer);
    this.requirePlatformReviewer(reviewer);
    const sessionId = this.requireActorSession(reviewer);
    const applications = await this.prisma.$queryRaw<Array<{
      id: string;
      kind: string;
      status: string;
      requested_workspace: string;
      requested_role: string;
      legal_name: string;
      inn: string;
      kpp: string | null;
      ogrn: string | null;
      region: string;
      applicant_position: string;
      email: string;
      phone: string;
      submitted_at: Date;
      updated_at: Date;
      version: bigint;
      correlation_id: string;
      organization_id: string;
      organization_status: string;
      organization_name: string;
      organization_kyc_status: string;
      organization_aml_status: string;
      organization_sanction_hit: boolean;
      user_id: string;
      applicant_name: string;
      email_verified_at: Date | null;
      duplicate_organization_count: number;
      duplicate_email_application_count: number;
    }>>(Prisma.sql`
      SELECT *
      FROM auth.registration_platform_review_queue(${reviewer.id}, ${sessionId}, 100)
    `);
    if (applications.length === 0) return { applications: [] };
    const events = await this.prisma.$queryRaw<Array<{
      application_id: string;
      actor_kind: string;
      previous_status: string | null;
      new_status: string;
      reason: string;
      correlation_id: string;
      application_version: bigint;
      metadata: unknown;
      created_at: Date;
    }>>(Prisma.sql`
      SELECT
        application_id, actor_kind, previous_status, new_status, reason,
        correlation_id, application_version, metadata, created_at
      FROM auth.registration_application_events
      WHERE application_id IN (${Prisma.join(applications.map(({ id }) => id))})
      ORDER BY created_at ASC, id ASC
    `);
    const historyByApplication = new Map<string, typeof events>();
    for (const event of events) {
      const history = historyByApplication.get(event.application_id) ?? [];
      history.push(event);
      historyByApplication.set(event.application_id, history);
    }
    return {
      applications: applications.map((application) => this.queueItem(
        application,
        historyByApplication.get(application.id) ?? [],
      )),
    };
  }

  async listOrganizationJoinRequests(reviewer: RequestUser) {
    const administrator = await this.requireOrganizationAdmin(reviewer);
    const sessionId = this.requireActorSession(reviewer);
    const applications = await this.prisma.$queryRaw<Array<{
      id: string;
      status: string;
      requested_workspace: string;
      requested_role: string;
      applicant_position: string;
      email: string;
      phone: string;
      submitted_at: Date;
      updated_at: Date;
      version: bigint;
      correlation_id: string;
      user_id: string;
      applicant_name: string;
    }>>(Prisma.sql`
      SELECT *
      FROM auth.registration_organization_join_queue(
        ${reviewer.id}, ${sessionId}, ${administrator.membershipId},
        ${administrator.organizationId}, ${administrator.tenantId}, 100
      )
    `);
    return {
      organizationId: administrator.organizationId,
      applications: applications.map((application) => ({
        applicationId: application.id,
        status: application.status,
        requestedWorkspace: application.requested_workspace,
        requestedRole: application.requested_role,
        applicant: {
          userId: application.user_id,
          fullName: application.applicant_name,
          email: application.email,
          phone: application.phone,
          position: application.applicant_position,
        },
        submittedAt: application.submitted_at.toISOString(),
        updatedAt: application.updated_at.toISOString(),
        version: application.version.toString(),
        correlationId: application.correlation_id,
      })),
    };
  }

  async decideOrganizationJoin(
    applicationId: string,
    decision: 'APPROVE' | 'REJECT',
    reasonInput: string,
    reviewer: RequestUser,
    idempotencyKeyInput: string,
    correlationId: string,
    deliveryKey?: string,
  ) {
    const { reason, idempotencyKey } = this.validateDecisionInput(reasonInput, idempotencyKeyInput);
    const outcome = await this.prisma.$transaction(async (tx): Promise<RegistrationDecisionTransactionResult> => {
      const administrator = await this.requireOrganizationAdmin(reviewer, tx);
      const eventKey = `org-join-decision:${idempotencyKey}`;
      const existing = await tx.$queryRaw<Array<{ application_id: string; new_status: string }>>(Prisma.sql`
        SELECT event.application_id, event.new_status
        FROM auth.registration_application_events event
        JOIN auth.registration_applications application ON application.id = event.application_id
        WHERE event.idempotency_key = ${eventKey}
          AND application.organization_id = ${administrator.organizationId}
        LIMIT 1
      `);
      if (existing[0]) {
        if (existing[0].application_id !== applicationId) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_TARGET' });
        }
        const mailIdempotencyKey = await this.queueRegistrationDecisionNotification(
          tx, applicationId, eventKey, correlationId,
        );
        return {
          response: await this.readResult(tx, applicationId, true),
          mailIdempotencyKey,
        };
      }

      const application = await this.lockApplication(
        tx,
        applicationId,
        reviewer,
        'ORGANIZATION_ADMIN',
        administrator,
      );
      if (
        application.kind !== 'JOIN_EXISTING_ORGANIZATION'
        || application.organization_id !== administrator.organizationId
        || application.tenant_id !== administrator.tenantId
      ) {
        throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
      }
      if (application.user_id === reviewer.id) {
        throw new ForbiddenException({ code: 'SELF_APPROVAL_FORBIDDEN' });
      }
      if (!['ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(application.status)) {
        throw new ConflictException({ code: 'REGISTRATION_STATE_CONFLICT', status: application.status });
      }
      if (!isOrganizationHumanRole(application.requested_role)
        || !canAssignOrganizationRole(administrator.role, application.requested_role)) {
        throw new ForbiddenException({ code: 'ROLE_PERMISSION_CEILING_EXCEEDED' });
      }

      if (decision === 'APPROVE') {
        await this.approve(
          tx,
          application,
          reviewer,
          reason,
          idempotencyKey,
          correlationId,
          'ORGANIZATION_ADMIN',
          eventKey,
          administrator,
        );
      } else {
        await this.nonApprovalDecision(
          tx,
          application,
          reviewer,
          'REJECT',
          reason,
          eventKey,
          correlationId,
          'ORGANIZATION_ADMIN',
          administrator,
        );
      }
      await this.audit(tx, {
        userId: reviewer.id,
        membershipId: reviewer.membershipId,
        organizationId: administrator.organizationId,
        tenantId: administrator.tenantId,
        action: 'auth.organization.join_request.decision',
        outcome: 'SUCCESS',
        reason: decision,
        metadata: { applicationId, decisionReason: reason, correlationId },
      });
      if (decision === 'APPROVE') {
        await this.emitRegistrationLifecycleReceipt(tx, applicationId, correlationId);
      }
      const mailIdempotencyKey = await this.queueRegistrationDecisionNotification(
        tx, applicationId, eventKey, correlationId,
      );
      return {
        response: await this.readResult(tx, applicationId),
        mailIdempotencyKey,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
    return this.completeDecisionResponse(outcome, deliveryKey);
  }

  async decide(
    applicationId: string,
    decision: RegistrationDecision,
    reasonInput: string,
    reviewer: RequestUser,
    idempotencyKeyInput: string,
    correlationId: string,
    deliveryKey?: string,
  ) {
    const { reason, idempotencyKey } = this.validateDecisionInput(reasonInput, idempotencyKeyInput);
    this.requireFreshMfa(reviewer);
    this.requirePlatformReviewer(reviewer);

    const outcome = await this.prisma.$transaction(async (tx): Promise<RegistrationDecisionTransactionResult> => {
      await this.requirePlatformDecisionAuthority(reviewer, tx);
      const eventKey = `decision:${idempotencyKey}`;
      const existing = await tx.$queryRaw<Array<{ application_id: string }>>(Prisma.sql`
        SELECT application_id
        FROM auth.registration_application_events
        WHERE idempotency_key = ${eventKey}
        LIMIT 1
      `);
      if (existing[0]) {
        if (existing[0].application_id !== applicationId) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_TARGET' });
        }
        const mailIdempotencyKey = await this.queueRegistrationDecisionNotification(
          tx, applicationId, eventKey, correlationId,
        );
        return {
          response: await this.readResult(tx, applicationId, true),
          mailIdempotencyKey,
        };
      }

      const application = await this.lockApplication(
        tx,
        applicationId,
        reviewer,
        'PLATFORM_REVIEWER',
      );
      if (application.kind !== 'NEW_ORGANIZATION') {
        throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_DECISION_REQUIRED' });
      }
      if (application.user_id === reviewer.id) {
        throw new ForbiddenException({ code: 'SELF_APPROVAL_FORBIDDEN' });
      }
      if (!['ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED', 'SUSPENDED'].includes(application.status)) {
        throw new ConflictException({ code: 'REGISTRATION_STATE_CONFLICT', status: application.status });
      }

      if (decision === 'APPROVE') {
        await this.approve(tx, application, reviewer, reason, idempotencyKey, correlationId, 'PLATFORM_REVIEWER');
      } else {
        await this.nonApprovalDecision(
          tx,
          application,
          reviewer,
          decision,
          reason,
          eventKey,
          correlationId,
          'PLATFORM_REVIEWER',
        );
      }

      await this.audit(tx, {
        userId: reviewer.id,
        membershipId: reviewer.membershipId,
        organizationId: reviewer.orgId,
        tenantId: reviewer.tenantId,
        action: 'auth.registration.decision',
        outcome: 'SUCCESS',
        reason: decision,
        metadata: {
          applicationId: application.id,
          decisionReason: reason,
          correlationId,
        },
      });
      if (decision === 'APPROVE') {
        await this.emitRegistrationLifecycleReceipt(tx, application.id, correlationId);
      }
      const mailIdempotencyKey = await this.queueRegistrationDecisionNotification(
        tx, application.id, eventKey, correlationId,
      );
      return {
        response: await this.readResult(tx, application.id),
        mailIdempotencyKey,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
    return this.completeDecisionResponse(outcome, deliveryKey);
  }

  private async approve(
    tx: Prisma.TransactionClient,
    application: LockedApplication,
    reviewer: RequestUser,
    reason: string,
    idempotencyKey: string,
    correlationId: string,
    actorKind: DecisionActorKind,
    finalEventKey = `decision:${idempotencyKey}`,
    administrator?: OrganizationAdmin,
  ) {
    const workspace = application.requested_workspace as PublicWorkspaceClass;
    if (
      !PUBLIC_WORKSPACE_CLASSES.includes(workspace)
      || !isOrganizationHumanRole(application.requested_role)
      || roleForWorkspace(workspace) !== application.requested_role
    ) {
      throw new ForbiddenException({ code: 'REGISTRATION_ROLE_MAPPING_INVALID' });
    }
    if (
      application.kind === 'JOIN_EXISTING_ORGANIZATION'
      && application.organization_status !== 'VERIFIED'
    ) {
      throw new ConflictException({
        code: 'ORGANIZATION_NOT_ELIGIBLE_FOR_JOIN',
        status: application.organization_status,
      });
    }

    const approvedVersion = application.version + 1n;
    const activatedVersion = approvedVersion + 1n;
    const updated = await tx.$executeRaw(Prisma.sql`
      UPDATE auth.registration_applications
      SET status = 'ACTIVATED',
          decided_at = NOW(),
          decision_reason = ${reason},
          decision_actor_user_id = ${reviewer.id},
          version = ${activatedVersion},
          updated_at = NOW()
      WHERE id = ${application.id}
        AND version = ${application.version}
        AND status = ${application.status}
    `);
    if (updated !== 1) {
      throw new ConflictException({ code: 'REGISTRATION_VERSION_CONFLICT' });
    }

    await this.applyIdentityTransition(
      tx,
      application,
      reviewer,
      actorKind,
      'APPROVE',
      administrator,
    );

    await this.insertEvent(tx, {
      applicationId: application.id,
      actorUserId: reviewer.id,
      actorKind,
      previousStatus: application.status,
      newStatus: 'APPROVED',
      reason,
      correlationId,
      idempotencyKey: actorKind === 'ORGANIZATION_ADMIN'
        ? `${finalEventKey}:approved`
        : `decision-approved:${idempotencyKey}`,
      applicationVersion: approvedVersion,
    });
    await this.insertEvent(tx, {
      applicationId: application.id,
      actorUserId: reviewer.id,
      actorKind: 'SYSTEM',
      previousStatus: 'APPROVED',
      newStatus: 'ACTIVATED',
      reason: 'IDENTITY_ORGANIZATION_AND_MEMBERSHIP_ACTIVATED',
      correlationId,
      idempotencyKey: finalEventKey,
      applicationVersion: activatedVersion,
    });
  }

  private async nonApprovalDecision(
    tx: Prisma.TransactionClient,
    application: LockedApplication,
    reviewer: RequestUser,
    decision: Exclude<RegistrationDecision, 'APPROVE'>,
    reason: string,
    eventKey: string,
    correlationId: string,
    actorKind: DecisionActorKind,
    administrator?: OrganizationAdmin,
  ) {
    const targetStatus = decision === 'REJECT'
      ? 'REJECTED'
      : decision === 'REQUEST_INFORMATION'
        ? 'ADDITIONAL_INFORMATION_REQUIRED'
        : 'SUSPENDED';
    const nextVersion = application.version + 1n;
    const updated = await tx.$executeRaw(Prisma.sql`
      UPDATE auth.registration_applications
      SET status = ${targetStatus},
          decided_at = NOW(),
          decision_reason = ${reason},
          decision_actor_user_id = ${reviewer.id},
          version = ${nextVersion},
          updated_at = NOW()
      WHERE id = ${application.id}
        AND version = ${application.version}
        AND status = ${application.status}
    `);
    if (updated !== 1) {
      throw new ConflictException({ code: 'REGISTRATION_VERSION_CONFLICT' });
    }

    if (targetStatus === 'REJECTED' || targetStatus === 'SUSPENDED') {
      await this.applyIdentityTransition(
        tx,
        application,
        reviewer,
        actorKind,
        targetStatus === 'REJECTED' ? 'REJECT' : 'SUSPEND',
        administrator,
      );
      if (targetStatus === 'SUSPENDED' && application.kind === 'NEW_ORGANIZATION') {
        await this.authRepository.revokeAllUserSessions(tx, application.user_id, 'REGISTRATION_SUSPENDED');
      }
    }

    await this.insertEvent(tx, {
      applicationId: application.id,
      actorUserId: reviewer.id,
      actorKind,
      previousStatus: application.status,
      newStatus: targetStatus,
      reason,
      correlationId,
      idempotencyKey: eventKey,
      applicationVersion: nextVersion,
    });
  }

  private validateDecisionInput(reasonInput: string, idempotencyKeyInput: string) {
    const reason = String(reasonInput ?? '').trim();
    const idempotencyKey = String(idempotencyKeyInput ?? '').trim();
    if (reason.length < 8 || reason.length > 1000) {
      throw new BadRequestException({ code: 'DECISION_REASON_REQUIRED' });
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return { reason, idempotencyKey };
  }

  private requireFreshMfa(reviewer: RequestUser) {
    const verifiedAt = Date.parse(String(reviewer.mfaVerifiedAt || ''));
    if (
      !reviewer.mfaVerified
      || !Number.isFinite(verifiedAt)
      || Date.now() - verifiedAt > REVIEW_MFA_FRESHNESS_MS
      || verifiedAt > Date.now() + 30_000
    ) {
      throw new ForbiddenException({ code: 'FRESH_MFA_REQUIRED' });
    }
  }

  private requirePlatformReviewer(reviewer: RequestUser) {
    if (!reviewer.staffRoles?.some((role) => PLATFORM_REVIEWER_ROLES.has(role))) {
      throw new ForbiddenException({ code: 'PLATFORM_REVIEWER_REQUIRED' });
    }
  }

  private requireActorSession(reviewer: RequestUser): string {
    const sessionId = String(reviewer.sessionId || '').trim();
    if (!sessionId) {
      throw new ForbiddenException({ code: 'ACTIVE_SESSION_REQUIRED' });
    }
    return sessionId;
  }

  private async requirePlatformDecisionAuthority(
    reviewer: RequestUser,
    client: AuthSqlClient = this.prisma,
  ): Promise<void> {
    const sessionId = this.requireActorSession(reviewer);
    const rows = await client.$queryRaw<Array<{ authorized: boolean }>>(Prisma.sql`
      SELECT auth.registration_platform_actor_authorized(
        ${reviewer.id}, ${sessionId}
      ) AS authorized
    `);
    if (!rows[0]?.authorized) {
      throw new ForbiddenException({ code: 'PLATFORM_REVIEWER_REQUIRED' });
    }
  }

  private async requireOrganizationAdmin(
    reviewer: RequestUser,
    client: AuthSqlClient = this.prisma,
  ): Promise<OrganizationAdmin> {
    this.requireFreshMfa(reviewer);
    const membershipId = String(reviewer.membershipId || '').trim();
    const organizationId = String(reviewer.orgId || '').trim();
    const tenantId = String(reviewer.tenantId || '').trim();
    const sessionId = this.requireActorSession(reviewer);
    if (!reviewer.id || !membershipId || !organizationId || !tenantId || !reviewer.isOrgAdmin) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    const rows = await client.$queryRaw<Array<{
      membership_id: string;
      organization_id: string;
      tenant_id: string;
      administrator_role: string;
    }>>(Prisma.sql`
      SELECT *
      FROM auth.registration_organization_admin_context(
        ${reviewer.id}, ${sessionId}, ${membershipId}, ${organizationId}, ${tenantId}
      )
    `);
    const context = rows[0];
    if (!context || !isOrganizationHumanRole(context.administrator_role)) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    return {
      membershipId: context.membership_id,
      organizationId: context.organization_id,
      tenantId: context.tenant_id,
      role: context.administrator_role,
    };
  }

  private async lockApplication(
    tx: Prisma.TransactionClient,
    applicationId: string,
    reviewer: RequestUser,
    actorKind: DecisionActorKind,
    administrator?: OrganizationAdmin,
  ): Promise<LockedApplication> {
    const sessionId = this.requireActorSession(reviewer);
    const rows = await tx.$queryRaw<LockedApplication[]>(Prisma.sql`
      SELECT *
      FROM auth.lock_registration_decision_application(
        ${actorKind}, ${reviewer.id}, ${sessionId},
        ${administrator?.membershipId ?? null}, ${administrator?.organizationId ?? null},
        ${administrator?.tenantId ?? null}, ${applicationId}
      )
    `);
    if (!rows[0]) throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    return rows[0];
  }

  private async applyIdentityTransition(
    tx: Prisma.TransactionClient,
    application: LockedApplication,
    reviewer: RequestUser,
    actorKind: DecisionActorKind,
    transition: 'APPROVE' | 'REJECT' | 'SUSPEND',
    administrator?: OrganizationAdmin,
  ) {
    const sessionId = this.requireActorSession(reviewer);
    const rows = await tx.$queryRaw<Array<{ applied: boolean }>>(Prisma.sql`
      SELECT *
      FROM auth.apply_registration_identity_transition(
        ${actorKind}, ${reviewer.id}, ${sessionId},
        ${administrator?.membershipId ?? null}, ${administrator?.organizationId ?? null},
        ${administrator?.tenantId ?? null}, ${application.id}, ${transition}
      )
    `);
    if (!rows[0]?.applied) {
      throw new ConflictException({ code: 'REGISTRATION_IDENTITY_TRANSITION_CONFLICT' });
    }
  }

  private queueItem(application: {
    id: string;
    kind: string;
    status: string;
    requested_workspace: string;
    requested_role: string;
    legal_name: string;
    inn: string;
    kpp: string | null;
    ogrn: string | null;
    region: string;
    applicant_position: string;
    email: string;
    phone: string;
    submitted_at: Date;
    updated_at: Date;
    version: bigint;
    correlation_id: string;
    organization_id: string;
    organization_status: string;
    organization_name: string;
    organization_kyc_status: string;
    organization_aml_status: string;
    organization_sanction_hit: boolean;
    user_id: string;
    applicant_name: string;
    email_verified_at: Date | null;
    duplicate_organization_count: number;
    duplicate_email_application_count: number;
  }, history: Array<{
    actor_kind: string;
    previous_status: string | null;
    new_status: string;
    reason: string;
    correlation_id: string;
    application_version: bigint;
    metadata: unknown;
    created_at: Date;
  }>) {
    const riskFlags = [
      application.organization_sanction_hit ? 'SANCTION_HIT' : null,
      application.organization_aml_status !== 'CLEAR' ? `AML_${application.organization_aml_status}` : null,
      application.duplicate_organization_count > 0 ? 'DUPLICATE_INN' : null,
      application.duplicate_email_application_count > 0 ? 'REPEATED_APPLICANT_EMAIL' : null,
    ].filter((flag): flag is string => Boolean(flag));
    return {
      applicationId: application.id,
      kind: application.kind,
      status: application.status,
      requestedWorkspace: application.requested_workspace,
      requestedRole: application.requested_role,
      organization: {
        organizationId: application.organization_id,
        name: application.organization_name,
        legalName: application.legal_name,
        status: application.organization_status,
        inn: application.inn,
        kpp: application.kpp,
        ogrn: application.ogrn,
        region: application.region,
      },
      applicant: {
        userId: application.user_id,
        fullName: application.applicant_name,
        position: application.applicant_position,
        email: application.email,
        phone: application.phone,
      },
      checks: {
        emailVerified: Boolean(application.email_verified_at),
        kycStatus: application.organization_kyc_status,
        amlStatus: application.organization_aml_status,
        sanctionHit: application.organization_sanction_hit,
      },
      duplicateSignals: {
        organizationsWithSameInn: application.duplicate_organization_count,
        applicationsWithSameEmail: application.duplicate_email_application_count,
      },
      riskFlags,
      history: history.map((event) => ({
        actorKind: event.actor_kind,
        previousStatus: event.previous_status,
        newStatus: event.new_status,
        reason: event.reason,
        correlationId: event.correlation_id,
        applicationVersion: event.application_version.toString(),
        metadata: event.metadata,
        createdAt: event.created_at.toISOString(),
      })),
      submittedAt: application.submitted_at.toISOString(),
      updatedAt: application.updated_at.toISOString(),
      version: application.version.toString(),
      correlationId: application.correlation_id,
    };
  }

  private async queueRegistrationDecisionNotification(
    client: AuthSqlClient,
    applicationId: string,
    eventKey: string,
    correlationId: string,
  ): Promise<string> {
    const rows = await client.$queryRaw<Array<{
      email: string;
      status: string;
      decision_reason: string | null;
    }>>(Prisma.sql`
      SELECT email, status, decision_reason
      FROM auth.registration_applications
      WHERE id = ${applicationId}
      LIMIT 1
    `);
    const application = rows[0];
    if (!application?.email) {
      throw new ConflictException({ code: 'REGISTRATION_DECISION_NOTIFICATION_TARGET_MISSING' });
    }
    const mailIdempotencyKey = `auth-mail:registration-decision:${sha256(`${applicationId}${eventKey}`)}`;
    const current = await this.mailOutbox.registrationDecisionStatus(client, mailIdempotencyKey);
    if (current.status === 'MISSING') {
      await this.mailOutbox.enqueue(client, {
        kind: 'REGISTRATION_DECISION',
        idempotencyKey: mailIdempotencyKey,
        correlationId,
        envelope: registrationDecisionMail({
          to: application.email,
          status: application.status,
          reason: application.decision_reason,
        }),
        expiresAt: new Date(Date.now() + REGISTRATION_DECISION_MAIL_TTL_MS),
        maxAttempts: 12,
      });
    }
    return mailIdempotencyKey;
  }

  private async completeDecisionResponse(
    outcome: RegistrationDecisionTransactionResult,
    deliveryKey?: string,
  ): Promise<RegistrationDecisionResponse> {
    if (!deliveryAuthorized(deliveryKey)) return outcome.response;
    const delivery = await this.mailOutbox.waitForRegistrationDecisionDelivery(
      this.prisma,
      outcome.mailIdempotencyKey,
      { timeoutMs: REGISTRATION_DECISION_DELIVERY_TIMEOUT_MS, pollMs: 250 },
    );
    if (delivery.status !== 'SENT') {
      throw new ServiceUnavailableException({
        code: delivery.status === 'DEAD_LETTER'
          ? 'REGISTRATION_DECISION_NOTIFICATION_FAILED'
          : 'REGISTRATION_DECISION_NOTIFICATION_PENDING',
        applicationId: outcome.response.applicationId,
        status: outcome.response.status,
        nextAction: outcome.response.nextAction,
        replayed: outcome.response.replayed,
        correlationId: outcome.response.correlationId,
        retryAfterSeconds: 2,
      });
    }
    return outcome.response.replayed
      ? outcome.response
      : { ...outcome.response, notificationDelivery: { status: 'SENT' } };
  }

  private async readResult(
    client: AuthSqlClient,
    applicationId: string,
    replayed = false,
  ): Promise<RegistrationDecisionResponse> {
    const rows = await client.$queryRaw<Array<{
      id: string;
      status: string;
      version: bigint;
      correlation_id: string;
    }>>(Prisma.sql`
      SELECT id, status, version, correlation_id
      FROM auth.registration_applications
      WHERE id = ${applicationId}
      LIMIT 1
    `);
    const application = rows[0];
    if (!application) {
      throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    }
    return {
      applicationId: application.id,
      status: application.status,
      nextAction: application.status === 'ACTIVATED' ? 'LOGIN' : 'WAIT',
      version: application.version.toString(),
      correlationId: application.correlation_id,
      replayed,
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
    },
  ) {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.registration_application_events (
        id, application_id, actor_user_id, actor_kind,
        previous_status, new_status, reason, correlation_id,
        idempotency_key, application_version
      ) VALUES (
        ${`reg_evt_${randomUUID()}`}, ${input.applicationId}, ${input.actorUserId ?? null}, ${input.actorKind},
        ${input.previousStatus}, ${input.newStatus}, ${input.reason}, ${input.correlationId},
        ${input.idempotencyKey}, ${input.applicationVersion}
      )
    `);
  }

  private async emitRegistrationLifecycleReceipt(
    client: AuthSqlClient,
    applicationId: string,
    correlationId: string,
  ): Promise<void> {
    const rows = await client.$queryRaw<Array<{
      outbox_id: string;
      idempotency_key: string;
      correlation_id: string;
    }>>(Prisma.sql`
      SELECT outbox_id, idempotency_key, correlation_id
      FROM auth.emit_registration_lifecycle_receipt(
        ${applicationId},
        ${correlationId}
      )
    `);
    if (!rows[0]?.outbox_id) {
      throw new ConflictException({ code: 'REGISTRATION_LIFECYCLE_RECEIPT_MISSING' });
    }
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
    const { chainKey, prevHash, nextSequence } = await this.authRepository.latestAuditChainPosition(
      tx,
      input.userId,
      null,
    );
    const hash = sha256(stableJson({
      id, ...input, prevHash, chainKey, chainSequence: nextSequence.toString(),
    }));
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
      chainSequence: nextSequence,
    });
  }
}
