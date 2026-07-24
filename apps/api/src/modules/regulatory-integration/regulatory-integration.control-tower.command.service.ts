import { Injectable } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import type {
  IntegrationReconciliationReceipt,
} from './regulatory-integration.control-tower.repository';
import {
  RegulatoryIntegrationControlTowerRedriveRepository,
  type IntegrationControlTowerRedriveReceipt,
} from './regulatory-integration.control-tower.redrive.repository';
import { RegulatoryIntegrationReconciliationRepository } from './regulatory-integration.reconciliation.repository';

export type IntegrationControlTowerCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  reason: string;
  expectedVersion: string;
}>;

@Injectable()
export class RegulatoryIntegrationControlTowerCommandService {
  constructor(
    private readonly redriveAuthority: RegulatoryIntegrationControlTowerRedriveRepository,
    private readonly reconciliation: RegulatoryIntegrationReconciliationRepository,
  ) {}

  async redrive(
    user: RequestUser,
    entryId: string,
    command: IntegrationControlTowerCommand,
  ): Promise<IntegrationControlTowerRedriveReceipt> {
    return this.redriveAuthority.redrive(user, {
      entryId,
      expectedVersion: command.expectedVersion,
      reason: command.reason,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
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
