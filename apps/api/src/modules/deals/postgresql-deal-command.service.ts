import { Inject, Injectable } from '@nestjs/common';
import { runWithCommandExecutionContext } from '../../common/command-execution.context';
import type { RequestUser } from '../../common/types/request-user';
import { DealCommandService } from './deal-command.service';
import type { ExecuteDealCommandDto } from './dto/execute-deal-command.dto';
import { LogisticsAdmissionService } from './logistics-admission.service';
import { runWithLogisticsCommandContext } from './logistics-admission-context';

export const BASE_DEAL_COMMAND_SERVICE = Symbol('BASE_DEAL_COMMAND_SERVICE');

/**
 * Production command facade. All ordinary commands delegate to the canonical
 * state machine. assign_logistics first resolves one normalized PostgreSQL
 * admission and carries its immutable command context into the same transaction
 * in which Shipment, DealEvent, AuditEvent and receipt are written.
 */
@Injectable()
export class PostgresqlDealCommandService {
  constructor(
    @Inject(BASE_DEAL_COMMAND_SERVICE)
    private readonly base: DealCommandService,
    private readonly logisticsAdmissions: LogisticsAdmissionService,
  ) {}

  workspace(dealId: string, user: RequestUser) {
    return this.base.workspace(dealId, user);
  }

  async execute(
    dealId: string,
    rawActionId: string,
    dto: ExecuteDealCommandDto,
    user: RequestUser,
  ) {
    if (rawActionId !== 'assign_logistics') {
      return runWithCommandExecutionContext(
        { commandId: dto.commandId },
        () => this.base.execute(dealId, rawActionId, dto, user),
      );
    }

    const admission = await this.logisticsAdmissions.resolveForCommand(
      dealId,
      dto.payload ?? {},
      user,
      dto.commandId,
    );

    return runWithCommandExecutionContext(
      { commandId: dto.commandId },
      () => runWithLogisticsCommandContext(
        {
          commandId: dto.commandId,
          admissionId: admission.admissionId,
          basis: admission.basis,
        },
        () => this.base.execute(dealId, rawActionId, dto, user),
      ),
    );
  }
}
