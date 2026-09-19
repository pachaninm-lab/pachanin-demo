import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { RequestUser } from '../../common/types/request-user';
import { appendAuthAudit } from './auth-audit';
import { AuthPrismaService } from './auth-prisma.service';
import type { AuthSqlClient } from './persistent-auth.repository';
import { PersistentAuthRepository } from './persistent-auth.repository';

const REVIEW_MFA_FRESHNESS_MS = 15 * 60 * 1000;
const CANCELLABLE_STATUSES = new Set([
  'DRAFT',
  'SUBMITTED',
  'EMAIL_VERIFICATION_REQUIRED',
  'PHONE_VERIFICATION_REQUIRED',
  'ORGANIZATION_VERIFICATION_PENDING',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'REJECTED',
  'SUSPENDED',
  'EXPIRED',
]);

type LockedApplication = {
  id: string;
  status: string;
  version: bigint;
};

type CancellationResponse = {
  applicationId: string;
  status: 'CANCELLED';
  replayed: boolean;
};

@Injectable()
export class RegistrationCancellationService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly authRepository: PersistentAuthRepository,
  ) {}

  async cancel(
    applicationId: string,
    reasonInput: string,
    owner: RequestUser,
    idempotencyKeyInput: string,
    correlationIdInput: string,
  ): Promise<CancellationResponse> {
    const applicationKey = String(applicationId || '').trim();
    const reason = String(reasonInput || '').trim();
    const idempotencyKey = String(idempotencyKeyInput || '').trim();
    const correlationId = String(correlationIdInput || '').trim();
    if (!applicationKey) throw new BadRequestException({ code: 'REGISTRATION_APPLICATION_ID_REQUIRED' });
    if (reason.length < 8 || reason.length > 1000) {
      throw new BadRequestException({ code: 'DECISION_REASON_REQUIRED' });
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    if (!correlationId || correlationId.length > 128) {
      throw new BadRequestException({ code: 'CORRELATION_ID_REQUIRED' });
    }
    this.requireFreshMfa(owner);
    this.requirePlatformOwner(owner);

    return this.prisma.$transaction(async (tx) => {
      await this.requireDurableOwnerAuthority(tx, owner);
      const eventKey = `owner-cancel:${idempotencyKey}`;
      const replay = await tx.$queryRaw<Array<{ application_id: string; new_status: string }>>(Prisma.sql`
        SELECT application_id, new_status
        FROM auth.registration_application_events
        WHERE idempotency_key = ${eventKey}
        LIMIT 1
      `);
      if (replay[0]) {
        if (replay[0].application_id !== applicationKey) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_TARGET' });
        }
        return this.readCancelled(tx, applicationKey, true);
      }

      const application = await this.lockApplication(tx, applicationKey);
      if (application.status === 'ACTIVATED') {
        throw new ConflictException({ code: 'APPLICATION_ALREADY_ACTIVATED' });
      }
      if (application.status === 'CANCELLED') {
        return this.readCancelled(tx, application.id, true);
      }
      if (!CANCELLABLE_STATUSES.has(application.status)) {
        throw new ConflictException({ code: 'REGISTRATION_STATE_CONFLICT', status: application.status });
      }

      const nextVersion = application.version + 1n;
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_applications
        SET status = 'CANCELLED',
            decided_at = NOW(),
            decision_reason = ${reason},
            decision_actor_user_id = ${owner.id},
            version = ${nextVersion},
            updated_at = NOW()
        WHERE id = ${application.id}
          AND version = ${application.version}
          AND status = ${application.status}
      `);
      if (updated !== 1) {
        throw new ConflictException({ code: 'REGISTRATION_VERSION_CONFLICT' });
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_email_challenges
        SET status = 'REVOKED', updated_at = NOW()
        WHERE application_id = ${application.id}
          AND status = 'PENDING'
      `);

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_application_events (
          id, application_id, actor_user_id, actor_kind,
          previous_status, new_status, reason, correlation_id,
          idempotency_key, application_version
        ) VALUES (
          ${`reg_evt_${randomUUID()}`}, ${application.id}, ${owner.id}, 'PLATFORM_REVIEWER',
          ${application.status}, 'CANCELLED', 'OWNER_CANCELLED_APPLICATION', ${correlationId},
          ${eventKey}, ${nextVersion}
        )
      `);

      await appendAuthAudit(this.authRepository, tx, {
        userId: owner.id,
        sessionId: owner.sessionId,
        membershipId: owner.membershipId,
        organizationId: owner.orgId,
        tenantId: owner.tenantId,
        action: 'auth.registration.application.cancel',
        outcome: 'SUCCESS',
        reason: 'OWNER_CANCELLED_APPLICATION',
        metadata: { applicationId: application.id, decisionReason: reason, correlationId },
      });

      await this.assertPostconditions(tx, application.id, owner.id, nextVersion, eventKey);
      return { applicationId: application.id, status: 'CANCELLED', replayed: false };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15_000,
      maxWait: 5_000,
    });
  }

  private requireFreshMfa(owner: RequestUser) {
    const verifiedAt = Date.parse(String(owner.mfaVerifiedAt || ''));
    if (
      !owner.mfaVerified
      || !Number.isFinite(verifiedAt)
      || Date.now() - verifiedAt > REVIEW_MFA_FRESHNESS_MS
      || verifiedAt > Date.now() + 30_000
    ) {
      throw new ForbiddenException({ code: 'FRESH_MFA_REQUIRED' });
    }
  }

  private requirePlatformOwner(owner: RequestUser) {
    if (!owner.staffRoles?.includes('PLATFORM_OWNER')) {
      throw new ForbiddenException({ code: 'FORBIDDEN' });
    }
  }

  private async requireDurableOwnerAuthority(client: AuthSqlClient, owner: RequestUser) {
    const sessionId = String(owner.sessionId || '').trim();
    if (!sessionId) throw new ForbiddenException({ code: 'FORBIDDEN' });
    const rows = await client.$queryRaw<Array<{ authorized: boolean }>>(Prisma.sql`
      SELECT (
        auth.registration_platform_actor_authorized(${owner.id}, ${sessionId})
        AND EXISTS (
          SELECT 1
          FROM auth.staff_assignments assignment
          WHERE assignment.user_id = ${owner.id}
            AND assignment.status = 'ACTIVE'
            AND assignment.role = 'PLATFORM_OWNER'
            AND assignment.revoked_at IS NULL
            AND assignment.suspended_at IS NULL
            AND assignment.valid_from <= NOW()
            AND (assignment.valid_until IS NULL OR assignment.valid_until > NOW())
        )
      ) AS authorized
    `);
    if (!rows[0]?.authorized) throw new ForbiddenException({ code: 'FORBIDDEN' });
  }

  private async lockApplication(
    tx: Prisma.TransactionClient,
    applicationId: string,
  ): Promise<LockedApplication> {
    const rows = await tx.$queryRaw<LockedApplication[]>(Prisma.sql`
      SELECT id, status, version
      FROM auth.registration_applications
      WHERE id = ${applicationId}
      FOR UPDATE
    `);
    if (!rows[0]) {
      throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    }
    return rows[0];
  }

  private async assertPostconditions(
    tx: Prisma.TransactionClient,
    applicationId: string,
    ownerId: string,
    version: bigint,
    eventKey: string,
  ) {
    const rows = await tx.$queryRaw<Array<{
      status: string;
      version: bigint;
      decision_actor_user_id: string | null;
      pending_challenges: bigint;
      event_count: bigint;
    }>>(Prisma.sql`
      SELECT
        application.status,
        application.version,
        application.decision_actor_user_id,
        (SELECT COUNT(*) FROM auth.registration_email_challenges challenge
          WHERE challenge.application_id = application.id AND challenge.status = 'PENDING') AS pending_challenges,
        (SELECT COUNT(*) FROM auth.registration_application_events event
          WHERE event.application_id = application.id
            AND event.idempotency_key = ${eventKey}
            AND event.new_status = 'CANCELLED') AS event_count
      FROM auth.registration_applications application
      WHERE application.id = ${applicationId}
    `);
    const row = rows[0];
    if (
      !row
      || row.status !== 'CANCELLED'
      || row.version !== version
      || row.decision_actor_user_id !== ownerId
      || row.pending_challenges !== 0n
      || row.event_count !== 1n
    ) {
      throw new ConflictException({ code: 'REGISTRATION_CANCELLATION_POSTCONDITION_FAILED' });
    }
  }

  private async readCancelled(
    client: AuthSqlClient,
    applicationId: string,
    replayed: boolean,
  ): Promise<CancellationResponse> {
    const rows = await client.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT id, status
      FROM auth.registration_applications
      WHERE id = ${applicationId}
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    if (rows[0].status !== 'CANCELLED') {
      throw new ConflictException({ code: 'REGISTRATION_STATE_CONFLICT', status: rows[0].status });
    }
    return { applicationId: rows[0].id, status: 'CANCELLED', replayed };
  }
}
