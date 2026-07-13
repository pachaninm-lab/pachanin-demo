import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService, type TrustedRlsContext } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import type {
  CollectLabSampleCommand,
  CreateLabSampleCommand,
  LabMutationResult,
  LabRepository,
  LabSampleRecord,
  LabWorkspace,
  RecordLabCustodyCommand,
  RecordLabTestCommand,
} from './lab.repository';
import { PrismaLabRepository } from './prisma-lab.repository';

type ActorType = 'SAMPLER' | 'COURIER' | 'RECEIVER' | 'ANALYST' | 'SIGNATORY';
type EvidencePurpose = 'ADMISSION' | 'COLLECTION' | 'SEALED' | 'HANDOFF' | 'RECEIVED' | 'OPENED' | 'TEST' | 'PROTOCOL';
type SampleAuthority = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  labId: string | null;
}>;

@Injectable()
export class AuthorizedPrismaLabRepository implements LabRepository {
  constructor(
    private readonly delegate: PrismaLabRepository,
    private readonly rls: RlsTransactionService,
  ) {}

  async list(user: RequestUser): Promise<LabSampleRecord[]> {
    const ids = await this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT sample."id"
        FROM public."lab_samples" sample
        WHERE sample."tenantId" = ${context.tenantId}
          AND public.app_labs_deal_authorized(sample."dealId", sample."labId", false)
        ORDER BY sample."updatedAt" DESC, sample."id" ASC
        LIMIT 500
      `);
      return new Set(rows.map((row) => row.id));
    });
    return (await this.delegate.list(user)).filter((sample) => ids.has(sample.id));
  }

  async getById(id: string, user: RequestUser): Promise<LabSampleRecord> {
    await this.requireReadableSample(id, user);
    return this.delegate.getById(id, user);
  }

  async workspace(id: string, user: RequestUser): Promise<LabWorkspace> {
    await this.requireReadableSample(id, user);
    return this.delegate.workspace(id, user);
  }

  async create(command: CreateLabSampleCommand, user: RequestUser): Promise<LabMutationResult> {
    const occurredAt = requiredDate(command.occurredAt, 'occurredAt');
    await this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<Array<{ laboratoryOrgId: string }>>(Prisma.sql`
        SELECT admission.laboratory_org_id AS "laboratoryOrgId"
        FROM labs.sample_admissions admission
        WHERE admission.tenant_id = ${context.tenantId}
          AND admission.deal_id = ${command.dealId}
          AND admission.shipment_id = ${command.shipmentId}
          AND admission.acceptance_id = ${command.acceptanceId}
          AND admission.status = 'ACTIVE'
          AND admission.valid_from <= ${occurredAt}
          AND (admission.valid_until IS NULL OR admission.valid_until > ${occurredAt})
          AND public.app_labs_deal_authorized(admission.deal_id, admission.laboratory_org_id, true)
        ORDER BY admission.created_at DESC, admission.id DESC
        LIMIT 1
      `);
      const admission = rows[0];
      if (!admission) throw new NotFoundException({ code: 'ACTIVE_LAB_SAMPLE_ADMISSION_REQUIRED' });
      await this.requireActor(tx, context, admission.laboratoryOrgId, 'SAMPLER', occurredAt);
      await this.requirePurposeEvidence(tx, {
        evidenceId: command.evidenceRef,
        context,
        dealId: command.dealId,
        purpose: 'ADMISSION',
        sampleId: null,
        shipmentId: command.shipmentId,
        acceptanceId: command.acceptanceId,
        laboratoryOrgId: admission.laboratoryOrgId,
        protocolNumber: null,
      });
    });
    return this.delegate.create(command, user);
  }

  async collect(id: string, command: CollectLabSampleCommand, user: RequestUser): Promise<LabMutationResult> {
    await this.requireSampleOperation(id, command.evidenceRef, command.occurredAt, user, 'SAMPLER', 'COLLECTION');
    return this.delegate.collect(id, command, user);
  }

  async recordCustody(id: string, command: RecordLabCustodyCommand, user: RequestUser): Promise<LabMutationResult> {
    const actorType: ActorType = command.eventType === 'RECEIVED'
      ? 'RECEIVER'
      : command.eventType === 'OPENED'
        ? 'ANALYST'
        : 'COURIER';
    await this.requireSampleOperation(
      id,
      command.evidenceRef,
      command.occurredAt,
      user,
      actorType,
      command.eventType as EvidencePurpose,
    );
    return this.delegate.recordCustody(id, command, user);
  }

  async recordTest(id: string, command: RecordLabTestCommand, user: RequestUser): Promise<LabMutationResult> {
    await this.requireSampleOperation(
      id,
      command.evidenceRef,
      command.occurredAt,
      user,
      'ANALYST',
      'TEST',
      optionalIdentifier(command.supersedesId, 'supersedesId'),
    );
    return this.delegate.recordTest(id, command, user);
  }

  private async requireReadableSample(sampleId: string, user: RequestUser): Promise<void> {
    const visible = await this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1 FROM public."lab_samples" sample
          WHERE sample."id" = ${sampleId}
            AND sample."tenantId" = ${context.tenantId}
            AND public.app_labs_deal_authorized(sample."dealId", sample."labId", false)
        ) AS valid
      `);
      return rows[0]?.valid === true;
    });
    if (!visible) throw new NotFoundException({ code: 'LAB_SAMPLE_NOT_AVAILABLE' });
  }

  private async requireSampleOperation(
    sampleId: string,
    evidenceId: string,
    occurredAtValue: string,
    user: RequestUser,
    actorType: ActorType,
    purpose: EvidencePurpose,
    supersedesId: string | null = null,
  ): Promise<void> {
    const occurredAt = requiredDate(occurredAtValue, 'occurredAt');
    await this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<SampleAuthority[]>(Prisma.sql`
        SELECT sample."id", sample."dealId", sample."shipmentId", sample."acceptanceId",
               sample."tenantId", sample."labId"
        FROM public."lab_samples" sample
        WHERE sample."id" = ${sampleId}
          AND sample."tenantId" = ${context.tenantId}
          AND public.app_labs_deal_authorized(sample."dealId", sample."labId", true)
        LIMIT 1
      `);
      const sample = rows[0];
      if (!sample?.labId) throw new NotFoundException({ code: 'LAB_SAMPLE_NOT_AVAILABLE' });
      await this.requireActor(tx, context, sample.labId, actorType, occurredAt);
      await this.requirePurposeEvidence(tx, {
        evidenceId,
        context,
        dealId: sample.dealId,
        purpose,
        sampleId: sample.id,
        shipmentId: sample.shipmentId,
        acceptanceId: sample.acceptanceId,
        laboratoryOrgId: sample.labId,
        protocolNumber: null,
      });
      if (purpose === 'TEST') {
        await this.requireCorrectionBinding(tx, evidenceId, supersedesId);
      }
    });
  }

  private async requireCorrectionBinding(
    tx: Prisma.TransactionClient,
    evidenceId: string,
    commandSupersedesId: string | null,
  ): Promise<void> {
    const evidence = await tx.dealDocument.findUnique({
      where: { id: evidenceId },
      select: { metadata: true },
    });
    const metadata = jsonObject(evidence?.metadata ?? null);
    const evidenceSupersedesId = typeof metadata.supersedesId === 'string'
      ? optionalIdentifier(metadata.supersedesId, 'evidence.supersedesId')
      : null;
    if (evidenceSupersedesId !== commandSupersedesId) {
      throw new UnprocessableEntityException({
        code: 'LAB_CORRECTION_EVIDENCE_MISMATCH',
        commandSupersedesId,
        evidenceSupersedesId,
      });
    }
  }

  private async requireActor(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    laboratoryOrgId: string,
    actorType: ActorType,
    occurredAt: Date,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT public.app_labs_actor_valid(
        ${context.tenantId}, ${laboratoryOrgId}, ${context.userId}, ${actorType}, ${occurredAt}
      ) AS valid
    `);
    if (!rows[0]?.valid) {
      throw new ForbiddenException({ code: 'LAB_PHYSICAL_ACTOR_TYPE_REQUIRED', actorType });
    }
  }

  private async requirePurposeEvidence(
    tx: Prisma.TransactionClient,
    input: Readonly<{
      evidenceId: string;
      context: TrustedRlsContext;
      dealId: string;
      purpose: EvidencePurpose;
      sampleId: string | null;
      shipmentId: string | null;
      acceptanceId: string | null;
      laboratoryOrgId: string;
      protocolNumber: string | null;
    }>,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT public.app_labs_evidence_purpose_valid(
        ${input.evidenceId}, ${input.context.tenantId}, ${input.dealId}, ${input.purpose},
        ${input.sampleId}, ${input.shipmentId}, ${input.acceptanceId},
        ${input.laboratoryOrgId}, ${input.protocolNumber}
      ) AS valid
    `);
    if (!rows[0]?.valid) {
      throw new UnprocessableEntityException({ code: 'LAB_EVIDENCE_PURPOSE_MISMATCH', purpose: input.purpose });
    }
  }
}

function requiredDate(value: string, field: string): Date {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new UnprocessableEntityException({ code: 'INVALID_DATE', field });
  }
  return date;
}

function optionalIdentifier(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 200 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new UnprocessableEntityException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
