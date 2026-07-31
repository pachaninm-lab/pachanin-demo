import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { RequestUser, Role } from '../../common/types/request-user';
import { AuthPrismaService } from './auth-prisma.service';
import { sha256, stableJson } from './auth-crypto';
import type { AuthSqlClient } from './persistent-auth.repository';
import { PersistentAuthRepository } from './persistent-auth.repository';
import type { RegistrationDecision } from './registration-application.service';

type LockedApplication = {
  id: string;
  kind: 'NEW_ORGANIZATION' | 'JOIN_EXISTING_ORGANIZATION';
  user_id: string;
  organization_id: string;
  membership_id: string;
  requested_role: Role;
  status: string;
  version: bigint;
  correlation_id: string;
  organization_status: string;
};

@Injectable()
export class RegistrationDecisionService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly authRepository: PersistentAuthRepository,
  ) {}

  async decide(
    applicationId: string,
    decision: RegistrationDecision,
    reasonInput: string,
    reviewer: RequestUser,
    idempotencyKeyInput: string,
    correlationId: string,
  ) {
    const reason = String(reasonInput ?? '').trim();
    const idempotencyKey = String(idempotencyKeyInput ?? '').trim();

    if (reason.length < 8 || reason.length > 1000) {
      throw new BadRequestException({ code: 'DECISION_REASON_REQUIRED' });
    }
    if (!reviewer.mfaVerified) {
      throw new ForbiddenException({ code: 'MFA_REQUIRED' });
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }

    return this.prisma.$transaction(async (tx) => {
      const eventKey = `decision:${idempotencyKey}`;
      const existing = await tx.$queryRaw<Array<{ application_id: string }>>(Prisma.sql`
        SELECT application_id
        FROM auth.registration_application_events
        WHERE idempotency_key = ${eventKey}
        LIMIT 1
      `);
      if (existing[0]) return this.readResult(tx, existing[0].application_id);

      const rows = await tx.$queryRaw<LockedApplication[]>(Prisma.sql`
        SELECT
          application.id,
          application.kind,
          application.user_id,
          application.organization_id,
          application.membership_id,
          application.requested_role,
          application.status,
          application.version,
          application.correlation_id,
          organization.status AS organization_status
        FROM auth.registration_applications application
        JOIN public.organizations organization
          ON organization.id = application.organization_id
        WHERE application.id = ${applicationId}
        FOR UPDATE OF application, organization
      `);
      const application = rows[0];
      if (!application) {
        throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
      }
      if (application.user_id === reviewer.id) {
        throw new ForbiddenException({ code: 'SELF_APPROVAL_FORBIDDEN' });
      }
      if (!['ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED', 'SUSPENDED'].includes(application.status)) {
        throw new ConflictException({ code: 'REGISTRATION_STATE_CONFLICT', status: application.status });
      }

      if (decision === 'APPROVE') {
        await this.approve(tx, application, reviewer, reason, idempotencyKey, correlationId);
      } else {
        await this.nonApprovalDecision(
          tx,
          application,
          reviewer,
          decision,
          reason,
          eventKey,
          correlationId,
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

      return this.readResult(tx, application.id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 5_000 });
  }

  private async approve(
    tx: Prisma.TransactionClient,
    application: LockedApplication,
    reviewer: RequestUser,
    reason: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
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

    const userUpdated = await tx.$executeRaw(Prisma.sql`
      UPDATE public.users
      SET status = 'ACTIVE', "updatedAt" = NOW()
      WHERE id = ${application.user_id}
        AND status IN ('PENDING_APPROVAL', 'SUSPENDED')
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
      actorKind: 'PLATFORM_REVIEWER',
      previousStatus: application.status,
      newStatus: 'APPROVED',
      reason,
      correlationId,
      idempotencyKey: `decision-approved:${idempotencyKey}`,
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
      idempotencyKey: `decision:${idempotencyKey}`,
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
        UPDATE public.users
        SET status = 'REJECTED', "updatedAt" = NOW()
        WHERE id = ${application.user_id}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_orgs
        SET status = 'REVOKED', revoked_at = NOW(), version = version + 1
        WHERE id = ${application.membership_id}
      `);
      if (application.kind === 'NEW_ORGANIZATION') {
        await tx.$executeRaw(Prisma.sql`
          UPDATE public.organizations
          SET status = 'REJECTED', version = version + 1, "updatedAt" = NOW()
          WHERE id = ${application.organization_id}
            AND status = 'PENDING'
        `);
      }
    } else if (targetStatus === 'SUSPENDED') {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.users
        SET status = 'SUSPENDED', "updatedAt" = NOW()
        WHERE id = ${application.user_id}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.user_orgs
        SET status = 'SUSPENDED', version = version + 1
        WHERE id = ${application.membership_id}
      `);
      await this.authRepository.revokeAllUserSessions(tx, application.user_id, 'REGISTRATION_SUSPENDED');
    }

    await this.insertEvent(tx, {
      applicationId: application.id,
      actorUserId: reviewer.id,
      actorKind: 'PLATFORM_REVIEWER',
      previousStatus: application.status,
      newStatus: targetStatus,
      reason,
      correlationId,
      idempotencyKey: eventKey,
      applicationVersion: nextVersion,
    });
  }

  private async readResult(client: AuthSqlClient, applicationId: string) {
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
