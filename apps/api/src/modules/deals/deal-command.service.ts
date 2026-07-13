import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
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
import {
  canonicalJson,
  decimalToMicro,
  invalid,
  microToDecimal,
  optionalCoordinate,
  optionalString,
  record,
  requiredArray,
  requiredDecimal,
  requiredIso,
  requiredString,
  type JsonRecord,
} from './deal-command-payload';

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

const REQUIRED_RELEASE_DOCUMENTS = [
  'CONTRACT',
  'TTN',
  'WEIGHING_ACT',
  'LAB_PROTOCOL',
  'ACCEPTANCE_ACT',
] as const;

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

function exactJson(value: unknown): any {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(exactJson);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    const maybeDecimal = value as { toFixed?: (digits?: number) => string; constructor?: { name?: string } };
    if (maybeDecimal.constructor?.name === 'Decimal' && typeof maybeDecimal.toFixed === 'function') {
      return maybeDecimal.toFixed();
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, exactJson(item)]),
    );
  }
  return value;
}

function requiredBankReference(payload: JsonRecord): string {
  const value = typeof payload.bankRef === 'string' ? payload.bankRef.trim() : '';
  if (value.length < 4) {
    throw new UnprocessableEntityException({
      code: 'UNPROCESSABLE_ENTITY',
      field: 'bankRef',
      message: 'Подтверждение банка должно содержать проверяемую банковскую ссылку.',
    });
  }
  return value;
}

function activeShipmentStatus(status: string): boolean {
  return !['DELIVERED', 'COMPLETED', 'CANCELLED', 'CLOSED', 'FAILED'].includes(status);
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

      return exactJson({
        deal: {
          id: deal.id,
          number: deal.dealNumber,
          status: deal.status,
          version: deal.version,
          updatedAt: deal.updatedAt,
          sellerOrgId: deal.sellerOrgId,
          buyerOrgId: deal.buyerOrgId,
          culture: deal.culture,
          cropClass: deal.cropClass,
          volumeTons: deal.volumeTonsDec ?? (deal.volumeTons === null ? null : String(deal.volumeTons)),
          pricePerTon: deal.pricePerTonDec ?? (deal.pricePerTon === null ? null : String(deal.pricePerTon)),
          totalKopecks: deal.totalKopecks,
          currency: deal.currency,
          closedAt: deal.closedAt,
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
              amountKopecks: payment.amountKopecks,
              holdAmountKopecks: payment.holdAmountKopecks,
              refundedKopecks: payment.refundedKopecks,
              commissionKopecks: payment.commissionKopecks,
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
        bankOperations: deal.bankOperations,
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
      throw new UnprocessableEntityException({
        code: 'UNPROCESSABLE_ENTITY',
        field: 'actionId',
        message: `Неизвестное действие сделки: ${rawActionId}`,
      });
    }

    const actionId = rawActionId as DealActionId;
    const definition = getDealActionDefinition(actionId);
    this.assertActionRole(definition, user);
    const receiptKey = this.receiptKey(dealId, dto.idempotencyKey);

    try {
      return await this.rls.withTrustedContext(user, async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dealId}, 42)) IS NULL AS locked`;
        await tx.$queryRaw(Prisma.sql`
SELECT set_config('app.current_command_id', ${dto.commandId}, true)
        `);

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
            message: 'Сделка изменилась после загрузки экрана. Обнови данные и повтори действие.',
            currentStatus: deal.status,
            currentUpdatedAt: deal.updatedAt.toISOString(),
            currentVersion: currentVersion.toString(),
          });
        }
        if (dto.expectedVersion !== undefined && BigInt(dto.expectedVersion) !== currentVersion) {
          throw new ConflictException({
            code: 'STALE_DEAL_VERSION',
            message: 'Сделка изменилась после загрузки экрана. Обнови данные и повтори действие.',
            currentStatus: deal.status,
            currentUpdatedAt: deal.updatedAt.toISOString(),
            currentVersion: currentVersion.toString(),
          });
        }

        const payload = await this.validatePayload(tx, actionId, deal, dto.payload ?? {}, user);
        await this.applySideEffects(tx, definition, deal, payload, user);

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
            message: 'Другая команда одновременно изменила сделку. Частичные изменения не сохранены.',
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
            payload,
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
          version: updatedDeal.version.toString(),
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
      });
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

  private async requireEvidence(
    tx: Prisma.TransactionClient,
    evidenceId: string,
    dealId: string,
    shipmentId?: string,
  ) {
    const evidence = await tx.evidenceFile.findUnique({ where: { id: evidenceId } });
    if (!evidence || evidence.dealId !== dealId || (shipmentId && evidence.shipmentId && evidence.shipmentId !== shipmentId)) {
      invalid('evidenceRef', 'Подтверждение не найдено в доказательном контуре этой сделки.');
    }
    if (!evidence.hash || !evidence.s3Key) {
      invalid('evidenceRef', 'Подтверждение не зафиксировано: отсутствует content hash или storage reference.');
    }
    return evidence;
  }

  private async requireShipment(tx: Prisma.TransactionClient, shipmentId: string, dealId: string) {
    const shipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment || shipment.dealId !== dealId) invalid('shipmentId', 'Рейс не найден в этой сделке.');
    return shipment;
  }

  private async validatePayload(
    tx: Prisma.TransactionClient,
    actionId: DealActionId,
    deal: {
      id: string;
      tenantId: string | null;
      sellerOrgId: string;
      buyerOrgId: string;
      sagaState: Prisma.JsonValue | null;
    },
    rawPayload: Prisma.InputJsonObject,
    user: RequestUser,
  ): Promise<JsonRecord> {
    const payload = record(rawPayload);

    if (actionId === 'seller_sign_contract' || actionId === 'buyer_sign_contract') {
      const documentId = requiredString(payload, 'documentId');
      const signedAt = requiredIso(payload, 'signedAt');
      const signatureEvidenceRef = requiredString(payload, 'signatureEvidenceRef');
      const document = await tx.dealDocument.findUnique({ where: { id: documentId } });
      if (!document || document.dealId !== deal.id || document.type !== 'CONTRACT') {
        invalid('documentId', 'Загруженный договор этой сделки не найден.');
      }
      if (!document.hash || !document.s3Key) invalid('documentId', 'Договор не зафиксирован или не имеет content hash.');
      if (actionId === 'buyer_sign_contract' && document.status !== 'SIGNING') {
        invalid('documentId', 'Покупатель может подписать только договор, уже подписанный продавцом.');
      }
      await this.requireEvidence(tx, signatureEvidenceRef, deal.id);
      return { documentId, signedAt: signedAt.toISOString(), signatureEvidenceRef };
    }

    if (actionId === 'assign_logistics') {
      const carrierOrgId = requiredString(payload, 'carrierOrgId');
      const driverUserId = requiredString(payload, 'driverUserId');
      const vehicleId = requiredString(payload, 'vehicleId');
      const routeFromFacilityId = requiredString(payload, 'routeFromFacilityId');
      const routeToFacilityId = requiredString(payload, 'routeToFacilityId');

      const admissions = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT admission.id
        FROM logistics.deal_admissions admission
        WHERE admission.tenant_id = ${deal.tenantId}
AND admission.deal_id = ${deal.id}
AND admission.carrier_org_id = ${carrierOrgId}
AND admission.driver_user_id = ${driverUserId}
AND admission.vehicle_id = ${vehicleId}
AND admission.route_from_facility_id = ${routeFromFacilityId}
AND admission.route_to_facility_id = ${routeToFacilityId}
AND admission.status = 'ACTIVE'
AND admission.valid_from <= now()
AND (admission.valid_until IS NULL OR admission.valid_until > now())
        FOR UPDATE
        LIMIT 1
      `);
      if (!admissions[0]) {
        invalid('driverUserId', 'Активный нормализованный допуск логистики для сделки не найден.');
      }

      const conflicts = await tx.shipment.findMany({
        where: {
          dealId: { not: deal.id },
OR: [{ driverUserId }, { vehicleNumber: vehicleId }],
        },
        select: { id: true, status: true },
        take: 20,
      });
      if (conflicts.some((item) => activeShipmentStatus(item.status))) {
        invalid('driverUserId', 'У водителя или машины уже есть конфликтующее активное назначение.');
      }
      return { carrierOrgId, driverUserId, vehicleId, routeFromFacilityId, routeToFacilityId };
    }

    if (actionId === 'confirm_loading') {
      const shipmentId = requiredString(payload, 'shipmentId');
      const actualWeightTons = requiredDecimal(payload, 'actualWeightTons');
      const occurredAt = requiredIso(payload, 'occurredAt');
      const basis = requiredString(payload, 'basis');
      const evidenceRef = requiredString(payload, 'evidenceRef');
      await this.requireShipment(tx, shipmentId, deal.id);
      await this.requireEvidence(tx, evidenceRef, deal.id, shipmentId);
      return { shipmentId, actualWeightTons, occurredAt: occurredAt.toISOString(), basis, evidenceRef };
    }

    if (actionId === 'start_transit' || actionId === 'confirm_arrival') {
      const shipmentId = requiredString(payload, 'shipmentId');
      const occurredAt = requiredIso(payload, 'occurredAt');
      const evidenceRef = requiredString(payload, 'evidenceRef');
      const lat = optionalCoordinate(payload, 'lat', -90, 90);
      const lng = optionalCoordinate(payload, 'lng', -180, 180);
      if ((lat === undefined) !== (lng === undefined)) invalid('lat', 'Координаты должны передаваться парой.');
      await this.requireShipment(tx, shipmentId, deal.id);
      await this.requireEvidence(tx, evidenceRef, deal.id, shipmentId);
      return { shipmentId, occurredAt: occurredAt.toISOString(), evidenceRef, ...(lat !== undefined ? { lat, lng } : {}) };
    }

    if (actionId === 'confirm_weight') {
      const shipmentId = requiredString(payload, 'shipmentId');
      const grossTons = requiredDecimal(payload, 'grossTons');
      const tareTons = requiredDecimal(payload, 'tareTons');
      const netTons = requiredDecimal(payload, 'netTons');
      const weighingSource = requiredString(payload, 'weighingSource');
      const occurredAt = requiredIso(payload, 'occurredAt');
      const evidenceRef = requiredString(payload, 'evidenceRef');
      const equipmentId = optionalString(payload, 'equipmentId');
      const gross = decimalToMicro(grossTons, 'grossTons');
      const tare = decimalToMicro(tareTons, 'tareTons');
      const net = decimalToMicro(netTons, 'netTons');
      if (gross - tare !== net) invalid('netTons', `Нетто должно равнятся брутто минус тара: ${microToDecimal(gross - tare)}.`);
      await this.requireShipment(tx, shipmentId, deal.id);
      await this.requireEvidence(tx, evidenceRef, deal.id, shipmentId);
      return { shipmentId, grossTons, tareTons, netTons, weighingSource, operatorUserId: user.id, occurredAt: occurredAt.toISOString(), evidenceRef, ...(equipmentId ? { equipmentId } : {}) };
    }

    if (actionId === 'confirm_inspection') {
      const shipmentId = requiredString(payload, 'shipmentId');
      const documentId = requiredString(payload, 'documentId');
      const inspectionResult = requiredString(payload, 'inspectionResult');
      const inspectedAt = requiredIso(payload, 'inspectedAt');
      const evidenceRef = requiredString(payload, 'evidenceRef');
      await this.requireShipment(tx, shipmentId, deal.id);
      const document = await tx.dealDocument.findUnique({ where: { id: documentId } });
      if (
        !document || document.dealId !== deal.id || document.type !== 'INSPECTION_REPORT'
        || !['VALIDATED', 'SIGNED'].includes(document.status) || !document.hash || !document.s3Key
      ) {
        invalid('documentId', 'Подтверждённое заключение независимого осмотра не найдено в сделке.');
      }
      await this.requireEvidence(tx, evidenceRef, deal.id, shipmentId);
      return {
        shipmentId,
        documentId,
        inspectionResult,
        inspectedAt: inspectedAt.toISOString(),
        evidenceRef,
      };
    }

    if (actionId === 'finalize_lab') {
      const sampleId = requiredString(payload, 'sampleId');
      const sample = await tx.labSample.findUnique({
        where: { id: sampleId },
        include: { tests: { orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }] } },
      });
      if (!sample || sample.dealId !== deal.id) {
        invalid('sampleId', 'Проба не найдена в этой сделке.');
      }
      if (sample.status !== 'FINALIZED') {
        invalid('sampleId', 'Лабораторный протокол ещё не финализирован в подтверждённом контуре.');
      }
      if (sample.labId !== user.orgId || sample.assignedLabUserId !== user.id) {
        invalid('sampleId', 'Финализированный протокол не принадлежит подтверждённой лабораторной сессии.');
      }
      if (
        !sample.protocol || !sample.gost || !sample.accreditationId
        || !sample.certificateDocId || !sample.protocolHash || !sample.finalizedAt
      ) {
        invalid('sampleId', 'Финализированная проба не содержит полного протокольного основания.');
      }
      if (!sample.acceptanceId) {
        invalid('sampleId', 'Проба не связана с записью приёмки сделки.');
      }
      const acceptance = await tx.acceptanceRecord.findUnique({ where: { id: sample.acceptanceId } });
      if (!acceptance || acceptance.dealId !== deal.id) {
        invalid('sampleId', 'Связанная запись приёмки не найдена в этой сделке.');
      }
      const protocolDocument = await tx.dealDocument.findUnique({
        where: { id: sample.certificateDocId },
      });
      if (
        !protocolDocument || protocolDocument.dealId !== deal.id
        || protocolDocument.type !== 'LAB_PROTOCOL' || protocolDocument.status !== 'SIGNED'
        || !protocolDocument.signedAt || !protocolDocument.isImmutable
        || !protocolDocument.hash || !protocolDocument.s3Key
      ) {
        invalid('sampleId', 'Подписанный неизменяемый лабораторный протокол не найден в сделке.');
      }
      if (sample.tests.length === 0) {
        invalid('sampleId', 'В финализированной пробе отсутствуют сохранённые лабораторные факты.');
      }
      const invalidFact = sample.tests.find((test) => (
        !test.methodId || !test.equipmentId || !test.actorUserId
        || !test.commandId || !test.idempotencyKey
      ));
      if (invalidFact) {
        invalid('sampleId', 'Лабораторные факты не имеют полного серверного основания.');
      }
      const declaredResult = sample.tests.every((test) => test.passed) ? 'PASSED' : 'FAILED';
      return {
        sampleId,
        acceptanceId: sample.acceptanceId,
        protocolNumber: sample.protocol,
        labId: sample.labId,
        accreditationId: sample.accreditationId,
        applicableStandard: sample.gost,
        finalizedAt: sample.finalizedAt.toISOString(),
        signedEvidenceRef: sample.certificateDocId,
        protocolHash: sample.protocolHash,
        declaredResult,
        effectiveTestIds: sample.tests.map((test) => test.id),
      };
    }

    if (actionId === 'accept_delivery') {
      const acceptanceId = requiredString(payload, 'acceptanceId');
      const acceptedAt = requiredIso(payload, 'acceptedAt');
      const evidenceRef = requiredString(payload, 'evidenceRef');
      const acceptance = await tx.acceptanceRecord.findUnique({ where: { id: acceptanceId } });
      if (!acceptance || acceptance.dealId !== deal.id) invalid('acceptanceId', 'Запись приёмки сделки не найдена.');
      await this.requireEvidence(tx, evidenceRef, deal.id, acceptance.shipmentId ?? undefined);
      return { acceptanceId, acceptedAt: acceptedAt.toISOString(), evidenceRef };
    }

    if (actionId === 'complete_documents') {
      const documents = await tx.dealDocument.findMany({ where: { dealId: deal.id, type: { in: [...REQUIRED_RELEASE_DOCUMENTS] } } });
      const missing = REQUIRED_RELEASE_DOCUMENTS.filter((type) => !documents.some((item) => item.type === type && ['SIGNED', 'VERIFIED'].includes(item.status)));
      if (missing.length > 0) invalid('documents', `Не готовы обязательные документы: ${missing.join(', ')}`);
      return { documentIds: documents.map((item) => item.id) };
    }

    if (actionId === 'request_release') {
      const expectedAmountKopecks = BigInt(deal.id ? (await tx.deal.findUniqueOrThrow({ where: { id: deal.id } })).totalKopecks ?? 0 : 0);
      const amountKopecks = BigInt(requiredString(payload, 'amountKopecks'));
      if (amountKopecks !== expectedAmountKopecks) invalid('amountKopecks', 'Запрошенная сумма не совпадает с суммой сделки.');
      return { amountKopecks: amountKopecks.toString() };
    }

    if (actionId === 'confirm_reserve' || actionId === 'confirm_release') {
      const bankRef = requiredBankReference(payload);
      return { ...payload, bankRef };
    }

    return payload;
  }

  private async applySideEffects(
    tx: Prisma.TransactionClient,
    definition: DealActionDefinition,
    deal: { id: string; sellerOrgId: string; buyerOrgId: string; totalKopecks: bigint | null },
    payload: JsonRecord,
    user: RequestUser,
  ) {
    const amountKopecks = BigInt(deal.totalKopecks ?? 0);

    switch (definition.id) {
      case 'request_reserve':
      await tx.payment.upsert({
        where: { id: `payment:${deal.id}` },
        update: {
          status: 'RESERVE_REQUESTED',
          amountKopecks,
          amountRub: Number(amountKopecks) / 100,
          callbackState: 'PENDING',
        },
        create: {
          id: `payment:${deal.id}`,
          dealId: deal.id,
          status: 'RESERVE_REQUESTED',
          amountKopecks,
          amountRub: Number(amountKopecks) / 100,
          callbackState: 'PENDING',
        },
      });
        await tx.bankOperation.upsert({
          where: { id: `bank-reserve:${deal.id}` },
          update: { status: 'PENDING', requestPayload: payload as Prisma.InputJsonValue },
          create: {
            id: `bank-reserve:${deal.id}`,
            dealId: deal.id,
            type: 'RESERVE',
            status: 'PENDING',
            amountKopecks,
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
        await tx.payment.update({ where: { id: `payment:${deal.id}` }, data: { status: 'RESERVED', reservedAt: new Date(), callbackState: 'CONFIRMED', bankRef } });
        await tx.bankOperation.update({ where: { id: `bank-reserve:${deal.id}` }, data: { status: 'DONE', confirmedAt: new Date(), bankRef, responsePayload: payload as Prisma.InputJsonValue } });
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
            description: 'Подтверждённое резервирование банка',
            createdByUserId: user.id,
          },
        });
        break;
      }

      case 'seller_sign_contract':
      case 'buyer_sign_contract': {
        const documentId = String(payload.documentId);
        const document = await tx.dealDocument.findUniqueOrThrow({ where: { id: documentId } });
        const signatories = JSON.parse(document.signatories ?? '[]') as Array<Record<string, unknown>>;
        signatories.push({ userId: user.id, orgId: user.orgId, role: user.role, signedAt: payload.signedAt, evidenceRef: payload.signatureEvidenceRef });
        await tx.dealDocument.update({
          where: { id: documentId },
          data: definition.id === 'seller_sign_contract'
            ? { status: 'SIGNING', signatories: JSON.stringify(signatories) }
            : { status: 'SIGNED', signedAt: new Date(String(payload.signedAt)), signatories: JSON.stringify(signatories), isImmutable: true },
        });
        break;
      }

      case 'assign_logistics': {
        const carrier = await tx.organization.findUniqueOrThrow({ where: { id: String(payload.carrierOrgId) } });
        const shipmentId = `shipment:${deal.id}`;
        await tx.shipment.create({
          data: {
            id: shipmentId,
            dealId: deal.id,
            status: 'DRIVER_ASSIGNED',
            driverUserId: String(payload.driverUserId),
            driverName: null,
            vehicleNumber: String(payload.vehicleId),
            vehicleType: null,
            carrierOrgId: carrier.id,
            carrierName: carrier.name,
            routeFrom: String(payload.routeFromFacilityId),
            routeTo: String(payload.routeToFacilityId),
            nextAction: 'Подтвердить загрузку',
          },
        });
        break;
      }

      case 'confirm_loading': {
        const shipmentId = String(payload.shipmentId);
        const evidence = await tx.evidenceFile.findUniqueOrThrow({ where: { id: String(payload.evidenceRef) } });
        await tx.shipment.update({ where: { id: shipmentId }, data: { status: 'LOADED', nextAction: 'Начать рейс' } });
        await tx.checkpoint.create({
          data: {
            shipmentId,
            type: 'LOADING_CONFIRMED',
            completedAt: new Date(String(payload.occurredAt)),
            actorId: user.id,
            photoUrl: evidence.s3Key,
            note: canonicalJson(payload),
          },
        });
        break;
      }

      case 'start_transit': {
        const shipmentId = String(payload.shipmentId);
        const evidence = await tx.evidenceFile.findUniqueOrThrow({ where: { id: String(payload.evidenceRef) } });
        await tx.shipment.update({ where: { id: shipmentId }, data: { status: 'IN_TRANSIT', nextAction: 'Подтвердить прибытие' } });
        await tx.checkpoint.create({
          data: { shipmentId, type: 'DEPARTURE', completedAt: new Date(String(payload.occurredAt)), actorId: user.id, photoUrl: evidence.s3Key, note: canonicalJson(payload) },
        });
        break;
      }

      case 'confirm_arrival': {
        const shipmentId = String(payload.shipmentId);
        const evidence = await tx.evidenceFile.findUniqueOrThrow({ where: { id: String(payload.evidenceRef) } });
        await tx.shipment.update({ where: { id: shipmentId }, data: { status: 'ARRIVED', nextAction: 'Зафиксировать вес' } });
        await tx.checkpoint.create({
          data: {
            shipmentId,
            type: 'ARRIVAL',
            completedAt: new Date(String(payload.occurredAt)),
            actorId: user.id,
            photoUrl: evidence.s3Key,
            note: canonicalJson(payload),
            ...(typeof payload.lat === 'number' ? { lat: payload.lat, lng: payload.lng as number } : {}),
          },
        });
        break;
      }

      case 'confirm_weight':
        await tx.acceptanceRecord.upsert({
          where: { id: `acceptance:${deal.id}` },
          update: { status: 'PENDING', qualityStatus: 'PENDING', actorId: user.id, notes: canonicalJson(payload) },
          create: {
            id: `acceptance:${deal.id}`,
            dealId: deal.id,
            shipmentId: String(payload.shipmentId),
            status: 'PENDING',
            qualityStatus: 'PENDING',
            actorId: user.id,
            notes: canonicalJson(payload),
          },
        });
        break;

      case 'confirm_inspection':
        break;

      case 'finalize_lab': {
        const sampleId = String(payload.sampleId);
        const sample = await tx.labSample.findUniqueOrThrow({ where: { id: sampleId } });
        if (
          sample.dealId !== deal.id || sample.status !== 'FINALIZED'
          || sample.protocolHash !== String(payload.protocolHash)
        ) {
          throw new ConflictException({ code: 'LAB_PROTOCOL_AUTHORITY_CHANGED' });
        }
        await tx.acceptanceRecord.update({
          where: { id: String(payload.acceptanceId) },
          data: {
            qualityStatus: String(payload.declaredResult),
            gost: String(payload.applicableStandard),
          },
        });
        break;
      }

      case 'accept_delivery':
        await tx.acceptanceRecord.update({
          where: { id: String(payload.acceptanceId) },
          data: { status: 'ACCEPTED', actSignedAt: new Date(String(payload.acceptedAt)), actDocId: String(payload.evidenceRef), actorId: user.id },
        });
        break;

      case 'complete_documents':
        break;

      case 'request_release':
        await tx.payment.update({ where: { id: `payment:${deal.id}` }, data: { status: 'RELEASE_REQUESTED', callbackState: 'PENDING' } });
        await tx.bankOperation.upsert({
          where: { id: `bank-release:${deal.id}` },
          update: { status: 'PENDING', requestPayload: payload as Prisma.InputJsonValue },
          create: {
            id: `bank-release:${deal.id}`,
            dealId: deal.id,
            type: 'RELEASE',
            status: 'PENDING',
            amountKopecks,
            debitAccount: `escrow:${deal.id}`,
            creditAccount: `seller:${deal.sellerOrgId}`,
            idempotencyKey: `bank-release:${deal.id}`,
            initiatorUserId: user.id,
            requestPayload: payload as Prisma.InputJsonValue,
          },
        });
        break;

      case 'confirm_release': {
        const bankRef = requiredBankReference(payload);
        await tx.payment.update({ where: { id: `payment:${deal.id}` }, data: { status: 'RELEASED', releasedAt: new Date(), callbackState: 'CONFIRMED', bankRef } });
        await tx.bankOperation.update({ where: { id: `bank-release:${deal.id}` }, data: { status: 'DONE', confirmedAt: new Date(), bankRef, responsePayload: payload as Prisma.InputJsonValue } });
        await tx.ledgerEntry.upsert({
          where: { idempotencyKey: `ledger-release:${deal.id}` },
          update: {},
          create: {
            dealId: deal.id,
            entryType: 'RELEASE',
            debitAccount: `escrow:${deal.id}`,
            creditAccount: `seller:${deal.sellerOrgId}`,
            amountKopecks,
            idempotencyKey: `ledger-release:${deal.id}`,
            description: 'Подтверждённая выплата продавцу',
            createdByUserId: user.id,
          },
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
