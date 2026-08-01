import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID, timingSafeEqual } from 'crypto';
import type { RequestUser, Role } from '../../common/types/request-user';
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
  ) {}

  async listPlatformReviewQueue(reviewer: RequestUser) {
    this.requireFreshMfa(reviewer);
    this.requirePlatformReviewer(reviewer);
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
      SELECT
        application.id, application.kind, application.status,
        application.requested_workspace, application.requested_role,
        application.legal_name, application.inn, application.kpp, application.ogrn,
        application.region, application.applicant_position, application.email, application.phone,
        application.submitted_at, application.updated_at, application.version, application.correlation_id,
        organization.id AS organization_id, organization.status AS organization_status,
        organization.name AS organization_name,
        organization."kycStatus" AS organization_kyc_status,
        organization."amlStatus" AS organization_aml_status,
        organization."sanctionHit" AS organization_sanction_hit,
        applicant.id AS user_id, applicant."fullName" AS applicant_name,
        application.email_verified_at,
        (
          SELECT COUNT(*)::int
          FROM public.organizations duplicate_organization
          WHERE duplicate_organization.inn = application.inn
            AND duplicate_organization.id <> application.organization_id
        ) AS duplicate_organization_count,
        (
          SELECT COUNT(*)::int
          FROM auth.registration_applications duplicate_application
          WHERE LOWER(duplicate_application.email) = LOWER(application.email)
            AND duplicate_application.id <> application.id
        ) AS duplicate_email_application_count
      FROM auth.registration_applications application
      JOIN public.organizations organization ON organization.id = application.organization_id
      JOIN public.users applicant ON applicant.id = application.user_id
      WHERE application.kind = 'NEW_ORGANIZATION'
        AND application.status IN ('ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED', 'SUSPENDED')
      ORDER BY application.submitted_at ASC, application.id ASC
      LIMIT 100
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
      SELECT
        application.id, application.status, application.requested_workspace, application.requested_role,
        application.applicant_position, application.email, application.phone,
        application.submitted_at, application.updated_at, application.version, application.correlation_id,
        applicant.id AS user_id, applicant."fullName" AS applicant_name
      FROM auth.registration_applications application
      JOIN public.users applicant ON applicant.id = application.user_id
      JOIN public.organizations organization ON organization.id = application.organization_id
      WHERE application.kind = 'JOIN_EXISTING_ORGANIZATION'
        AND application.organization_id = ${administrator.organizationId}
        AND organization."tenantId" = ${administrator.tenantId}
        AND application.status IN ('ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED')
      ORDER BY application.submitted_at ASC, application.id ASC
      LIMIT 100
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
    const administrator = await this.requireOrganizationAdmin(reviewer);
    return this.prisma.$transaction(async (tx) => {
      const eventKey = `org-join-decision:${idempotencyKey}`;
      const existing = await tx.$queryRaw<Array<{ application_id: string; new_status: string }>>(Prisma.sql`
        SELECT event.application_id, event.new_status
        FROM auth.registration_application_events event
        JOIN auth.registration_applications application ON application.id = event.application_id
        JOIN public.organizations organization ON organization.id = application.organization_id
        WHERE event.idempotency_key = ${eventKey}
          AND application.organization_id = ${administrator.organizationId}
          AND organization."tenantId" = ${administrator.tenantId}
        LIMIT 1
      `);
      if (existing[0]) {
        if (existing[0].application_id !== applicationId) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_TARGET' });
        }
        return this.readResult(tx, applicationId, deliveryKey);
      }

      const application = await this.lockApplication(tx, applicationId);
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
        await this.approve(tx, application, reviewer, reason, idempotencyKey, correlationId, 'ORGANIZATION_ADMIN', eventKey);
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
      return this.readResult(tx, applicationId, deliveryKey);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
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

    return this.prisma.$transaction(async (tx) => {
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
        return this.readResult(tx, applicationId, deliveryKey);
      }

      const application = await this.lockApplication(tx, applicationId);
      if (application.kind !== 'NEW_ORGANIZATION') {
        // Existing-organization joins belong exclusively to the verified
        // administrator of that same tenant. A platform reviewer must not be
        // able to bypass that organization-scoped approval boundary by ID.
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

      return this.readResult(tx, application.id, deliveryKey);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
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

    if (application.kind === 'NEW_ORGANIZATION') {
      const organizationUpdated = await tx.$executeRaw(Prisma.sql`
        UPDATE public.organizations
        SET status = 'VERIFIED',
            "verifiedAt" = NOW(),
            version = version + 1,
            "updatedAt" = NOW()
        WHERE id = ${application.organization_id}
          AND status = 'PENDING'
      `);
      if (organizationUpdated !== 1) {
        throw new ConflictException({ code: 'ORGANIZATION_ACTIVATION_CONFLICT' });
      }
    }

    const allowedUserStatuses = application.kind === 'JOIN_EXISTING_ORGANIZATION' && actorKind === 'ORGANIZATION_ADMIN'
      ? Prisma.sql`('PENDING_APPROVAL', 'ACTIVE')`
      : Prisma.sql`('PENDING_APPROVAL', 'SUSPENDED', 'ACTIVE')`;
    const userUpdated = await tx.$executeRaw(Prisma.sql`
      UPDATE public.users
      SET status = 'ACTIVE', "updatedAt" = NOW()
      WHERE id = ${application.user_id}
        AND status IN ${allowedUserStatuses}
    `);
    if (userUpdated !== 1) {
      throw new ConflictException({ code: 'USER_ACTIVATION_CONFLICT' });
    }

    const membershipUpdated = await tx.$executeRaw(Prisma.sql`
      UPDATE public.user_orgs
      SET status = 'ACTIVE',
          role = ${application.requested_role},
          activated_at = NOW(),
          revoked_at = NULL,
          is_org_admin = ${application.kind === 'NEW_ORGANIZATION'},
          version = version + 1
      WHERE id = ${application.membership_id}
        AND "userId" = ${application.user_id}
        AND "organizationId" = ${application.organization_id}
        AND status IN ('PENDING', 'SUSPENDED')
    `);
    if (membershipUpdated !== 1) {
      throw new ConflictException({ code: 'MEMBERSHIP_ACTIVATION_CONFLICT' });
    }

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

    if (targetStatus === 'REJECTED') {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_orgs
        SET status = 'REVOKED', revoked_at = NOW(), version = version + 1
        WHERE id = ${application.membership_id}
      `);
      if (application.kind === 'NEW_ORGANIZATION') {
        await tx.$executeRaw(Prisma.sql`
          UPDATE public.users
          SET status = 'REJECTED', "updatedAt" = NOW()
          WHERE id = ${application.user_id}
        `);
        await tx.$executeRaw(Prisma.sql`
          UPDATE public.organizations
          SET status = 'REJECTED', version = version + 1, "updatedAt" = NOW()
          WHERE id = ${application.organization_id}
          AND status = 'PENDING'
        `);
      } else {
        await this.updateUserStatusWithoutActiveMembership(tx, application.user_id, 'REJECTED');
      }
    } else if (targetStatus === 'SUSPENDED') {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_orgs
        SET status = 'SUSPENDED', version = version + 1
        WHERE id = ${application.membership_id}
      `);
      if (application.kind === 'NEW_ORGANIZATION') {
        await tx.$executeRaw(Prisma.sql`
          UPDATE public.users
          SET status = 'SUSPENDED', "updatedAt" = NOW()
          WHERE id = ${application.user_id}
        `);
        await this.authRepository.revokeAllUserSessions(tx, application.user_id, 'REGISTRATION_SUSPENDED');
      } else {
        await this.updateUserStatusWithoutActiveMembership(tx, application.user_id, 'SUSPENDED');
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

  private async requireOrganizationAdmin(reviewer: RequestUser): Promise<OrganizationAdmin> {
    this.requireFreshMfa(reviewer);
    const membershipId = String(reviewer.membershipId || '').trim();
    const organizationId = String(reviewer.orgId || '').trim();
    const tenantId = String(reviewer.tenantId || '').trim();
    if (!reviewer.id || !membershipId || !organizationId || !tenantId || !reviewer.isOrgAdmin) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    const membership = await this.prisma.userOrg.findFirst({
      where: {
        id: membershipId,
        userId: reviewer.id,
        organizationId,
        status: 'ACTIVE',
        isOrgAdmin: true,
        organization: { tenantId, status: 'VERIFIED' },
      },
      select: { id: true, role: true, organizationId: true, organization: { select: { tenantId: true } } },
    });
    if (!membership || !isOrganizationHumanRole(membership.role)) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    return {
      membershipId: membership.id,
      organizationId: membership.organizationId,
      tenantId: membership.organization.tenantId,
      role: membership.role,
    };
  }

  private async lockApplication(
    tx: Prisma.TransactionClient,
    applicationId: string,
  ): Promise<LockedApplication> {
    const rows = await tx.$queryRaw<LockedApplication[]>(Prisma.sql`
      SELECT
        application.id,
        application.kind,
        application.user_id,
        application.organization_id,
        application.membership_id,
        application.requested_workspace,
        application.requested_role,
        application.status,
        application.version,
        application.correlation_id,
        organization.status AS organization_status,
        organization."tenantId" AS tenant_id
      FROM auth.registration_applications application
      JOIN public.organizations organization ON organization.id = application.organization_id
      WHERE application.id = ${applicationId}
      FOR UPDATE OF application, organization
    `);
    if (!rows[0]) throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    return rows[0];
  }

  private async updateUserStatusWithoutActiveMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    status: 'REJECTED' | 'SUSPENDED',
  ) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE public.users subject
      SET status = ${status}, "updatedAt" = NOW()
      WHERE subject.id = ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM public.user_orgs membership
          WHERE membership."userId" = subject.id AND membership.status = 'ACTIVE'
        )
    `);
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

  private async readResult(client: AuthSqlClient, applicationId: string, deliveryKey?: string) {
    const rows = await client.$queryRaw<Array<{
      id: string;
      status: string;
      version: bigint;
      correlation_id: string;
      email: string;
      decision_reason: string | null;
    }>>(Prisma.sql`
      SELECT id, status, version, correlation_id, email, decision_reason
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
      notificationDelivery: deliveryAuthorized(deliveryKey)
        ? {
            email: application.email,
            status: application.status,
            reason: application.decision_reason,
          }
        : undefined,
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
