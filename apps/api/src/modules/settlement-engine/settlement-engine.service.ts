import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { Role } from '../../common/types/request-user';
import { BankReconciliationService } from '../bank-reconciliation/bank-reconciliation.service';
import { IndustrialDealCommandGateway } from '../deals/industrial-deal-command.gateway';
import type { ExecuteDealCommandDto } from '../deals/dto/execute-deal-command.dto';
import { PAYMENT_REPOSITORY, type PaymentRepository } from './payment.repository';

const MONEY_REQUEST_ROLES = new Set<Role>([
  Role.ADMIN,
  Role.ACCOUNTING,
]);

@Injectable()
export class SettlementEngineService {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    private readonly industrialCommands: IndustrialDealCommandGateway,
    private readonly reconciliation: BankReconciliationService,
  ) {}

  worksheet(dealId: string, user: RequestUser) {
    return this.payments.worksheet(dealId, user);
  }

  bankWorkspace(dealId: string, user: RequestUser) {
    return this.payments.bankWorkspace(dealId, user);
  }

  listPayments(user: RequestUser) {
    return this.payments.list(user);
  }

  paymentDetail(id: string, user: RequestUser) {
    return this.payments.detail(id, user);
  }

  exportDeals(
    params: { format?: string; from?: string; to?: string },
    user: RequestUser,
  ) {
    return this.payments.exportDeals(params, user);
  }

  exportContractors(user: RequestUser) {
    return this.payments.exportContractors(user);
  }

  /**
   * Creates the canonical reserve request. The payment remains pending until a
   * verified bank callback executes `confirm_reserve`.
   */
  requestReserve(dealId: string, command: ExecuteDealCommandDto, user: RequestUser) {
    this.assertMoneyRequestRole(user);
    return this.industrialCommands.executeUser(
      dealId,
      'request_reserve',
      normalizeCommand(command),
      user,
    );
  }

  /**
   * Creates the canonical release request. No human or platform operator can
   * convert the request into a confirmed payout.
   */
  requestRelease(dealId: string, command: ExecuteDealCommandDto, user: RequestUser) {
    this.assertMoneyRequestRole(user);
    return this.industrialCommands.executeUser(
      dealId,
      'request_release',
      normalizeCommand(command),
      user,
    );
  }

  /** Manual bank confirmation is structurally absent from the settlement service. */
  confirmWorksheet(): never {
    throw new UnauthorizedException(
      'Money state can only be confirmed by a verified bank callback.',
    );
  }

  /** Manual payout is structurally absent from the settlement service. */
  releasePayment(): never {
    throw new UnauthorizedException(
      'Money state can only be confirmed by a verified bank callback.',
    );
  }

  /**
   * Free-form monetary adjustment is blocked until the versioned payment-terms
   * command is accepted. Silently mutating the amount would split authority.
   */
  adjustWorksheet(_dealId: string, _adjustments: unknown[], _user: RequestUser): never {
    throw new ConflictException({
      code: 'VERSIONED_PAYMENT_TERMS_REQUIRED',
      message: 'Изменение суммы допускается только через версионированное основание расчёта.',
    });
  }

  importBankStatement(content: string, format: string, user: RequestUser) {
    const normalizedFormat = String(format ?? '').trim().toUpperCase();
    if (normalizedFormat !== 'MT940') {
      throw new BadRequestException({
        code: 'UNSUPPORTED_BANK_STATEMENT_FORMAT',
        supported: ['MT940'],
      });
    }
    return this.reconciliation.importMT940(content, user);
  }

  getOutboxStatus(dealId: string | undefined, user: RequestUser) {
    return this.payments.outboxStatus(dealId, user);
  }

  private assertMoneyRequestRole(user: RequestUser): void {
    if (!MONEY_REQUEST_ROLES.has(user.role)) {
      throw new ForbiddenException({
        code: 'MONEY_REQUEST_ROLE_DENIED',
        allowed: [...MONEY_REQUEST_ROLES],
      });
    }
  }
}

function normalizeCommand(command: ExecuteDealCommandDto): ExecuteDealCommandDto {
  const commandId = requiredText(command?.commandId, 'commandId', 8, 128);
  const idempotencyKey = requiredText(command?.idempotencyKey, 'idempotencyKey', 8, 200);
  const expectedUpdatedAt = requiredIso(command?.expectedUpdatedAt, 'expectedUpdatedAt');
  const expectedVersion = command?.expectedVersion === undefined
    ? undefined
    : requiredUnsignedInteger(command.expectedVersion, 'expectedVersion');
  const payload = command?.payload && typeof command.payload === 'object' && !Array.isArray(command.payload)
    ? command.payload as Prisma.InputJsonObject
    : undefined;
  return {
    commandId,
    idempotencyKey,
    expectedUpdatedAt,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(payload === undefined ? {} : { payload }),
  };
}

function requiredText(
  value: unknown,
  field: string,
  min: number,
  max: number,
): string {
  const normalized = String(value ?? '').trim();
  if (normalized.length < min || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_SETTLEMENT_COMMAND_FIELD', field });
  }
  return normalized;
}

function requiredIso(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  const parsed = new Date(normalized);
  if (!normalized || Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({ code: 'INVALID_SETTLEMENT_COMMAND_FIELD', field });
  }
  return parsed.toISOString();
}

function requiredUnsignedInteger(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_SETTLEMENT_COMMAND_FIELD', field });
  }
  return normalized;
}
