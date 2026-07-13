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
import { DealCommandService } from './deal-command.service';
import { getDealActionDefinition } from './deal-command.policy';
import { ExecuteDealCommandDto } from './dto/execute-deal-command.dto';

type JsonRecord = Record<string, unknown>;

type LockedLabSample = {
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  status: string;
  labId: string | null;
  sampleCode: string | null;
  version: bigint;
};

type AuthoritativeProtocol = {
  id: string;
  sampleId: string;
  protocolNumber: string;
  laboratoryOrgId: string;
  accreditationRef: string;
  standardRef: string;
  result: string;
  signedEvidenceFileId: string;
  finalizedByUserId: string;
  finalizedAt: Date;
  version: number;
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2002') return true;
  if (error.code !== 'P2010') return false;
  const meta = error.meta as Record<string, unknown> | undefined;
  return meta?.code === '23505';
}

function requiredString(payload: JsonRecord, field: string): string {
  const value = typeof payload[field] === 'string' ? payload[field].trim() : '';
  if (!value || value.length > 240 || !/^[A-Za-z0-9:_.-]+$/.test(value)) {
    throw new UnprocessableEntityException({
      code: 'UNPROCESSABLE_ENTITY',
      field,
      message: `Поле ${field} обязательно и должно содержать безопасный идентификатор.`,
    });
  }
  return value;
}

/**
 * PostgreSQL-authoritative specialization for the canonical laboratory
 * finalization transition. The client identifies only the sample and verified
 * signature evidence. Laboratory, accreditation, protocol number, standard,
 * result and finalization time are derived server-side.
 */
@Injectable()
export class PostgresqlDealCommandService extends DealCommandService {
  constructor(private readonly postgresRls: RlsTransactionService) {
    super(postgresRls);
  }

  override async execute(
    dealId: string,
    rawActionId: string,
    dto: ExecuteDealCommandDto,
    user: RequestUser,
  ) {
    if (rawActionId !== 'finalize_lab') {
      return super.execute(dealId, rawActionId, dto, user);
    }
    return this.finalizeLaboratoryProtocol(dealId, dto, user);
  }

  private async finalizeLaboratoryProtocol(
    dealId: string,
    dto: ExecuteDealCommandDto,
    user: RequestUser,
  ) {
    const definition = getDealActionDefinition('finalize_lab');
    this.assertTrustedUser(user);
    if (!definition.roles.includes(String(user.role))) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED_FOR_DEAL_ACTION',
        message: `Role ${user.role} cannot execute finalize_lab`,
        allowedRoles: definition.roles,
      });
    }

    const clientPayload = (dto.payload ?? {}) as JsonRecord;
    const sampleId = requiredString(clientPayload, 'sampleId');
    const signedEvidenceRef = requiredString(clientPayload, 'signedEvidenceRef');
    const requestFingerprint = digest({
      actionId: 'finalize_lab',
      dealId,
      sampleId,
      signedEvidenceRef,
    });
    const receiptKey = `deal-command:${dealId}:${dto.idempotencyKey}`;

    try {
      return await this.postgresRls.withTrustedContext(
        user,
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dealId}, 42)) IS NULL AS locked`;
          await tx.$queryRaw(Prisma.sql`
            SELECT set_config('app.current_command_id', ${dto.commandId}, true)
          `);

          const storedReceipt = await tx.outboxEntry.findUnique({
            where: { idempotencyKey: receiptKey },
          });
          if (storedReceipt) {
            return this.postgresResultFromReceipt(storedReceipt.payload, requestFingerprint);
          }

          const deal = await tx.deal.findUnique({ where: { id: dealId } });
          if (!deal) throw new NotFoundException(`Deal ${dealId} not found`);
          if (!deal.tenantId || deal.tenantId !== user.tenantId) {
            throw new ForbiddenException({ code: 'TENANT_SCOPE_DENIED' });
          }
          if (deal.status !== definition.from) {
            throw new ConflictException({
              code: 'DEAL_STATE_CONFLICT',
              message: `Action finalize_lab requires status ${definition.from}; current status is ${deal.status}`,
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

          const samples = await tx.$queryRaw<LockedLabSample[]>(Prisma.sql`
            SELECT
              sample."id", sample."dealId", sample."shipmentId", sample."acceptanceId",
              sample."tenantId", sample."status", sample."labId", sample."sampleCode",
              sample."version"
            FROM public."lab_samples" sample
            WHERE sample."id" = ${sampleId}
            FOR UPDATE
          `);
          const sample = samples[0];
          if (!sample || sample.dealId !== deal.id || sample.tenantId !== deal.tenantId) {
            throw new UnprocessableEntityException({
              code: 'LAB_SAMPLE_NOT_FOUND',
              field: 'sampleId',
              message: 'Проба не найдена в лабораторном контуре этой сделки.',
            });
          }
          if (sample.status !== 'ANALYSIS_IN_PROGRESS') {
            throw new ConflictException({
              code: 'LAB_SAMPLE_NOT_READY',
              message: 'Финализация разрешена только после полной цепочки хранения и записи лабораторных тестов.',
              currentStatus: sample.status,
            });
          }
          if (!sample.acceptanceId || !sample.shipmentId || !sample.labId || !sample.sampleCode) {
            throw new ConflictException({ code: 'LAB_SAMPLE_AUTHORITY_BASIS_INCOMPLETE' });
          }

          const expectedProtocolNumber = `LAB-${sample.sampleCode}-V1`;
          const evidenceCheck = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
            SELECT public.app_labs_evidence_purpose_valid(
              ${signedEvidenceRef}, ${sample.tenantId}, ${sample.dealId}, 'PROTOCOL',
              ${sample.id}, ${sample.shipmentId}, ${sample.acceptanceId},
              ${sample.labId}, ${expectedProtocolNumber}
            ) AS valid
          `);
          if (evidenceCheck[0]?.valid !== true) {
            throw new ConflictException({
              code: 'LAB_PROTOCOL_EVIDENCE_NOT_PURPOSE_BOUND',
              message: 'Подписанное evidence не связано с этой пробой, перевозкой и номером протокола.',
            });
          }

          const signatory = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
            SELECT public.app_labs_actor_valid(
              ${sample.tenantId}, ${sample.labId}, ${user.id}, 'SIGNATORY', now()
            ) AS valid
          `);
          if (signatory[0]?.valid !== true) {
            throw new ForbiddenException({ code: 'LAB_SIGNATORY_AUTHORITY_REQUIRED' });
          }

          const finalizedSample = await tx.labSample.update({
            where: { id: sample.id },
            data: {
              status: 'FINALIZED',
              protocol: expectedProtocolNumber,
              certificateDocId: signedEvidenceRef,
            },
          });

          const protocols = await tx.$queryRaw<AuthoritativeProtocol[]>(Prisma.sql`
            SELECT
              protocol.id,
              protocol.sample_id AS "sampleId",
              protocol.protocol_number AS "protocolNumber",
              protocol.laboratory_org_id AS "laboratoryOrgId",
              protocol.accreditation_ref AS "accreditationRef",
              protocol.standard_ref AS "standardRef",
              protocol.result,
              protocol.signed_evidence_file_id AS "signedEvidenceFileId",
              protocol.finalized_by_user_id AS "finalizedByUserId",
              protocol.finalized_at AS "finalizedAt",
              protocol.version
            FROM labs.protocols protocol
            WHERE protocol.sample_id = ${sample.id}
            ORDER BY protocol.version DESC
            LIMIT 2
          `);
          if (protocols.length !== 1) {
            throw new ConflictException({
              code: 'LAB_PROTOCOL_AUTHORITY_AMBIGUOUS',
              message: 'Финализация должна создать ровно одно авторитетное основание протокола.',
            });
          }
          const protocol = protocols[0];
          if (
            protocol.protocolNumber !== expectedProtocolNumber ||
            protocol.signedEvidenceFileId !== signedEvidenceRef ||
            protocol.laboratoryOrgId !== sample.labId ||
            protocol.finalizedByUserId !== user.id
          ) {
            throw new ConflictException({ code: 'LAB_PROTOCOL_AUTHORITY_MISMATCH' });
          }
          if (!['PASSED', 'FAILED'].includes(protocol.result)) {
            throw new ConflictException({ code: 'LAB_PROTOCOL_RESULT_NOT_FINAL' });
          }

          const acceptanceUpdate = await tx.acceptanceRecord.updateMany({
            where: {
              id: sample.acceptanceId,
              dealId: deal.id,
              shipmentId: sample.shipmentId,
            },
            data: {
              qualityStatus: protocol.result,
              gost: protocol.standardRef,
            },
          });
          if (acceptanceUpdate.count !== 1) {
            throw new ConflictException({ code: 'LAB_ACCEPTANCE_BASIS_NOT_FOUND' });
          }

          const next = getDealActionDefinition('accept_delivery');
          const dealUpdate = await tx.deal.updateMany({
            where: {
              id: deal.id,
              status: definition.from,
              updatedAt: deal.updatedAt,
              version: currentVersion,
            },
            data: {
              status: definition.to,
              nextAction: next.label,
              version: { increment: 1 },
            },
          });
          if (dealUpdate.count !== 1) {
            throw new ConflictException({
              code: 'CONCURRENT_DEAL_UPDATE',
              message: 'Другая команда одновременно изменила сделку. Частичные изменения не сохранены.',
            });
          }
          const updatedDeal = await tx.deal.findUniqueOrThrow({ where: { id: deal.id } });

          const previousEvent = await tx.dealEvent.findFirst({
            where: { dealId: deal.id },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          });
          const eventId = `event-${randomUUID()}`;
          const eventPayload = {
            commandId: dto.commandId,
            idempotencyKey: dto.idempotencyKey,
            actionId: 'finalize_lab',
            from: definition.from,
            to: definition.to,
            authoritativeProtocol: {
              id: protocol.id,
              sampleId: protocol.sampleId,
              protocolNumber: protocol.protocolNumber,
              laboratoryOrgId: protocol.laboratoryOrgId,
              accreditationRef: protocol.accreditationRef,
              standardRef: protocol.standardRef,
              result: protocol.result,
              signedEvidenceFileId: protocol.signedEvidenceFileId,
              finalizedByUserId: protocol.finalizedByUserId,
              finalizedAt: protocol.finalizedAt.toISOString(),
            },
            resultingUpdatedAt: updatedDeal.updatedAt.toISOString(),
          };
          const eventHash = digest({
            id: eventId,
            dealId: deal.id,
            eventType: 'FINALIZE_LAB',
            actorId: user.id,
            actorRole: String(user.role),
            tenantId: user.tenantId,
            payload: eventPayload,
            prevHash: previousEvent?.hash ?? null,
          });
          await tx.dealEvent.create({
            data: {
              id: eventId,
              dealId: deal.id,
              eventType: 'FINALIZE_LAB',
              actorId: user.id,
              actorRole: String(user.role),
              tenantId: user.tenantId,
              payload: eventPayload,
              hash: eventHash,
              prevHash: previousEvent?.hash,
            },
          });

          const previousAudit = await tx.auditEvent.findFirst({
            where: { dealId: deal.id },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          });
          const auditId = `audit-${randomUUID()}`;
          const auditMaterial = {
            id: auditId,
            action: 'deal.command.finalize_lab',
            actorUserId: user.id,
            actorRole: String(user.role),
            tenantId: user.tenantId,
            orgId: user.orgId,
            dealId: deal.id,
            objectType: 'deal',
            objectId: deal.id,
            beforeState: {
              status: definition.from,
              updatedAt: deal.updatedAt.toISOString(),
              labSampleStatus: sample.status,
            },
            afterState: {
              status: definition.to,
              updatedAt: updatedDeal.updatedAt.toISOString(),
              labSampleStatus: finalizedSample.status,
              protocolId: protocol.id,
              protocolResult: protocol.result,
            },
            outcome: 'SUCCESS',
            correlationId: dto.commandId,
            metadata: {
              commandId: dto.commandId,
              idempotencyKey: dto.idempotencyKey,
              eventId,
              sessionId: user.sessionId,
              protocolId: protocol.id,
              requestFingerprint,
            },
            prevHash: previousAudit?.hash ?? null,
          };
          await tx.auditEvent.create({
            data: {
              ...auditMaterial,
              beforeState: auditMaterial.beforeState as Prisma.InputJsonValue,
              afterState: auditMaterial.afterState as Prisma.InputJsonValue,
              metadata: auditMaterial.metadata as Prisma.InputJsonValue,
              hash: digest(auditMaterial),
            },
          });

          const laboratoryOutbox = await tx.outboxEntry.create({
            data: {
              type: 'lab.protocol.finalized',
              dealId: deal.id,
              status: 'PENDING',
              idempotencyKey: `lab-protocol:${protocol.id}`,
              correlationId: dto.commandId,
              auditId,
              payload: {
                schemaVersion: 'lab-protocol-finalized.v1',
                dealId: deal.id,
                sampleId: sample.id,
                protocolId: protocol.id,
                protocolNumber: protocol.protocolNumber,
                result: protocol.result,
                standardRef: protocol.standardRef,
                signedEvidenceFileId: protocol.signedEvidenceFileId,
                finalizedAt: protocol.finalizedAt.toISOString(),
              },
            },
          });

          const result = {
            ok: true,
            duplicate: false,
            commandId: dto.commandId,
            idempotencyKey: dto.idempotencyKey,
            dealId: deal.id,
            actionId: 'finalize_lab',
            previousStatus: definition.from,
            status: definition.to,
            updatedAt: updatedDeal.updatedAt.toISOString(),
            version: updatedDeal.version.toString(),
            eventId,
            auditId,
            externalOutboxId: laboratoryOutbox.id,
            protocolId: protocol.id,
            protocolNumber: protocol.protocolNumber,
            protocolResult: protocol.result,
          };
          await tx.outboxEntry.create({
            data: {
              type: 'deal.command.receipt',
              dealId: deal.id,
              status: 'CONFIRMED',
              idempotencyKey: receiptKey,
              correlationId: dto.commandId,
              auditId,
              confirmedAt: new Date(),
              payload: { requestFingerprint, result },
            },
          });
          return result;
        },
        { timeout: 20_000 },
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const replay = await this.postgresRls.withTrustedContext(user, async (tx) => {
          const receipt = await tx.outboxEntry.findUnique({
            where: { idempotencyKey: receiptKey },
          });
          return receipt
            ? this.postgresResultFromReceipt(receipt.payload, requestFingerprint)
            : null;
        });
        if (replay) return replay;
      }
      throw error;
    }
  }

  private assertTrustedUser(user: RequestUser): void {
    if (!user.id || !user.orgId || !user.tenantId || !user.sessionId) {
      throw new ForbiddenException({ code: 'TRUSTED_CONTEXT_REQUIRED' });
    }
  }

  private postgresResultFromReceipt(
    payload: Prisma.JsonValue,
    requestFingerprint: string,
  ) {
    const receipt = payload as {
      requestFingerprint?: unknown;
      result?: Record<string, unknown>;
    } | null;
    if (!receipt?.result) {
      throw new ConflictException('Stored command receipt is incomplete');
    }
    if (receipt.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The idempotency key is already bound to a different laboratory finalization request.',
      });
    }
    return { ...receipt.result, duplicate: true };
  }
}
