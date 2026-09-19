import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { ExecuteDealCommandDto } from '../deals/dto/execute-deal-command.dto';
import { PostgresqlDealCommandService } from '../deals/postgresql-deal-command.service';
import { SettlementEngineService } from './settlement-engine.service';

/**
 * Keeps the accepted PostgreSQL Deal/Labs implementation intact while routing
 * settlement state-machine commands through the same authoritative Settlement
 * repository used by HTTP requests and verified bank callbacks.
 */
@Injectable()
export class SettlementAwareDealCommandService extends PostgresqlDealCommandService {
  constructor(
    private readonly settlementRls: RlsTransactionService,
    private readonly settlement: SettlementEngineService,
  ) {
    super(settlementRls);
  }

  override async execute(
    dealId: string,
    actionId: string,
    dto: ExecuteDealCommandDto,
    user: RequestUser,
  ) {
    if (actionId === 'request_reserve' || actionId === 'request_release') {
      const replay = await this.findDurableReplay(dealId, actionId, dto, user);
      if (replay) return replay;
    }

    if (actionId === 'request_reserve') {
      const result = await this.settlement.requestReserve(dealId, user, {
        commandId: dto.commandId,
        idempotencyKey: dto.idempotencyKey,
        expectedDealVersion: dto.expectedVersion,
      });
      return this.commandReceipt(actionId, dto, result as Record<string, unknown>);
    }

    if (actionId === 'request_release') {
      const result = await this.settlement.requestRelease(dealId, user, {
        commandId: dto.commandId,
        idempotencyKey: dto.idempotencyKey,
        expectedDealVersion: dto.expectedVersion,
        amountKopecks: dto.payload?.amountKopecks as string | number | bigint | undefined,
        beneficiaryId: dto.payload?.beneficiaryId as string | undefined,
        partnerId: dto.payload?.partnerId as string | undefined,
      });
      return this.commandReceipt(actionId, dto, result as Record<string, unknown>);
    }

    if (actionId === 'confirm_reserve' || actionId === 'confirm_release') {
      throw new ForbiddenException({
        code: 'VERIFIED_BANK_CALLBACK_REQUIRED',
        actionId,
      });
    }

    return super.execute(dealId, actionId, dto, user);
  }

  private async findDurableReplay(
    dealId: string,
    actionId: 'request_reserve' | 'request_release',
    dto: ExecuteDealCommandDto,
    user: RequestUser,
  ) {
    const receipt = await this.settlementRls.withTrustedContext(user, (tx) =>
      tx.outboxEntry.findUnique({
        where: { idempotencyKey: `settlement-receipt:${dto.idempotencyKey}` },
      }),
    );
    if (!receipt) return null;
    if (receipt.dealId !== dealId) {
      throw new ConflictException({ code: 'SETTLEMENT_COMMAND_REPLAY_SCOPE_MISMATCH' });
    }

    const payload = receipt.payload as { result?: Record<string, unknown> };
    const result = payload?.result;
    if (!result) {
      throw new ConflictException({ code: 'SETTLEMENT_COMMAND_RECEIPT_INVALID' });
    }

    const expectedOperation = actionId === 'request_reserve' ? 'RESERVE' : 'RELEASE';
    const suppliedAmount = dto.payload?.amountKopecks;
    const suppliedBeneficiary = dto.payload?.beneficiaryId;
    const conflicts =
      result.operation !== expectedOperation
      || result.commandId !== dto.commandId
      || (suppliedAmount !== undefined && String(suppliedAmount) !== String(result.amountKopecks))
      || (suppliedBeneficiary !== undefined && suppliedBeneficiary !== result.beneficiaryId);
    if (conflicts) {
      throw new ConflictException({ code: 'SETTLEMENT_COMMAND_REPLAY_MISMATCH' });
    }

    return this.commandReceipt(actionId, dto, { ...result, duplicate: true });
  }

  private commandReceipt(
    actionId: string,
    dto: ExecuteDealCommandDto,
    result: Record<string, unknown>,
  ) {
    return {
      ...result,
      actionId,
      commandId: dto.commandId,
      idempotencyKey: dto.idempotencyKey,
      duplicate: Boolean(result.duplicate),
    };
  }
}
