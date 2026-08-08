import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../../common/types/request-user';
import type {
  AcceptFgisCommodityPartySnapshotInput,
  BindFgisCommodityConnectionInput,
  CreateFgisLotPassportInput,
  FgisCommodityCommandReceipt,
  OpenFgisCommodityReconciliationCaseInput,
  ReserveFgisCommodityVolumeInput,
  SealFgisLotPassportInput,
  StartFgisCommoditySyncRunInput,
  TransitionFgisCommodityReservationInput,
} from './fgis-grain-commodity-authority.contract';

const SERIALIZABLE = Object.freeze({
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxConflictRetries: 5,
  timeout: 30_000,
});

type CommandRow = Readonly<{ result: Prisma.JsonValue }>;

function commandReceipt(rows: readonly CommandRow[]): FgisCommodityCommandReceipt {
  const value = rows[0]?.result;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceUnavailableException({
      code: 'FGIS_COMMODITY_COMMAND_RECEIPT_INVALID',
      retryable: false,
    });
  }
  const receipt = value as Record<string, unknown>;
  if (typeof receipt.ok !== 'boolean' || typeof receipt.auditId !== 'string') {
    throw new ServiceUnavailableException({
      code: 'FGIS_COMMODITY_COMMAND_RECEIPT_INVALID',
      retryable: false,
    });
  }
  return Object.freeze({ ...receipt }) as FgisCommodityCommandReceipt;
}

@Injectable()
export class FgisGrainCommodityAuthorityRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async bindConnection(
    user: RequestUser,
    input: BindFgisCommodityConnectionInput,
  ): Promise<FgisCommodityCommandReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx) =>
        commandReceipt(
          await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT fgis_commodity.bind_organization_connection(
              ${input.providerConfigurationId},
              ${BigInt(input.expectedVersion)},
              ${input.commandId},
              ${input.idempotencyKey},
              ${input.correlationId}
            ) AS result
          `),
        ),
      SERIALIZABLE,
    );
  }

  async startSyncRun(
    user: RequestUser,
    input: StartFgisCommoditySyncRunInput,
  ): Promise<FgisCommodityCommandReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx) =>
        commandReceipt(
          await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT fgis_commodity.start_sync_run(
              ${input.connectionId},
              ${input.operationCode},
              ${input.recordsModifiedFrom ? new Date(input.recordsModifiedFrom) : null}::timestamptz,
              ${input.pageCursor ?? null},
              ${BigInt(input.expectedConnectionVersion)},
              ${input.commandId},
              ${input.idempotencyKey},
              ${input.correlationId}
            ) AS result
          `),
        ),
      SERIALIZABLE,
    );
  }

  async acceptPartySnapshot(
    user: RequestUser,
    input: AcceptFgisCommodityPartySnapshotInput,
  ): Promise<FgisCommodityCommandReceipt> {
    const snapshot = JSON.stringify(input.snapshot);
    return this.transactions.withTrustedContext(
      user,
      async (tx) =>
        commandReceipt(
          await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT fgis_commodity.accept_party_snapshot_verified(
              ${input.connectionId},
              ${input.syncRunId},
              ${snapshot}::jsonb,
              ${BigInt(input.expectedCurrentVersion)},
              ${input.commandId},
              ${input.idempotencyKey},
              ${input.correlationId}
            ) AS result
          `),
        ),
      SERIALIZABLE,
    );
  }

  async reserveVolume(
    user: RequestUser,
    input: ReserveFgisCommodityVolumeInput,
  ): Promise<FgisCommodityCommandReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx) =>
        commandReceipt(
          await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT fgis_commodity.reserve_volume(
              ${input.partyCurrentId},
              ${input.sourceSnapshotId},
              ${input.volume}::numeric,
              ${input.unit},
              ${input.reason},
              ${new Date(input.expiresAt)}::timestamptz,
              ${BigInt(input.expectedPartyVersion)},
              ${input.commandId},
              ${input.idempotencyKey},
              ${input.correlationId}
            ) AS result
          `),
        ),
      SERIALIZABLE,
    );
  }

  async transitionReservation(
    user: RequestUser,
    input: TransitionFgisCommodityReservationInput,
  ): Promise<FgisCommodityCommandReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx) =>
        commandReceipt(
          await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT fgis_commodity.transition_reservation(
              ${input.reservationId},
              ${input.targetStatus},
              ${input.reason},
              ${input.dealId ?? null},
              ${BigInt(input.expectedVersion)},
              ${input.commandId},
              ${input.idempotencyKey},
              ${input.correlationId}
            ) AS result
          `),
        ),
      SERIALIZABLE,
    );
  }

  async createLotPassport(
    user: RequestUser,
    input: CreateFgisLotPassportInput,
  ): Promise<FgisCommodityCommandReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx) =>
        commandReceipt(
          await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT fgis_commodity.create_lot_passport(
              ${input.reservationId},
              ${input.commandId},
              ${input.idempotencyKey},
              ${input.correlationId}
            ) AS result
          `),
        ),
      SERIALIZABLE,
    );
  }

  async sealLotPassport(
    user: RequestUser,
    input: SealFgisLotPassportInput,
  ): Promise<FgisCommodityCommandReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx) =>
        commandReceipt(
          await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT fgis_commodity.seal_lot_passport(
              ${input.passportId},
              ${BigInt(input.expectedVersion)},
              ${input.commandId},
              ${input.idempotencyKey},
              ${input.correlationId}
            ) AS result
          `),
        ),
      SERIALIZABLE,
    );
  }

  async openReconciliationCase(
    user: RequestUser,
    input: OpenFgisCommodityReconciliationCaseInput,
  ): Promise<FgisCommodityCommandReceipt> {
    const expectedState = JSON.stringify(input.expectedState);
    const actualState = JSON.stringify(input.actualState);
    return this.transactions.withTrustedContext(
      user,
      async (tx) =>
        commandReceipt(
          await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT fgis_commodity.open_reconciliation_case(
              ${input.partyCurrentId},
              ${input.previousSnapshotId ?? null},
              ${input.actualSnapshotId},
              ${input.reservationId ?? null},
              ${input.lotId ?? null},
              ${input.severity},
              ${input.reasonCode},
              ${expectedState}::jsonb,
              ${actualState}::jsonb,
              ${input.ownerUserId ?? null},
              ${input.commandId},
              ${input.idempotencyKey},
              ${input.correlationId}
            ) AS result
          `),
        ),
      SERIALIZABLE,
    );
  }
}
