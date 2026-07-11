import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestUser } from '../../common/types/request-user';
import { sha256, stableJson } from '../auth/auth-crypto';
import { StaffAccessRepository, StaffSqlClient } from './staff-access.repository';
import { StaffAccessContext, StaffRole } from './staff-access.types';

export type StaffAuditWriteInput = {
  action: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'DENIED';
  resourceType?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class StaffAuditWriterService {
  constructor(private readonly repository: StaffAccessRepository) {}

  async record(actor: RequestUser, access: StaffAccessContext, input: StaffAuditWriteInput) {
    const correlationId = input.correlationId || randomUUID();
    await this.repository.transaction((tx) => this.recordInTransaction(tx, actor, access, {
      ...input,
      correlationId,
    }));
    return correlationId;
  }

  async recordInTransaction(
    client: StaffSqlClient,
    actor: RequestUser,
    access: StaffAccessContext,
    input: StaffAuditWriteInput,
  ) {
    const correlationId = input.correlationId || randomUUID();
    const prevHash = await this.repository.latestEventHash(client, actor.id);
    const id = `sae_${randomUUID()}`;
    const payload = {
      id,
      actorUserId: actor.id,
      staffRole: access.staffRole as StaffRole,
      accessSessionId: access.accessSessionId,
      grantId: access.grantId,
      effectiveTenantId: access.effectiveTenantId,
      effectiveOrganizationId: access.effectiveOrganizationId,
      effectiveUserId: access.effectiveUserId,
      effectiveRole: access.effectiveRole,
      accessMode: access.accessMode,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome ?? 'SUCCESS',
      reason: input.reason ?? access.reason,
      ticketId: access.ticketId,
      correlationId,
      metadata: {
        targetDealId: access.targetDealId ?? null,
        ...(input.metadata || {}),
      },
      prevHash,
    };
    await this.repository.insertEvent(client, {
      ...payload,
      hash: sha256(stableJson(payload)),
    });
    return correlationId;
  }
}
