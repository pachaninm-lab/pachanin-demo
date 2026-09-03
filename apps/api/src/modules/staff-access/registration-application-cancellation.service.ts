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
import { appendAuthAudit } from '../auth/auth-audit';
import { AuthPrismaService } from '../auth/auth-prisma.service';
import { PersistentAuthRepository } from '../auth/persistent-auth.repository';

const FRESH_MFA_MS = 15 * 60 * 1000;
const OWNER_CANCEL_ALLOWED_STATUSES = new Set([
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

type LockedRegistrationApplication = {
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
export class RegistrationApplicationCancellationService {
  constructor(
    private readonly prisma: AuthPrismaService,
    private readonly authRepository: PersistentAuthRepository,
  ) {}

  async cancel(
    applicationIdInput: string,
    reasonInput: string,
    owner: RequestUser,
    idempotencyKeyInput: string,
    correlationIdInput: string,
  ): Promise<CancellationResponse> {
    const applicationId = String(applicationIdInput || '').trim();
    const reason = String(reasonInput || '').trim();
    const idempotencyKey = String(idempotencyKeyInput || '').trim();
    const correlationId = String(correlationIdInput || '').trim();

    if (!applicationId || applicationId.length > 256) {
      throw new BadRequestException({ code: 'REGISTRATION_APPLICATION_ID_REQUIRED' });
    }
    if (reason.length < 8 || reason.length > 1000) {
      throw new BadRequestException({ code: 'DECISION_REASON_REQUIRED' });
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    if (!correlationId || correlationId.length > 128) {
      throw new BadRequestException({ code: 'CORRELATION_ID_REQUIRED' });
    }

    this.requirePlatformOwner(owner);
    this.requireFreshMfa(owner);
    const sessionId = this.requireActorSession(owner);
    const eventKey = `owner-cancel:${idempotencyKey}`;

    return this.prisma.$transaction(async (tx) => {
      await this.requireDurableOwner(tx, owner, sessionId);

      const replay = await tx.$queryRaw<Array<{ application_id: string; new_status: string }>>(Prisma.sql`
        SELECT application_id, new_status
        FROM auth.registration_application_events
        WHERE idempotency_key = ${eventKey}
        LIMIT 1
      `);
      if (replay[0]) {
        if (replay[0].application_id !== applicationId) {
          throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_TARGET' });
        }
        if (replay[0].new_status !== 'CANCELLED') {
          throw new ConflictException({ code: 'IDEMPOTENCY_REPLAY_STATE_CONFLICT' });
        }
        return this.readCancelledResult(tx, applicationId, true);
      }

      const application = await this.lockApplication(tx, applicationId);
      if (application.status === 'CANCELLED') {
        return { applicationId, status: 'CANCELLED', replayed: true };
      }
      if (application.status === 'ACTIVATED') {
        throw new ConflictException({ code: 'APPLICATION_ALREADY_ACTIVATED' });
      }
      if (!OWNER_CANCEL_ALLOWED_STATUSES.has(application.status)) {
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

      const eventId = `reg_evt_${randomUUID()}`;
      const eventInserted = await tx.$executeRaw(Prisma.sql`
        INSERT INTO auth.registration_application_events (
          id, application_id, actor_user_id, actor_kind,
          previous_status, new_status, reason, correlation_id,
          idempotency_key, application_version, metadata
        ) VALUES (
          ${eventId}, ${application.id}, ${owner.id}, 'PLATFORM_REVIEWER',
          ${application.status}, 'CANCELLED', 'OWNER_CANCELLED_APPLICATION', ${correlationId},
          ${eventKey}, ${nextVersion},
          ${JSON.stringify({ ownerReason: reason })}::jsonb
        )
      `);
      if (eventInserted !== 1) {
        throw new ConflictException({ code: 'REGISTRATION_CANCEL_EVENT_MISSING' });
      }

      await appendAuthAudit(this.authRepository, tx, {
        userId: owner.id,
        sessionId,
        membershipId: owner.membershipId,
        organizationId: owner.orgId,
        tenantId: owner.tenantId,
        action: 'auth.registration.application.cancel',
        outcome: 'SUCCESS',
        reason: 'OWNER_CANCELLED_APPLICATION',
        metadata: {
          applicationId: application.id,
          previousStatus: application.status,
          decisionReason: reason,
          correlationId,
          applicationVersion: nextVersion.toString(),
        },
      });

      const postconditions = await tx.$queryRaw<Array<{
        status: string;
        version: bigint;
        decided_at: Date | null;
        decision_reason: string | null;
        decision_actor_user_id: string | null;
        pending_challenges: bigint;
        event_created: boolean;
        audit_created: boolean;
      }>>(Prisma.sql`
        SELECT
          application.status,
          application.version,
          application.decided_at,
          application.decision_reason,
          application.decision_actor_user_id,
          (
            SELECT COUNT(*)
            FROM auth.registration_email_challenges challenge
            WHERE challenge.application_id = application.id
              AND challenge.status = 'PENDING'
          ) AS pending_challenges,
          EXISTS (
            SELECT 1
            FROM auth.registration_application_events event
            WHERE event.application_id = application.id
              AND event.idempotency_key = ${eventKey}
              AND event.previous_status = ${application.status}
              AND event.new_status = 'CANCELLED'
              AND event.actor_kind = 'PLATFORM_REVIEWER'
              AND event.reason = 'OWNER_CANCELLED_APPLICATION'
              AND event.application_version = ${nextVersion}
          ) AS event_created,
          EXISTS (
            SELECT 1
            FROM auth.audit_events audit
            WHERE audit.user_id = ${owner.id}
              AND audit.session_id = ${sessionId}
              AND audit.action = 'auth.registration.application.cancel'
              AND audit.outcome = 'SUCCESS'
              AND audit.reason = 'OWNER_CANCELLED_APPLICATION'
              AND audit.metadata->>'applicationId' = ${application.id}
              AND audit.metadata->>'correlationId' = ${correlationId}
          ) AS audit_created
        FROM auth.registration_applications application
        WHERE application.id = ${application.id}
        LIMIT 1
      `);
      const final = postconditions[0];
      if (
        !final
        || final.status !== 'CANCELLED'
        || BigInt(final.version) !== nextVersion
        || !final.decided_at
        || final.decision_reason !== reason
        || final.decision_actor_user_id !== owner.id
        || BigInt(final.pending_challenges) !== 0n
        || final.event_created !== true
        || final.audit_created !== true
      ) {
        throw new ConflictException({ code: 'REGISTRATION_CANCEL_POSTCONDITION_FAILED' });
      }

      return { applicationId: application.id, status: 'CANCELLED', replayed: false };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15_000,
      maxWait: 5_000,
    });
  }

  private requirePlatformOwner(owner: RequestUser) {
    if (!owner.staffRoles?.includes('PLATFORM_OWNER')) {
      throw new ForbiddenException({ code: 'PLATFORM_OWNER_REQUIRED' });
    }
  }

  private requireFreshMfa(owner: RequestUser) {
    const verifiedAt = Date.parse(String(owner.mfaVerifiedAt || ''));
    if (
      !owner.mfaVerified
      || !Number.isFinite(verifiedAt)
      || Date.now() - verifiedAt > FRESH_MFA_MS
      || verifiedAt > Date.now() + 30_000
    ) {
      throw new ForbiddenException({ code: 'FRESH_MFA_REQUIRED' });
    }
  }

  private requireActorSession(owner: RequestUser): string {
    const sessionId = String(owner.sessionId || '').trim();
    if (!sessionId) {
      throw new ForbiddenException({ code: 'ACTIVE_SESSION_REQUIRED' });
    }
    return sessionId;
  }

  private async requireDurableOwner(
    tx: Prisma.TransactionClient,
    owner: RequestUser,
    sessionId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ reviewer_authorized: boolean; owner_authorized: boolean }>>(Prisma.sql`
      SELECT
        auth.registration_platform_actor_authorized(${owner.id}, ${sessionId}) AS reviewer_authorized,
        EXISTS (
          SELECT 1
          FROM auth.staff_assignments assignment
          WHERE assignment.user_id = ${owner.id}
            AND assignment.role = 'PLATFORM_OWNER'
            AND assignment.status = 'ACTIVE'
            AND assignment.revoked_at IS NULL
            AND assignment.suspended_at IS NULL
            AND assignment.valid_from <= NOW()
            AND (assignment.valid_until IS NULL OR assignment.valid_until > NOW())
        ) AS owner_authorized
    `);
    if (!rows[0]?.reviewer_authorized || !rows[0]?.owner_authorized) {
      throw new ForbiddenException({ code: 'PLATFORM_OWNER_REQUIRED' });
    }
  }

  private async lockApplication(
    tx: Prisma.TransactionClient,
    applicationId: string,
  ): Promise<LockedRegistrationApplication> {
    const rows = await tx.$queryRaw<LockedRegistrationApplication[]>(Prisma.sql`
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

  private async readCancelledResult(
    tx: Prisma.TransactionClient,
    applicationId: string,
    replayed: boolean,
  ): Promise<CancellationResponse> {
    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT id, status
      FROM auth.registration_applications
      WHERE id = ${applicationId}
      LIMIT 1
    `);
    if (!rows[0]) {
      throw new NotFoundException({ code: 'REGISTRATION_APPLICATION_NOT_FOUND' });
    }
    if (rows[0].status !== 'CANCELLED') {
      throw new ConflictException({ code: 'IDEMPOTENCY_REPLAY_STATE_CONFLICT' });
    }
    return { applicationId: rows[0].id, status: 'CANCELLED', replayed };
  }
}
