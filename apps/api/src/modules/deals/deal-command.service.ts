import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { ExecuteDealCommandDto } from './dto/execute-deal-command.dto';
import {
  buildDealSpine,
  getCurrentDealAction,
  getDealActionDefinition,
  isDealActionId,
  type DealActionDefinition,
  type DealActionId,
} from './deal-command.policy';

const CANONICAL_ROLES = new Set([
  'FARMER',
  'BUYER',
  'LOGISTICIAN',
  'DRIVER',
  'SURVEYOR',
  'LAB',
  'ELEVATOR',
  'ACCOUNTING',
  'EXECUTIVE',
  'SUPPORT_MANAGER',
  'ADMIN',
  'COMPLIANCE_OFFICER',
  'ARBITRATOR',
  'BANK_CALLBACK',
]);

const ROLE_FOCUS: Record<string, string> = {
  FARMER: 'Цена, договор, документы и отгрузка',
  BUYER: 'Условия, резерв, приёмка и расчёт',
  LOGISTICIAN: 'Назначение перевозки и контроль рейса',
  DRIVER: 'Один активный рейс и фиксация физических фактов',
  SURVEYOR: 'Независимый осмотр и доказательства',
  ELEVATOR: 'Прибытие, вес и акт приёмки',
  LAB: 'Проба, показатели качества и протокол',
  ACCOUNTING: 'Запросы резерва и выплаты без права подтверждения банка',
  COMPLIANCE_OFFICER: 'Допуск участников и контроль риска',
  ARBITRATOR: 'Доказательства и готовность к спору',
  SUPPORT_MANAGER: 'Блокеры, SLA и сквозное исполнение',
  EXECUTIVE: 'Портфельный контроль без изменения сделки',
  ADMIN: 'Администрирование и аварийное восстановление',
  BANK_CALLBACK: 'Подтверждённое системное событие банка',
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  );
}

function toNumber(value: bigint | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/**
 * Deep-converts bigint database values (versions, kopeck amounts) into JSON-safe
 * numbers at the read-projection boundary. Money arithmetic stays bigint-only on
 * the server; this conversion exists solely for display projections.
 */
function jsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return Number(value) as unknown as T;
  if (Array.isArray(value)) return value.map(jsonSafe) as unknown as T;
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, jsonSafe(item)]),
    ) as unknown as T;
  }
  return value;
}

function requiredBankReference(payload: Record<string, unknown>): string {
  const value = typeof payload.bankRef === 'string' ? payload.bankRef.trim() : '';
  if (value.length < 4) {
    throw new BadRequestException({
      code: 'BANK_REFERENCE_REQUIRED',
      message: 'Bank confirmation requires a verified bank reference.',
    });
  }
  return value;
}

@Injectable()
export class DealCommandService {
  constructor(private readonly rls: RlsTransactionService) {}

  async workspace(dealId: string, user: RequestUser) {
    this.assertTrustedIdentity(user);

    return this.rls.withTrustedContext(user, async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: {
          shipments: { include: { checkpoints: { orderBy: { completedAt: 'asc' } } } },
          documents: { orderBy: [{ type: 'asc' }, { version: 'desc' }] },
          payments: { orderBy: { createdAt: 'desc' } },
          labSamples: { include: { tests: true }, orderBy: { createdAt: 'desc' } },
          dealEvents: { orderBy: { createdAt: 'asc' } },
          acceptanceRecords: { orderBy: { createdAt: 'desc' } },
          bankOperations: { orderBy: { createdAt: 'asc' } },
          runtimeSnapshots: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!deal) throw new NotFoundException(`Deal ${dealId} not found`);
      this.assertDealTenant(deal.tenantId, user);

      const disputes = await tx.dispute.findMany({
        where: { dealId },
        include: { moneyHold: true, evidence: true },
        orderBy: { createdAt: 'desc' },
      });
      const current = getCurrentDealAction(deal.status);
      const canAct = Boolean(current?.roles.includes(String(user.role)) && current.source !== 'BANK_CALLBACK');
      const payment = deal.payments[0] ?? null;
      const openDispute = disputes.find((item) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(item.status)) ?? null;

      return jsonSafe({
        deal: {
          id: deal.id,
          number: deal.dealNumber,
          status: deal.status,
          version: toNumber(deal.version),
          updatedAt: deal.updatedAt.toISOString(),
          sellerOrgId: deal.sellerOrgId,
          buyerOrgId: deal.buyerOrgId,
          culture: deal.culture,
          cropClass: deal.cropClass,
          volumeTons: deal.volumeTons,
          pricePerTon: deal.pricePerTon,
          totalKopecks: toNumber(deal.totalKopecks),
          currency: deal.currency,
          closedAt: deal.closedAt?.toISOString() ?? null,
        },
        roleProjection: {
          role: user.role,
          focus: ROLE_FOCUS[String(user.role)] ?? 'Текущий этап и безопасное следующее действие',
          canAct,
          primaryAction: current
            ? {
                id: current.id,
                label: current.label,
                source: current.source ?? 'USER',
                enabled: canAct,
                waitingForRoles: current.roles,
              }
            : null,
        },
        attention: current
          ? current.source === 'BANK_CALLBACK'
            ? 'Ожидается подписанное подтверждение банка.'
            : canAct
              ? `Требуется действие: ${current.label}`
              : `Ожидается действие роли: ${current.roles.join(', ')}`
          : deal.status === 'CLOSED'
            ? 'Сделка закрыта. Доказательный и денежный контуры завершены.'
            : 'Для текущего статуса не определено безопасное действие.',
        blockers: [
          ...(openDispute ? [`Открыт спор ${openDispute.id}`] : []),
          ...(payment?.status === 'FAILED' ? ['Банковская операция завершилась ошибкой'] : []),
        ],
        money: payment
          ? {
              id: payment.id,
              status: payment.status,
              amountKopecks: toNumber(payment.amountKopecks),
              holdAmountKopecks: toNumber(payment.holdAmountKopecks),
              refundedKopecks: toNumber(payment.refundedKopecks),
              commissionKopecks: toNumber(payment.commissionKopecks),
              callbackState: payment.callbackState,
              bankRef: payment.bankRef,
            }
          : null,
        spine: buildDealSpine(deal.status),
        shipments: deal.shipments,
        documents: deal.documents,
        laboratory: deal.labSamples,
        acceptance: deal.acceptanceRecords,
        disputes,
        bankOperations: deal.bankOperations.map((operation) => ({
          ...operation,
          amountKopecks: toNumber(operation.amountKopecks),
        })),
        timeline: deal.dealEvents,
        persistence: deal.runtimeSnapshots[0] ?? null,
      });
    });
  }

  async execute(
    dealId: string,
    rawActionId: string,
    dto: ExecuteDealCommandDto,
    user: RequestUser,
  ) {
    this.assertTrustedIdentity(user);
    if (!isDealActionId(rawActionId)) {
      throw new BadRequestException(`Unknown deal action: ${rawActionId}`);
    }

    const actionId = rawActionId as DealActionId;
    const definition = getDealActionDefinition(actionId);
    this.assertActionRole(definition, user);
    const receiptKey = this.receiptKey(dealId, dto.idempotencyKey);

    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx) => {
          // Per-deal serialization: an advisory transaction lock orders all
          // commands of ONE deal while deals stay fully parallel. This is what
          // the hash chains and CAS need — global Serializable isolation would
          // create false cross-deal conflicts through index predicate locks
          // and collapse throughput under load.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dealId}, 42)) IS NULL AS locked`;

          const replay = await tx.outboxEntry.findUnique({ where: { idempotencyKey: receiptKey } });
          if (replay) return this.resultFromReceipt(replay.payload);

          const deal = await tx.deal.findUnique({ where: { id: dealId } });
          if (!deal) throw new NotFoundException(`Deal ${dealId} not found`);
          this.assertDealTenant(deal.tenantId, user);

          if (deal.status !== definition.from) {
            throw new ConflictException({
              code: 'DEAL_STATE_CONFLICT',
              message: `Action ${actionId} requires status ${definition.from}; current status is ${deal.status}`,
              currentStatus: deal.status,
              expectedStatus: definition.from,
              currentUpdatedAt: deal.updatedAt.toISOString(),
            });
          }
          const currentVersion = BigInt(deal.version ?? 0);
          if (deal.updatedAt.toISOString() !== dto.expectedUpdatedAt) {
            throw new ConflictException({
              code: 'STALE_DEAL_VERSION',
              message: 'Deal changed after the screen was loaded. Refresh and repeat the action.',
              currentStatus: deal.status,
              currentUpdatedAt: deal.updatedAt.toISOString(),
              currentVersion: Number(currentVersion),
            });
          }
          if (dto.expectedVersion !== undefined && BigInt(dto.expectedVersion) !== currentVersion) {
            throw new ConflictException({
              code: 'STALE_DEAL_VERSION',
              message: 'Deal changed after the screen was loaded. Refresh and repeat the action.',
              currentStatus: deal.status,
              currentUpdatedAt: deal.updatedAt.toISOString(),
              currentVersion: Number(currentVersion),
            });
          }

          await this.applySideEffects(tx, definition, deal, dto.payload ?? {}, user);

          const next = getCurrentDealAction(definition.to);
          const update = await tx.deal.updateMany({
            where: { id: deal.id, status: definition.from, updatedAt: deal.updatedAt, version: currentVersion },
            data: {
              status: definition.to,
              nextAction: next?.label ?? null,
              version: { increment: 1 },
              ...(definition.to === 'CLOSED' ? { closedAt: new Date() } : {}),
            },
          });
          if (update.count !== 1) {
            throw new ConflictException({
              code: 'CONCURRENT_DEAL_UPDATE',
              message: 'Another command changed the deal concurrently. No partial changes were committed.',
            });
          }

          const updatedDeal = await tx.deal.findUniqueOrThrow({ where: { id: deal.id } });
          const event = await this.appendDealEvent(tx, {
            dealId: deal.id,
            eventType: actionId.toUpperCase(),
            actorId: user.id,
            actorRole: String(user.role),
            tenantId: user.tenantId,
            payload: {
              commandId: dto.commandId,
              idempotencyKey: dto.idempotencyKey,
              actionId,
              from: definition.from,
              to: definition.to,
              payload: dto.payload ?? {},
              resultingUpdatedAt: updatedDeal.updatedAt.toISOString(),
            },
          });
          const audit = await this.appendAudit(tx, {
            dealId: deal.id,
            actorUserId: user.id,
            actorRole: String(user.role),
            tenantId: user.tenantId,
            orgId: user.orgId,
            action: `deal.command.${actionId}`,
            objectType: 'deal',
            objectId: deal.id,
            beforeState: { status: definition.from, updatedAt: deal.updatedAt.toISOString() },
            afterState: { status: definition.to, updatedAt: updatedDeal.updatedAt.toISOString() },
            metadata: {
              commandId: dto.commandId,
              idempotencyKey: dto.idempotencyKey,
              eventId: event.id,
              sessionId: user.sessionId,
            },
          });

          let externalOutboxId: string | null = null;
          if (definition.externalOperation) {
            const external = await tx.outboxEntry.upsert({
              where: { idempotencyKey: `external:${deal.id}:${actionId}:${dto.commandId}` },
              update: {},
              create: {
                type: definition.externalOperation,
                dealId: deal.id,
                status: 'PENDING',
                idempotencyKey: `external:${deal.id}:${actionId}:${dto.commandId}`,
                correlationId: dto.commandId,
                auditId: audit.id,
                payload: {
                  dealId: deal.id,
                  actionId,
                  commandId: dto.commandId,
                  // JSON payloads carry money as exact integer strings, never floats.
                  amountKopecks: BigInt(deal.totalKopecks ?? 0).toString(),
                },
              },
            });
            externalOutboxId = external.id;
          }

          const result = {
            ok: true,
            duplicate: false,
            commandId: dto.commandId,
            idempotencyKey: dto.idempotencyKey,
            dealId: deal.id,
            actionId,
            previousStatus: definition.from,
            status: definition.to,
            updatedAt: updatedDeal.updatedAt.toISOString(),
            version: toNumber(updatedDeal.version),
            eventId: event.id,
            auditId: audit.id,
            externalOutboxId,
          };
          await tx.outboxEntry.create({
            data: {
              type: 'deal.command.receipt',
              dealId: deal.id,
              status: 'CONFIRMED',
              idempotencyKey: receiptKey,
              correlationId: dto.commandId,
              auditId: audit.id,
              confirmedAt: new Date(),
              payload: { result },
            },
          });
          return result;
        },
        // ReadCommitted + per-deal advisory lock: the lock provides the only
        // ordering the pipeline needs; CAS on version still rejects any writer
        // that bypassed the command path.
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const replay = await this.rls.withTrustedContext(user, async (tx) => {
          const receipt = await tx.outboxEntry.findUnique({ where: { idempotencyKey: receiptKey } });
          return receipt ? this.resultFromReceipt(receipt.payload) : null;
        });
        if (replay) return { ...replay, duplicate: true };
      }
      throw error;
    }
  }

  private receiptKey(dealId: string, idempotencyKey: string): string {
    return `deal-command:${dealId}:${idempotencyKey}`;
  }

  private resultFromReceipt(payload: Prisma.JsonValue) {
    const result = (payload as { result?: Record<string, unknown> } | null)?.result;
    if (!result) throw new ConflictException('Stored command receipt is incomplete');
    return { ...result, duplicate: true };
  }

  private assertTrustedIdentity(user: RequestUser): void {
    if (!CANONICAL_ROLES.has(String(user.role))) {
      throw new ForbiddenException('Role is not part of the canonical deal execution model.');
    }
    if (!user.id || !user.orgId || !user.tenantId || !user.sessionId) {
      throw new ForbiddenException({ code: 'TRUSTED_CONTEXT_REQUIRED' });
    }
  }

  private assertDealTenant(dealTenantId: string | null, user: RequestUser): void {
    if (!dealTenantId || dealTenantId !== user.tenantId) {
      throw new ForbiddenException({ code: 'TENANT_SCOPE_DENIED' });
    }
  }

  private assertActionRole(definition: DealActionDefinition, user: RequestUser): void {
    if (!definition.roles.includes(String(user.role))) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED_FOR_DEAL_ACTION',
        message: `Role ${user.role} cannot execute ${definition.id}`,
        allowedRoles: definition.roles,
      });
    }
  }

  private async applySideEffects(
    tx: Prisma.TransactionClient,
    definition: DealActionDefinition,
    deal: { id: string; totalKopecks: bigint | number | null; sellerOrgId: string; buyerOrgId: string },
    payload: Record<string, unknown>,
    user: RequestUser,
  ): Promise<void> {
    // Money stays integer kopecks end-to-end: bigint from the deal row, BIGINT columns below.
    const amountKopecks = BigInt(deal.totalKopecks ?? 0);

    switch (definition.id) {
      case 'seller_sign_contract':
        await tx.dealDocument.upsert({
          where: { id: `contract:${deal.id}` },
          update: {
            status: 'SIGNING',
            signatories: JSON.stringify([{ userId: user.id, role: user.role, signedAt: new Date().toISOString() }]),
          },
          create: {
            id: `contract:${deal.id}`,
            dealId: deal.id,
            type: 'CONTRACT',
            status: 'SIGNING',
            name: 'Договор поставки',
            signatories: JSON.stringify([{ userId: user.id, role: user.role, signedAt: new Date().toISOString() }]),
            bankRequired: true,
            releaseRequired: true,
          },
        });
        break;

      case 'buyer_sign_contract': {
        const contract = await tx.dealDocument.findUnique({ where: { id: `contract:${deal.id}` } });
        const signatories = contract?.signatories ? JSON.parse(contract.signatories) : [];
        signatories.push({ userId: user.id, role: user.role, signedAt: new Date().toISOString() });
        await tx.dealDocument.upsert({
          where: { id: `contract:${deal.id}` },
          update: { status: 'SIGNED', signedAt: new Date(), signatories: JSON.stringify(signatories), isImmutable: true, bankAcceptance: 'ACCEPTED' },
          create: {
            id: `contract:${deal.id}`,
            dealId: deal.id,
            type: 'CONTRACT',
            status: 'SIGNED',
            name: 'Договор поставки',
            signedAt: new Date(),
            signatories: JSON.stringify(signatories),
            isImmutable: true,
            bankRequired: true,
            releaseRequired: true,
            bankAcceptance: 'ACCEPTED',
          },
        });
        break;
      }

      case 'request_reserve':
        await tx.payment.upsert({
          where: { id: `payment:${deal.id}` },
          update: { status: 'RESERVE_REQUESTED', amountKopecks, callbackState: 'PENDING' },
          create: { id: `payment:${deal.id}`, dealId: deal.id, status: 'RESERVE_REQUESTED', amountKopecks, callbackState: 'PENDING' },
        });
        await tx.bankOperation.upsert({
          where: { id: `bank-reserve:${deal.id}` },
          update: { status: 'PENDING', requestPayload: payload as Prisma.InputJsonValue },
          create: {
            id: `bank-reserve:${deal.id}`,
            dealId: deal.id,
            type: 'RESERVE',
            status: 'PENDING',
            amountKopecks: BigInt(amountKopecks),
            debitAccount: `buyer:${deal.buyerOrgId}`,
            creditAccount: `escrow:${deal.id}`,
            idempotencyKey: `bank-reserve:${deal.id}`,
            initiatorUserId: user.id,
            requestPayload: payload as Prisma.InputJsonValue,
          },
        });
        break;

      case 'confirm_reserve': {
        const bankRef = requiredBankReference(payload);
        await tx.payment.upsert({
          where: { id: `payment:${deal.id}` },
          update: { status: 'RESERVED', amountKopecks, reservedAt: new Date(), callbackState: 'CONFIRMED', bankRef },
          create: { id: `payment:${deal.id}`, dealId: deal.id, status: 'RESERVED', amountKopecks, reservedAt: new Date(), callbackState: 'CONFIRMED', bankRef },
        });
        await tx.bankOperation.update({
          where: { id: `bank-reserve:${deal.id}` },
          data: { status: 'DONE', confirmedAt: new Date(), bankRef, responsePayload: payload as Prisma.InputJsonValue },
        });
        await tx.ledgerEntry.upsert({
          where: { idempotencyKey: `ledger-reserve:${deal.id}` },
          update: {},
          create: {
            dealId: deal.id,
            entryType: 'RESERVE',
            debitAccount: `buyer:${deal.buyerOrgId}`,
            creditAccount: `escrow:${deal.id}`,
            amountKopecks,
            idempotencyKey: `ledger-reserve:${deal.id}`,
            description: 'Подтверждённый резерв банка',
            createdByUserId: user.id,
          },
        });
        break;
      }

      case 'assign_logistics':
        await tx.shipment.upsert({
          where: { id: `shipment:${deal.id}` },
          update: {
            status: 'DRIVER_ASSIGNED',
            carrierOrgId: String(payload.carrierOrgId ?? user.orgId),
            driverUserId: String(payload.driverUserId ?? 'user-driver-001'),
            driverName: String(payload.driverName ?? 'Тестовый водитель'),
            vehicleNumber: String(payload.vehicleNumber ?? 'А001АА77'),
            routeFrom: String(payload.routeFrom ?? 'Склад продавца'),
            routeTo: String(payload.routeTo ?? 'Элеватор покупателя'),
          },
          create: {
            id: `shipment:${deal.id}`,
            dealId: deal.id,
            status: 'DRIVER_ASSIGNED',
            carrierOrgId: String(payload.carrierOrgId ?? user.orgId),
            driverUserId: String(payload.driverUserId ?? 'user-driver-001'),
            driverName: String(payload.driverName ?? 'Тестовый водитель'),
            vehicleNumber: String(payload.vehicleNumber ?? 'А001АА77'),
            vehicleType: 'TRUCK',
            routeFrom: String(payload.routeFrom ?? 'Склад продавца'),
            routeTo: String(payload.routeTo ?? 'Элеватор покупателя'),
            nextAction: 'Подтвердить погрузку',
          },
        });
        break;

      case 'confirm_loading':
        await tx.shipment.update({ where: { id: `shipment:${deal.id}` }, data: { status: 'LOADED', loadedTons: Number(payload.loadedTons ?? 150), nextAction: 'Начать рейс' } });
        await tx.checkpoint.create({ data: { shipmentId: `shipment:${deal.id}`, type: 'LOADING_CONFIRMED', completedAt: new Date(), actorId: user.id, note: String(payload.note ?? '') } });
        break;

      case 'start_transit':
        await tx.shipment.update({ where: { id: `shipment:${deal.id}` }, data: { status: 'IN_TRANSIT', nextAction: 'Подтвердить прибытие' } });
        await tx.checkpoint.create({ data: { shipmentId: `shipment:${deal.id}`, type: 'DEPARTURE', completedAt: new Date(), actorId: user.id } });
        break;

      case 'confirm_arrival':
        await tx.shipment.update({ where: { id: `shipment:${deal.id}` }, data: { status: 'ARRIVED', nextAction: 'Зафиксировать вес' } });
        await tx.checkpoint.create({ data: { shipmentId: `shipment:${deal.id}`, type: 'ARRIVAL', completedAt: new Date(), actorId: user.id, lat: typeof payload.lat === 'number' ? payload.lat : undefined, lng: typeof payload.lng === 'number' ? payload.lng : undefined } });
        break;

      case 'confirm_weight':
        await tx.acceptanceRecord.upsert({
          where: { id: `acceptance:${deal.id}` },
          update: { status: 'PENDING', weightActualTons: Number(payload.weightActualTons ?? 149.6), actorId: user.id },
          create: { id: `acceptance:${deal.id}`, dealId: deal.id, shipmentId: `shipment:${deal.id}`, status: 'PENDING', weightActualTons: Number(payload.weightActualTons ?? 149.6), qualityStatus: 'PENDING', actorId: user.id },
        });
        break;

      case 'confirm_inspection':
        await tx.dealDocument.upsert({
          where: { id: `inspection:${deal.id}` },
          update: { status: 'SIGNED', signedAt: new Date(), isImmutable: true },
          create: { id: `inspection:${deal.id}`, dealId: deal.id, type: 'INSPECTION_REPORT', status: 'SIGNED', name: 'Заключение независимого осмотра', signedAt: new Date(), uploadedByUserId: user.id, isImmutable: true, releaseRequired: true },
        });
        break;

      case 'finalize_lab':
        await tx.labSample.upsert({
          where: { id: `sample:${deal.id}` },
          update: { status: 'DONE', protocol: String(payload.protocol ?? `LAB-${deal.id}`), finalizedAt: new Date(), labId: user.orgId },
          create: { id: `sample:${deal.id}`, dealId: deal.id, shipmentId: `shipment:${deal.id}`, acceptanceId: `acceptance:${deal.id}`, status: 'DONE', culture: 'Пшеница', protocol: String(payload.protocol ?? `LAB-${deal.id}`), labId: user.orgId, labName: 'Тестовая аккредитованная лаборатория', collectedAt: new Date(), finalizedAt: new Date() },
        });
        await tx.labTest.deleteMany({ where: { sampleId: `sample:${deal.id}` } });
        await tx.labTest.createMany({
          data: [
            { sampleId: `sample:${deal.id}`, parameter: 'moisture', value: Number(payload.moisture ?? 12.4), unit: '%', normMax: 14, passed: true },
            { sampleId: `sample:${deal.id}`, parameter: 'protein', value: Number(payload.protein ?? 13.2), unit: '%', normMin: 12.5, passed: true },
          ],
        });
        await tx.acceptanceRecord.update({ where: { id: `acceptance:${deal.id}` }, data: { qualityStatus: 'PASSED', gost: String(payload.gost ?? 'ГОСТ 9353-2016') } });
        break;

      case 'accept_delivery':
        await tx.acceptanceRecord.update({ where: { id: `acceptance:${deal.id}` }, data: { status: 'ACCEPTED', actSignedAt: new Date(), actorId: user.id } });
        break;

      case 'complete_documents':
        for (const document of [
          { id: `ttn:${deal.id}`, type: 'TTN', name: 'Транспортная накладная' },
          { id: `weighing:${deal.id}`, type: 'WEIGHING_ACT', name: 'Акт взвешивания' },
          { id: `lab-protocol:${deal.id}`, type: 'LAB_PROTOCOL', name: 'Лабораторный протокол' },
          { id: `acceptance-act:${deal.id}`, type: 'ACCEPTANCE_ACT', name: 'Акт приёмки' },
        ]) {
          await tx.dealDocument.upsert({
            where: { id: document.id },
            update: { status: 'SIGNED', signedAt: new Date(), isImmutable: true, bankAcceptance: 'ACCEPTED' },
            create: { ...document, dealId: deal.id, status: 'SIGNED', signedAt: new Date(), uploadedByUserId: user.id, isImmutable: true, bankRequired: true, releaseRequired: true, bankAcceptance: 'ACCEPTED' },
          });
        }
        break;

      case 'request_release':
        await tx.payment.update({ where: { id: `payment:${deal.id}` }, data: { status: 'RELEASE_REQUESTED', callbackState: 'PENDING' } });
        await tx.bankOperation.upsert({
          where: { id: `bank-release:${deal.id}` },
          update: { status: 'PENDING', requestPayload: payload as Prisma.InputJsonValue },
          create: { id: `bank-release:${deal.id}`, dealId: deal.id, type: 'RELEASE', status: 'PENDING', amountKopecks: BigInt(amountKopecks), debitAccount: `escrow:${deal.id}`, creditAccount: `seller:${deal.sellerOrgId}`, idempotencyKey: `bank-release:${deal.id}`, initiatorUserId: user.id, requestPayload: payload as Prisma.InputJsonValue },
        });
        break;

      case 'confirm_release': {
        const bankRef = requiredBankReference(payload);
        await tx.payment.update({ where: { id: `payment:${deal.id}` }, data: { status: 'RELEASED', releasedAt: new Date(), callbackState: 'CONFIRMED', bankRef } });
        await tx.bankOperation.update({ where: { id: `bank-release:${deal.id}` }, data: { status: 'DONE', confirmedAt: new Date(), bankRef, responsePayload: payload as Prisma.InputJsonValue } });
        await tx.ledgerEntry.upsert({
          where: { idempotencyKey: `ledger-release:${deal.id}` },
          update: {},
          create: { dealId: deal.id, entryType: 'RELEASE', debitAccount: `escrow:${deal.id}`, creditAccount: `seller:${deal.sellerOrgId}`, amountKopecks, idempotencyKey: `ledger-release:${deal.id}`, description: 'Подтверждённая выплата продавцу', createdByUserId: user.id },
        });
        break;
      }

      default:
        break;
    }
  }

  private async appendDealEvent(
    tx: Prisma.TransactionClient,
    input: {
      dealId: string;
      eventType: string;
      actorId: string;
      actorRole: string;
      tenantId?: string;
      payload: Prisma.InputJsonValue;
    },
  ) {
    const previous = await tx.dealEvent.findFirst({ where: { dealId: input.dealId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const id = `event-${randomUUID()}`;
    const eventHash = hash({ id, ...input, prevHash: previous?.hash ?? null });
    return tx.dealEvent.create({
      data: {
        id,
        dealId: input.dealId,
        eventType: input.eventType,
        actorId: input.actorId,
        actorRole: input.actorRole,
        tenantId: input.tenantId,
        payload: input.payload,
        hash: eventHash,
        prevHash: previous?.hash,
      },
    });
  }

  private async appendAudit(
    tx: Prisma.TransactionClient,
    input: {
      dealId: string;
      actorUserId: string;
      actorRole: string;
      tenantId?: string;
      orgId?: string;
      action: string;
      objectType: string;
      objectId: string;
      beforeState: Prisma.InputJsonValue;
      afterState: Prisma.InputJsonValue;
      metadata: Prisma.InputJsonValue;
    },
  ) {
    const previous = await tx.auditEvent.findFirst({ where: { dealId: input.dealId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const id = `audit-${randomUUID()}`;
    const auditHash = hash({ id, ...input, prevHash: previous?.hash ?? null });
    return tx.auditEvent.create({
      data: {
        id,
        action: input.action,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        tenantId: input.tenantId,
        orgId: input.orgId,
        dealId: input.dealId,
        objectType: input.objectType,
        objectId: input.objectId,
        beforeState: input.beforeState,
        afterState: input.afterState,
        outcome: 'SUCCESS',
        metadata: input.metadata,
        hash: auditHash,
        prevHash: previous?.hash,
      },
    });
  }
}
