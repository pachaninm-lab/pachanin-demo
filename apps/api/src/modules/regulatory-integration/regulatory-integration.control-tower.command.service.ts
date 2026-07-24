import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { RegulatoryIntegrationInboxLifecycleRepository } from './regulatory-integration.inbox-lifecycle.repository';
import {
  IntegrationControlTowerRepositoryError,
  type IntegrationReconciliationReceipt,
} from './regulatory-integration.control-tower.repository';
import { RegulatoryIntegrationReconciliationRepository } from './regulatory-integration.reconciliation.repository';

export type IntegrationControlTowerCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  reason: string;
  expectedVersion: string;
}>;

export type IntegrationRedriveReceipt = Readonly<{
  kind: 'APPLIED' | 'REPLAY';
  entryId: string;
  auditEventId: string;
  outboxEntryId: string;
  correlationId: string;
}>;

@Injectable()
export class RegulatoryIntegrationControlTowerCommandService {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly lifecycle: RegulatoryIntegrationInboxLifecycleRepository,
    private readonly reconciliation: RegulatoryIntegrationReconciliationRepository,
  ) {}

  async redrive(
    user: RequestUser,
    entryId: string,
    command: IntegrationControlTowerCommand,
  ): Promise<IntegrationRedriveReceipt> {
    await this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<Array<{ version: bigint; state: string }>>(Prisma.sql`
        SELECT "version", "state"
        FROM public."regulatory_integration_inbox_entries"
        WHERE "id" = ${entryId}
          AND "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
        FOR SHARE
      `);
      const row = rows[0];
      if (!row) {
        throw new IntegrationControlTowerRepositoryError(
          'ADAPTER_NOT_FOUND',
          'Inbox entry is not accessible.',
        );
      }
      if (row.version.toString() !== command.expectedVersion) {
        throw new IntegrationControlTowerRepositoryError(
          'STALE_VERSION',
          'Inbox entry version changed.',
        );
      }
      if (row.state !== 'QUARANTINED' && row.state !== 'DEAD') {
        throw new IntegrationControlTowerRepositoryError(
          'STALE_VERSION',
          `Inbox entry cannot be redriven from state ${row.state}.`,
        );
      }
    });

    return this.lifecycle.redrive(user, {
      entryId,
      reason: command.reason,
      idempotencyKey: `${command.commandId}:${command.idempotencyKey}`,
      correlationId: command.correlationId,
    });
  }

  async reconcile(
    user: RequestUser,
    adapterCode: string,
    command: IntegrationControlTowerCommand,
  ): Promise<IntegrationReconciliationReceipt> {
    return this.reconciliation.request(user, {
      adapterCode,
      expectedVersion: command.expectedVersion,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      reason: command.reason,
    });
  }
}
