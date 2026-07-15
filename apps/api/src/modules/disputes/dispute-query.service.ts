import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';

type SnapshotRow = Readonly<{ snapshot: Prisma.JsonValue }>;

@Injectable()
export class DisputeQueryService {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<SnapshotRow[]>(Prisma.sql`
        SELECT dispute.case_snapshot(c.id) AS snapshot
        FROM dispute.cases c
        WHERE c.tenant_id = current_setting('app.current_tenant_id', true)
          AND dispute.can_read_case(c.id)
        ORDER BY
          CASE c.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
          c.sla_deadline_at ASC NULLS LAST,
          c.created_at ASC,
          c.id ASC
      `);
      return snapshots(rows);
    });
  }

  async listForArbitrator(user: RequestUser): Promise<Record<string, unknown>[]> {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<SnapshotRow[]>(Prisma.sql`
        SELECT dispute.case_snapshot(c.id) AS snapshot
        FROM dispute.cases c
        WHERE c.tenant_id = current_setting('app.current_tenant_id', true)
          AND c.status IN ('OPEN', 'UNDER_REVIEW', 'ARBITRATION', 'APPEALED')
          AND (c.assigned_arbitrator_user_id IS NULL OR c.assigned_arbitrator_user_id = ${context.userId})
          AND dispute.can_read_case(c.id)
        ORDER BY c.created_at ASC, c.id ASC
      `);
      return snapshots(rows);
    });
  }

  async get(caseId: string, user: RequestUser): Promise<Record<string, unknown>> {
    const snapshot = await this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<SnapshotRow[]>(Prisma.sql`
        SELECT dispute.case_snapshot(${caseId}) AS snapshot
      `);
      return snapshots(rows)[0] ?? null;
    });
    if (!snapshot) throw new NotFoundException({ code: 'DISPUTE_CASE_NOT_FOUND', caseId });
    return snapshot;
  }
}

function snapshots(rows: SnapshotRow[]): Record<string, unknown>[] {
  return rows.flatMap((row) => {
    const value = row.snapshot;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? [value as Record<string, unknown>]
      : [];
  });
}
