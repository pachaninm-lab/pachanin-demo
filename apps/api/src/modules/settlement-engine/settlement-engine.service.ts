import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { RequestUser } from '../../common/types/request-user';
import { SettlementAccessService } from './settlement-access.service';
import {
  type ConfigureSettlementTermsInput,
  type PlaceSettlementHoldInput,
  type ReconcileSettlementOperationInput,
  type ReleaseSettlementHoldInput,
  type RequestSettlementOperationInput,
  SettlementPostgresqlRepository,
  type VerifiedSettlementCallbackInput,
} from './settlement-postgresql.repository';

export type SettlementCommandEnvelope = Readonly<{
  commandId?: string;
  idempotencyKey?: string;
  expectedPaymentVersion?: string | number | bigint;
  expectedDealVersion?: string | number | bigint;
}>;

export type SettlementReleaseRequest = SettlementCommandEnvelope & Readonly<{
  amountKopecks?: string | number | bigint;
  beneficiaryId?: string;
  partnerId?: string;
}>;

export type SettlementRefundRequest = SettlementCommandEnvelope & Readonly<{
  amountKopecks: string | number | bigint;
  partnerId?: string;
}>;

const FAIL_CLOSED_ACCESS = {
  async assertDealAccess(): Promise<never> {
    throw new ForbiddenException({ code: 'SETTLEMENT_ACCESS_SERVICE_REQUIRED' });
  },
  async assertPaymentAccess(): Promise<never> {
    throw new ForbiddenException({ code: 'SETTLEMENT_ACCESS_SERVICE_REQUIRED' });
  },
  async filterReadablePayments(): Promise<never> {
    throw new ForbiddenException({ code: 'SETTLEMENT_ACCESS_SERVICE_REQUIRED' });
  },
} as unknown as SettlementAccessService;

@Injectable()
export class SettlementEngineService {
  constructor(
    private readonly repository: SettlementPostgresqlRepository,
    private readonly access: SettlementAccessService = FAIL_CLOSED_ACCESS,
  ) {}

  async listPayments(user: RequestUser) {
    const rows = await this.repository.listPayments(user) as Array<{ dealId?: unknown }>;
    return this.access.filterReadablePayments(rows, user);
  }

  async getPayment(paymentId: string, user: RequestUser) {
    await this.access.assertPaymentAccess(paymentId, user, false);
    return this.repository.paymentDetail(paymentId, user);
  }

  async getWorksheet(dealId: string, user: RequestUser) {
    await this.access.assertDealAccess(dealId, user, false);
    return this.repository.worksheet(dealId, user);
  }

  async getBankWorkspace(dealId: string, user: RequestUser) {
    await this.access.assertDealAccess(dealId, user, false);
    return this.repository.bankWorkspace(dealId, user);
  }

  async getOutboxStatus(dealId: string | undefined, user: RequestUser) {
    if (dealId) await this.access.assertDealAccess(dealId, user, false);
    return this.repository.outboxStatus(dealId, user);
  }

  async configureTerms(input: ConfigureSettlementTermsInput, user: RequestUser) {
    await this.access.assertDealAccess(input.dealId, user, true);
    return this.repository.configureTerms(input, user);
  }

  async requestReserve(
    dealId: string,
    user: RequestUser,
    input: SettlementCommandEnvelope = {},
  ) {
    await this.access.assertDealAccess(dealId, user, true);
    const envelope = this.envelope('reserve', dealId, user, input);
    return this.executeOperation(() => this.repository.requestOperation({
      ...envelope,
      dealId,
      operation: 'RESERVE',
    }, user));
  }

  async requestRelease(
    dealId: string,
    user: RequestUser,
    input: SettlementReleaseRequest = {},
  ) {
    await this.access.assertDealAccess(dealId, user, true);
    const envelope = this.envelope('release', dealId, user, input);
    let beneficiaryId = input.beneficiaryId;
    let amountKopecks = input.amountKopecks;

    if (!beneficiaryId || amountKopecks === undefined) {
      const workspace = await this.repository.worksheet(dealId, user) as Record<string, any>;
      const beneficiaries = Array.isArray(workspace.beneficiaries)
        ? workspace.beneficiaries as Array<Record<string, unknown>>
        : [];
      const seller = beneficiaries.find((item) => item.role === 'SELLER') ?? beneficiaries[0];
      beneficiaryId ??= typeof seller?.id === 'string' ? seller.id : undefined;
      amountKopecks ??= workspace.availableKopecks as string | number | bigint | undefined;
    }

    if (!beneficiaryId) {
      throw new ConflictException({ code: 'SETTLEMENT_BENEFICIARY_REQUIRED' });
    }
    if (amountKopecks === undefined) {
      throw new ConflictException({ code: 'SETTLEMENT_AVAILABLE_AMOUNT_REQUIRED' });
    }

    return this.executeOperation(() => this.repository.requestOperation({
      ...envelope,
      dealId,
      operation: 'RELEASE',
      amountKopecks,
      beneficiaryId,
      partnerId: input.partnerId,
    }, user));
  }

  async requestRefund(dealId: string, user: RequestUser, input: SettlementRefundRequest) {
    if (!input || input.amountKopecks === undefined) {
      throw new BadRequestException({ code: 'REFUND_AMOUNT_REQUIRED' });
    }
    await this.access.assertDealAccess(dealId, user, true);
    const envelope = this.envelope('refund', dealId, user, input);
    return this.executeOperation(() => this.repository.requestOperation({
      ...envelope,
      dealId,
      operation: 'REFUND',
      amountKopecks: input.amountKopecks,
      partnerId: input.partnerId,
    }, user));
  }

  async placeHold(input: PlaceSettlementHoldInput, user: RequestUser) {
    await this.access.assertDealAccess(input.dealId, user, true);
    return this.repository.placeHold(input, user);
  }

  async releaseHold(input: ReleaseSettlementHoldInput, user: RequestUser) {
    await this.access.assertDealAccess(input.dealId, user, true);
    return this.repository.releaseHold(input, user);
  }

  async reconcileOperation(input: ReconcileSettlementOperationInput, user: RequestUser) {
    await this.access.assertDealAccess(input.dealId, user, true);
    return this.repository.reconcileOperation(input, user);
  }

  registerBankCallback(input: VerifiedSettlementCallbackInput) {
    return this.executeOperation(() => this.repository.registerVerifiedCallback(input));
  }

  confirmWorksheet(): never {
    throw new ForbiddenException({ code: 'VERIFIED_BANK_CALLBACK_REQUIRED' });
  }

  releasePayment(): never {
    throw new ForbiddenException({ code: 'VERIFIED_BANK_CALLBACK_REQUIRED' });
  }

  adjustWorksheet(): never {
    throw new ForbiddenException({ code: 'MANUAL_MONEY_ADJUSTMENT_FORBIDDEN' });
  }

  importStatement(): never {
    throw new ForbiddenException({
      code: 'USE_POSTGRESQL_RECONCILIATION_PATH',
      message: 'Statement evidence must be imported by the PostgreSQL reconciliation service.',
    });
  }

  replayOutbox(): never {
    throw new ForbiddenException({
      code: 'DURABLE_OUTBOX_WORKER_REQUIRED',
      message: 'Outbox replay is lease-driven from PostgreSQL and cannot be triggered as a memory retry.',
    });
  }

  private async executeOperation<T>(factory: () => Promise<T>): Promise<T> {
    try {
      return await factory();
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      const code = String((error as { code?: unknown })?.code ?? '');
      const metaCode = String(
        ((error as { meta?: { code?: unknown } })?.meta?.code) ?? '',
      );
      const message = String((error as { message?: unknown })?.message ?? '').toLowerCase();
      if (
        ['P2002', 'P2010', 'P2034', '40001', '40P01'].includes(code)
        || ['23505', '23514', '40001', '40P01'].includes(metaCode)
        || /could not serialize|serialization failure|write conflict|deadlock|concurrent|exact pending settlement operation/.test(message)
      ) {
        throw new ConflictException({ code: 'CONCURRENT_SETTLEMENT_OPERATION' });
      }
      throw error;
    }
  }

  private envelope(
    kind: string,
    dealId: string,
    user: RequestUser,
    input: SettlementCommandEnvelope,
  ): Pick<
    RequestSettlementOperationInput,
    'commandId' | 'idempotencyKey' | 'expectedPaymentVersion' | 'expectedDealVersion'
  > {
    const deterministic = `settlement-${kind}:${dealId}:${user.id}`;
    return {
      commandId: input.commandId ?? `${deterministic}:${randomUUID()}`,
      idempotencyKey: input.idempotencyKey ?? deterministic,
      expectedPaymentVersion: input.expectedPaymentVersion,
      expectedDealVersion: input.expectedDealVersion,
    };
  }
}
