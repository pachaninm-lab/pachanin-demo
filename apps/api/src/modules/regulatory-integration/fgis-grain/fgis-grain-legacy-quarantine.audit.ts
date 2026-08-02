import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Durable audit for retired ФГИС «Зерно» path denials.
 *
 * The quarantine slice originally wrote denials with `Logger.warn`. That is not
 * an audit trail: it is not transactional, not append-only, not tenant-scoped,
 * and it is gone after log rotation. Someone probing a withdrawn regulatory
 * route is precisely the fact that has to outlive the process.
 *
 * Every denial is therefore committed to `public.audit_events` through
 * `public.record_fgis_legacy_quarantine_denial`, which hash-chains it onto the
 * previous audit row under an advisory lock.
 *
 * Fail-closed: the write is awaited, and a failure propagates. A caller that
 * cannot record the attempt must not proceed to a "clean" refusal either —
 * every quarantined path denies regardless, so an unrecordable attempt turns
 * into a `503` rather than a silently unlogged `410`. No business state is
 * mutated on any of these paths, so there is nothing to roll back.
 */

export interface FgisQuarantineAuditFact {
  /** Server-derived. Never taken from the request body. */
  readonly tenantId: string | null;
  readonly organizationId: string | null;
  readonly actorUserId: string | null;
  readonly actorRole: string | null;
  readonly sessionId: string | null;
  readonly route: string;
  readonly denialCode: string;
  readonly correlationId: string;
}

export interface FgisQuarantineAuditReceipt {
  readonly auditEventId: string;
  readonly correlationId: string;
  readonly outcome: 'DENIED';
  readonly boundary: 'LEGACY_FGIS_QUARANTINE';
}

type AuditRow = Readonly<{ result: unknown }>;

export class FgisQuarantineAuditUnavailableError extends ServiceUnavailableException {
  constructor(correlationId: string) {
    super({
      code: 'FGIS_QUARANTINE_AUDIT_UNAVAILABLE',
      message:
        'Обращение к отключённому маршруту ФГИС «Зерно» не может быть записано в аудит. ' +
        'Операция отклонена без изменения состояния.',
      correlationCode: correlationId,
      stateChanged: false,
      attestation: 'NOT_ATTESTED',
    });
  }
}

@Injectable()
export class FgisLegacyQuarantineAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Commits one immutable denial fact and returns its receipt.
   *
   * Each call appends a separate row on purpose: two attempts against the same
   * route are two attempts, and collapsing them would hide the second. There is
   * no idempotency key here for that reason.
   */
  async recordDenial(fact: FgisQuarantineAuditFact): Promise<FgisQuarantineAuditReceipt> {
    let rows: AuditRow[];
    try {
      rows = await this.prisma.$queryRaw<AuditRow[]>`
        SELECT public.record_fgis_legacy_quarantine_denial(
          ${fact.tenantId},
          ${fact.organizationId},
          ${fact.actorUserId},
          ${fact.actorRole},
          ${fact.sessionId},
          ${fact.route},
          ${fact.denialCode},
          ${fact.correlationId}
        ) AS result
      `;
    } catch {
      // The underlying error may carry connection strings or SQL text, so it is
      // never surfaced or re-thrown. The correlation code is enough to find the
      // request in the platform's own logs.
      throw new FgisQuarantineAuditUnavailableError(fact.correlationId);
    }

    const result = rows[0]?.result as { auditEventId?: unknown } | undefined;
    if (!result || typeof result.auditEventId !== 'string') {
      throw new FgisQuarantineAuditUnavailableError(fact.correlationId);
    }

    return {
      auditEventId: result.auditEventId,
      correlationId: fact.correlationId,
      outcome: 'DENIED',
      boundary: 'LEGACY_FGIS_QUARANTINE',
    };
  }
}
