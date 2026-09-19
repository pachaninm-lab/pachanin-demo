import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import {
  RlsTransactionService,
  TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { Role } from '../../common/types/request-user';
import {
  CollectLabSampleCommand,
  CreateLabSampleCommand,
  LabCustodyEventRecord,
  LabMutationResult,
  LabProtocolRecord,
  LabRepository,
  LabSampleRecord,
  LabTestRecord,
  LabWorkspace,
  RecordLabCustodyCommand,
  RecordLabTestCommand,
} from './lab.repository';

type LabSampleRow = Omit<LabSampleRecord, 'version'> & Readonly<{ version: bigint }>;

type NormalizedCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  expectedVersion?: bigint;
}> & Record<string, unknown>;

type MutationArtifacts = Readonly<{
  sample: LabSampleRow;
  test?: LabTestRecord;
  custodyEvent?: LabCustodyEventRecord;
  eventPayload: Prisma.InputJsonObject;
}>;

type LaboratoryAuthority = Readonly<{
  laboratoryId: string;
  laboratoryOrgId: string;
  laboratoryName: string;
  accreditationRef: string;
}>;

type SampleAdmission = Readonly<{
  id: string;
  laboratoryOrgId: string;
}>;

type MethodAuthority = Readonly<{
  id: string;
  parameter: string;
  unit: string;
  normMin: string | null;
  normMax: string | null;
  standardRef: string;
}>;

type EquipmentAuthority = Readonly<{ id: string }>;

const OPERATIONAL_ROLES = new Set<string>([
  Role.LAB,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);

const PRIVILEGED_ROLES = new Set<string>([
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);

@Injectable()
export class PrismaLabRepository implements LabRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<LabSampleRecord[]> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<LabSampleRow[]>(Prisma.sql`
        SELECT sample.*
        FROM public."lab_samples" sample
        ORDER BY sample."updatedAt" DESC, sample."id" ASC
        LIMIT 500
      `);
      return rows.map(publicSample);
    });
  }

  async getById(id: string, user: RequestUser): Promise<LabSampleRecord> {
    const sampleId = requiredIdentifier(id, 'sampleId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const sample = await this.findSample(tx, sampleId);
      if (!sample) throw scopedNotFound();
      return publicSample(sample);
    });
  }

  async workspace(id: string, user: RequestUser): Promise<LabWorkspace> {
    const sampleId = requiredIdentifier(id, 'sampleId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const sample = await this.findSample(tx, sampleId);
      if (!sample) throw scopedNotFound();
      const [tests, custody, protocol] = await Promise.all([
        this.findTests(tx, sampleId),
        this.findCustody(tx, sampleId),
        this.findProtocol(tx, sampleId),
      ]);
      return { sample: publicSample(sample), tests, custody, protocol };
    });
  }

  async create(command: CreateLabSampleCommand, user: RequestUser): Promise<LabMutationResult> {
    this.assertOperationalRole(user);
    const normalized: NormalizedCommand = {
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      dealId: requiredIdentifier(command.dealId, 'dealId'),
      shipmentId: requiredIdentifier(command.shipmentId, 'shipmentId'),
      acceptanceId: requiredIdentifier(command.acceptanceId, 'acceptanceId'),
      evidenceRef: requiredIdentifier(command.evidenceRef, 'evidenceRef'),
      occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
      note: optionalText(command.note, 'note', 1000),
    };
    const requestFingerprint = digest({ action: 'lab.sample.create', command: normalized });

    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        const persistentKey = this.persistentKey(context, normalized.idempotencyKey);
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (replay) return replay;

        const dealId = normalized.dealId as string;
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${dealId}, 73)) IS NULL AS locked
        `);
        const lockedReplay = await this.replay(tx, persistentKey, requestFingerprint);
        if (lockedReplay) return lockedReplay;

        const admission = await this.findSampleAdmission(
          tx,
          context,
          dealId,
          normalized.shipmentId as string,
          normalized.acceptanceId as string,
        );
        if (!admission) {
          throw new ConflictException({ code: 'ACTIVE_LAB_SAMPLE_ADMISSION_REQUIRED' });
        }
        const authority = await this.requireLaboratoryAuthority(
          tx,
          context,
          admission.laboratoryOrgId,
          dealId,
        );
        await this.requireEvidence(
          tx,
          normalized.evidenceRef as string,
          context.tenantId,
          dealId,
          normalized.shipmentId as string,
        );
        await this.requireShipmentAndAcceptance(
          tx,
          dealId,
          normalized.shipmentId as string,
          normalized.acceptanceId as string,
        );

        const sampleId = `sample-${randomUUID()}`;
        const sampleCode = `LAB-${sampleId.slice(-12).toUpperCase()}`;
        const occurredAt = normalized.occurredAt as Date;
        const rows = await tx.$queryRaw<LabSampleRow[]>(Prisma.sql`
          INSERT INTO public."lab_samples" (
            "id", "dealId", "shipmentId", "acceptanceId", "tenantId", "status",
            "custodyStatus", "sampleCode", "labId", "labName", "assignedActorUserId",
            "latestEvidenceFileId", "version", "createdAt", "updatedAt"
          )
          SELECT
            ${sampleId}, deal."id", ${normalized.shipmentId as string},
            ${normalized.acceptanceId as string}, ${context.tenantId}, 'CREATED',
            'CREATED', ${sampleCode}, ${authority.laboratoryOrgId},
            ${authority.laboratoryName}, ${context.userId}, ${normalized.evidenceRef as string},
            0, ${occurredAt}, now()
          FROM public."deals" deal
          WHERE deal."id" = ${dealId} AND deal."tenantId" = ${context.tenantId}
          RETURNING *
        `);
        const sample = rows[0];
        if (!sample) throw scopedNotFound();

        const consumed = await tx.$executeRaw(Prisma.sql`
          UPDATE labs.sample_admissions
          SET status = 'CONSUMED', consumed_at = now(), consumed_by_sample_id = ${sampleId},
              consumed_by_command_id = ${normalized.commandId}, version = version + 1,
              updated_at = now()
          WHERE id = ${admission.id} AND status = 'ACTIVE'
        `);
        if (consumed !== 1) {
          throw new ConflictException({ code: 'LAB_SAMPLE_ADMISSION_RACE_LOST' });
        }

        const custodyEvent = await this.insertCustodyEvent(tx, {
          sample,
          context,
          eventType: 'CREATED',
          fromStatus: 'NONE',
          toStatus: 'CREATED',
          evidenceRef: normalized.evidenceRef as string,
          commandId: normalized.commandId,
          persistentKey,
          correlationId: normalized.correlationId,
          occurredAt,
          note: normalized.note as string | undefined,
        });
        return this.commitArtifacts(
          tx,
          context,
          normalized,
          requestFingerprint,
          'lab.sample.create',
          'lab.sample.created',
          { sample, custodyEvent, eventPayload: { sampleCode, admissionId: admission.id } },
          null,
          persistentKey,
        );
      }, { timeout: 20_000 });
    } catch (error) {
      return this.replayAfterUniqueConflict(error, user, normalized, requestFingerprint);
    }
  }

  async collect(
    id: string,
    command: CollectLabSampleCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    this.assertOperationalRole(user);
    const normalized = normalizeVersionedCommand(id, command, {
      evidenceRef: requiredIdentifier(command.evidenceRef, 'evidenceRef'),
      occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
    });
    return this.executeMutation(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.sample.collect',
      'lab.sample.collected',
      async (tx, sample, context, persistentKey) => {
        if (sample.status !== 'CREATED') {
          throw invalidTransition(sample.status, 'COLLECTED');
        }
        await this.requireEvidence(
          tx,
          normalized.evidenceRef as string,
          context.tenantId,
          sample.dealId,
          sample.shipmentId ?? undefined,
        );
        const updated = await this.casSampleUpdate(tx, sample, normalized.expectedVersion as bigint, {
          status: 'COLLECTED',
          custodyStatus: 'COLLECTED',
          collectedAt: normalized.occurredAt as Date,
          latestEvidenceFileId: normalized.evidenceRef as string,
        });
        const custodyEvent = await this.insertCustodyEvent(tx, {
          sample: updated,
          context,
          eventType: 'COLLECTED',
          fromStatus: sample.status,
          toStatus: updated.status,
          evidenceRef: normalized.evidenceRef as string,
          commandId: normalized.commandId,
          persistentKey,
          correlationId: normalized.correlationId,
          occurredAt: normalized.occurredAt as Date,
        });
        return { sample: updated, custodyEvent, eventPayload: { eventType: 'COLLECTED' } };
      },
    );
  }

  async recordCustody(
    id: string,
    command: RecordLabCustodyCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    this.assertOperationalRole(user);
    const eventType = requiredCustodyEvent(command.eventType);
    const normalized = normalizeVersionedCommand(id, command, {
      eventType,
      evidenceRef: requiredIdentifier(command.evidenceRef, 'evidenceRef'),
      occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
      note: optionalText(command.note, 'note', 1000),
    });
    return this.executeMutation(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.custody.record',
      'lab.custody.recorded',
      async (tx, sample, context, persistentKey) => {
        const next = custodyTransition(sample, eventType);
        await this.requireEvidence(
          tx,
          normalized.evidenceRef as string,
          context.tenantId,
          sample.dealId,
          sample.shipmentId ?? undefined,
        );
        const updated = await this.casSampleUpdate(tx, sample, normalized.expectedVersion as bigint, {
          status: next.status,
          custodyStatus: next.custodyStatus,
          latestEvidenceFileId: normalized.evidenceRef as string,
        });
        const custodyEvent = await this.insertCustodyEvent(tx, {
          sample: updated,
          context,
          eventType,
          fromStatus: sample.status,
          toStatus: updated.status,
          evidenceRef: normalized.evidenceRef as string,
          commandId: normalized.commandId,
          persistentKey,
          correlationId: normalized.correlationId,
          occurredAt: normalized.occurredAt as Date,
          note: normalized.note as string | undefined,
        });
        return { sample: updated, custodyEvent, eventPayload: { eventType } };
      },
    );
  }

  async recordTest(
    id: string,
    command: RecordLabTestCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    this.assertOperationalRole(user);
    const normalized = normalizeVersionedCommand(id, command, {
      metric: requiredText(command.metric, 'metric', 120),
      value: requiredFiniteNumber(command.value, 'value', -1_000_000_000, 1_000_000_000),
      unit: requiredText(command.unit, 'unit', 32),
      methodCode: requiredIdentifier(command.methodCode, 'methodCode'),
      equipmentCode: requiredIdentifier(command.equipmentCode, 'equipmentCode'),
      evidenceRef: requiredIdentifier(command.evidenceRef, 'evidenceRef'),
      supersedesId: optionalIdentifier(command.supersedesId, 'supersedesId'),
      occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
      note: optionalText(command.note, 'note', 1000),
    });
    return this.executeMutation(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.test.record',
      'lab.test.recorded',
      async (tx, sample, context, persistentKey) => {
        if (!['RECEIVED', 'ANALYSIS_IN_PROGRESS'].includes(sample.status)) {
          throw invalidTransition(sample.status, 'ANALYSIS_IN_PROGRESS');
        }
        if (!['RECEIVED', 'OPENED', 'ANALYSIS_IN_PROGRESS'].includes(sample.custodyStatus)) {
          throw new ConflictException({ code: 'LAB_CUSTODY_NOT_RECEIVED' });
        }
        await this.requireEvidence(
          tx,
          normalized.evidenceRef as string,
          context.tenantId,
          sample.dealId,
          sample.shipmentId ?? undefined,
        );
        const method = await this.requireMethod(
          tx,
          context,
          sample.labId as string,
          normalized.methodCode as string,
          normalized.metric as string,
          normalized.unit as string,
          sample.dealId,
        );
        const equipment = await this.requireEquipment(
          tx,
          context,
          sample.labId as string,
          normalized.equipmentCode as string,
          sample.dealId,
        );
        const value = decimalSix(normalized.value as number, 'value');
        const result = withinNorm(value, method.normMin, method.normMax) ? 'PASSED' : 'FAILED';
        const testId = `lab-test-${randomUUID()}`;
        const rows = await tx.$queryRaw<LabTestRecord[]>(Prisma.sql`
          INSERT INTO public."lab_tests" (
            "id", "sampleId", "tenantId", "parameter", "value", "valueDec", "unit",
            "normMin", "normMax", "normMinDec", "normMaxDec", "passed", "result",
            "methodId", "equipmentId", "evidenceFileId", "actorUserId", "commandId",
            "idempotencyKey", "correlationId", "supersedesId", "recordedAt"
          ) VALUES (
            ${testId}, ${sample.id}, ${context.tenantId}, ${method.parameter},
            ${Number(value)}, CAST(${value} AS numeric), ${method.unit},
            ${method.normMin === null ? null : Number(method.normMin)},
            ${method.normMax === null ? null : Number(method.normMax)},
            CAST(${method.normMin} AS numeric), CAST(${method.normMax} AS numeric),
            ${result === 'PASSED'}, ${result}, ${method.id}, ${equipment.id},
            ${normalized.evidenceRef as string}, ${context.userId}, ${normalized.commandId},
            ${persistentKey}, ${normalized.correlationId},
            ${(normalized.supersedesId as string | undefined) ?? null},
            ${normalized.occurredAt as Date}
          )
          RETURNING
            "id", "sampleId", "tenantId", "parameter", "valueDec"::text AS "value",
            "unit", "normMinDec"::text AS "normMin", "normMaxDec"::text AS "normMax",
            "result", "methodId", "equipmentId", "evidenceFileId", "actorUserId",
            "commandId", "idempotencyKey", "correlationId", "supersedesId", "recordedAt"
        `);
        const test = rows[0];
        if (!test) throw new ConflictException('Laboratory test insert returned no authoritative row.');
        const updated = await this.casSampleUpdate(tx, sample, normalized.expectedVersion as bigint, {
          status: 'ANALYSIS_IN_PROGRESS',
          custodyStatus: 'ANALYSIS_IN_PROGRESS',
          latestEvidenceFileId: normalized.evidenceRef as string,
        });
        return {
          sample: updated,
          test,
          eventPayload: {
            testId,
            methodId: method.id,
            equipmentId: equipment.id,
            result,
            standardRef: method.standardRef,
            supersedesId: test.supersedesId,
          },
        };
      },
    );
  }

  private async executeMutation(
    sampleId: string,
    command: NormalizedCommand,
    user: RequestUser,
    action: string,
    eventType: string,
    work: (
      tx: Prisma.TransactionClient,
      sample: LabSampleRow,
      context: TrustedRlsContext,
      persistentKey: string,
    ) => Promise<MutationArtifacts>,
  ): Promise<LabMutationResult> {
    const requestFingerprint = digest({ action, sampleId, command });
    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        const persistentKey = this.persistentKey(context, command.idempotencyKey);
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (replay) return replay;

        const candidate = await this.findSample(tx, sampleId);
        if (!candidate) throw scopedNotFound();
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${candidate.dealId}, 73)) IS NULL AS locked
        `);
        const lockedReplay = await this.replay(tx, persistentKey, requestFingerprint);
        if (lockedReplay) return lockedReplay;

        const sample = await this.findSample(tx, sampleId);
        if (!sample) throw scopedNotFound();
        await this.requireLaboratoryAuthority(tx, context, sample.labId as string, sample.dealId);
        const artifacts = await work(tx, sample, context, persistentKey);
        return this.commitArtifacts(
          tx,
          context,
          command,
          requestFingerprint,
          action,
          eventType,
          artifacts,
          sample,
          persistentKey,
        );
      }, { timeout: 20_000 });
    } catch (error) {
      return this.replayAfterUniqueConflict(error, user, command, requestFingerprint);
    }
  }

  private async commitArtifacts(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    command: NormalizedCommand,
    requestFingerprint: string,
    action: string,
    eventType: string,
    artifacts: MutationArtifacts,
    before: LabSampleRow | null,
    persistentKey: string,
  ): Promise<LabMutationResult> {
    const auditId = `audit-${randomUUID()}`;
    const outboxId = `outbox-${randomUUID()}`;
    const previousAudit = await tx.auditEvent.findFirst({
      where: { dealId: artifacts.sample.dealId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const auditMaterial = {
      id: auditId,
      action,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      dealId: artifacts.sample.dealId,
      objectType: 'lab_sample',
      objectId: artifacts.sample.id,
      beforeState: before ? sampleState(before) : { exists: false },
      afterState: sampleState(artifacts.sample),
      outcome: 'SUCCESS',
      correlationId: command.correlationId,
      metadata: {
        commandId: command.commandId,
        idempotencyKey: persistentKey,
        eventType,
        ...artifacts.eventPayload,
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
    await tx.outboxEntry.create({
      data: {
        id: outboxId,
        type: eventType,
        dealId: artifacts.sample.dealId,
        status: 'PENDING',
        idempotencyKey: persistentKey,
        correlationId: command.correlationId,
        auditId,
        payload: {
          schemaVersion: 'lab-event.v1',
          requestFingerprint,
          sampleId: artifacts.sample.id,
          testId: artifacts.test?.id ?? null,
          custodyEventId: artifacts.custodyEvent?.id ?? null,
          ...artifacts.eventPayload,
        } as Prisma.InputJsonValue,
      },
    });
    return {
      sample: publicSample(artifacts.sample),
      auditId,
      outboxId,
      duplicate: false,
      test: artifacts.test,
      custodyEvent: artifacts.custodyEvent,
    };
  }

  private async replay(
    tx: Prisma.TransactionClient,
    persistentKey: string,
    requestFingerprint: string,
  ): Promise<LabMutationResult | null> {
    const outbox = await tx.outboxEntry.findUnique({ where: { idempotencyKey: persistentKey } });
    if (!outbox) return null;
    const payload = jsonObject(outbox.payload);
    if (payload.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The idempotency key is already bound to a different laboratory command.',
      });
    }
    if (!outbox.auditId || typeof payload.sampleId !== 'string') {
      throw new ConflictException('Atomic laboratory receipt is incomplete.');
    }
    const sample = await this.findSample(tx, payload.sampleId);
    if (!sample) throw new ConflictException('Laboratory replay sample is no longer visible.');
    const test = typeof payload.testId === 'string'
      ? await this.findTest(tx, payload.testId)
      : undefined;
    const custodyEvent = typeof payload.custodyEventId === 'string'
      ? await this.findCustodyEvent(tx, payload.custodyEventId)
      : undefined;
    return {
      sample: publicSample(sample),
      auditId: outbox.auditId,
      outboxId: outbox.id,
      duplicate: true,
      test,
      custodyEvent,
    };
  }

  private async replayAfterUniqueConflict(
    error: unknown,
    user: RequestUser,
    command: NormalizedCommand,
    requestFingerprint: string,
  ): Promise<LabMutationResult> {
    if (!isUniqueConstraintError(error)) throw error;
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const replay = await this.replay(
        tx,
        this.persistentKey(context, command.idempotencyKey),
        requestFingerprint,
      );
      if (!replay) throw error;
      return replay;
    });
  }

  private async findSample(
    tx: Prisma.TransactionClient,
    sampleId: string,
  ): Promise<LabSampleRow | null> {
    const rows = await tx.$queryRaw<LabSampleRow[]>(Prisma.sql`
      SELECT sample.*
      FROM public."lab_samples" sample
      WHERE sample."id" = ${sampleId}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findTests(
    tx: Prisma.TransactionClient,
    sampleId: string,
  ): Promise<LabTestRecord[]> {
    return tx.$queryRaw<LabTestRecord[]>(Prisma.sql`
      SELECT
        test."id", test."sampleId", test."tenantId", test."parameter",
        test."valueDec"::text AS "value", test."unit",
        test."normMinDec"::text AS "normMin", test."normMaxDec"::text AS "normMax",
        test."result", test."methodId", test."equipmentId", test."evidenceFileId",
        test."actorUserId", test."commandId", test."idempotencyKey", test."correlationId",
        test."supersedesId", test."recordedAt"
      FROM public."lab_tests" test
      WHERE test."sampleId" = ${sampleId}
      ORDER BY test."recordedAt" ASC, test."id" ASC
      LIMIT 1000
    `);
  }

  private async findTest(
    tx: Prisma.TransactionClient,
    testId: string,
  ): Promise<LabTestRecord | undefined> {
    const rows = await tx.$queryRaw<LabTestRecord[]>(Prisma.sql`
      SELECT
        test."id", test."sampleId", test."tenantId", test."parameter",
        test."valueDec"::text AS "value", test."unit",
        test."normMinDec"::text AS "normMin", test."normMaxDec"::text AS "normMax",
        test."result", test."methodId", test."equipmentId", test."evidenceFileId",
        test."actorUserId", test."commandId", test."idempotencyKey", test."correlationId",
        test."supersedesId", test."recordedAt"
      FROM public."lab_tests" test
      WHERE test."id" = ${testId}
      LIMIT 1
    `);
    return rows[0];
  }

  private async findCustody(
    tx: Prisma.TransactionClient,
    sampleId: string,
  ): Promise<LabCustodyEventRecord[]> {
    return tx.$queryRaw<LabCustodyEventRecord[]>(Prisma.sql`
      SELECT
        event.id, event.sample_id AS "sampleId", event.tenant_id AS "tenantId",
        event.event_type AS "eventType", event.from_status AS "fromStatus",
        event.to_status AS "toStatus", event.actor_user_id AS "actorUserId",
        event.laboratory_org_id AS "laboratoryOrgId", event.evidence_file_id AS "evidenceFileId",
        event.command_id AS "commandId", event.idempotency_key AS "idempotencyKey",
        event.correlation_id AS "correlationId", event.occurred_at AS "occurredAt",
        event.note, event.prev_hash AS "prevHash", event.hash, event.created_at AS "createdAt"
      FROM labs.sample_custody_events event
      WHERE event.sample_id = ${sampleId}
      ORDER BY event.occurred_at ASC, event.id ASC
      LIMIT 1000
    `);
  }

  private async findCustodyEvent(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<LabCustodyEventRecord | undefined> {
    const rows = await tx.$queryRaw<LabCustodyEventRecord[]>(Prisma.sql`
      SELECT
        event.id, event.sample_id AS "sampleId", event.tenant_id AS "tenantId",
        event.event_type AS "eventType", event.from_status AS "fromStatus",
        event.to_status AS "toStatus", event.actor_user_id AS "actorUserId",
        event.laboratory_org_id AS "laboratoryOrgId", event.evidence_file_id AS "evidenceFileId",
        event.command_id AS "commandId", event.idempotency_key AS "idempotencyKey",
        event.correlation_id AS "correlationId", event.occurred_at AS "occurredAt",
        event.note, event.prev_hash AS "prevHash", event.hash, event.created_at AS "createdAt"
      FROM labs.sample_custody_events event
      WHERE event.id = ${eventId}
      LIMIT 1
    `);
    return rows[0];
  }

  private async findProtocol(
    tx: Prisma.TransactionClient,
    sampleId: string,
  ): Promise<LabProtocolRecord | null> {
    const rows = await tx.$queryRaw<LabProtocolRecord[]>(Prisma.sql`
      SELECT
        protocol.id, protocol.sample_id AS "sampleId", protocol.tenant_id AS "tenantId",
        protocol.protocol_number AS "protocolNumber",
        protocol.laboratory_org_id AS "laboratoryOrgId",
        protocol.accreditation_ref AS "accreditationRef",
        protocol.standard_ref AS "standardRef", protocol.result,
        protocol.signed_evidence_file_id AS "signedEvidenceFileId",
        protocol.finalized_by_user_id AS "finalizedByUserId",
        protocol.finalized_at AS "finalizedAt", protocol.version,
        protocol.supersedes_id AS "supersedesId", protocol.created_at AS "createdAt"
      FROM labs.protocols protocol
      WHERE protocol.sample_id = ${sampleId}
      ORDER BY protocol.version DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findSampleAdmission(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    dealId: string,
    shipmentId: string,
    acceptanceId: string,
  ): Promise<SampleAdmission | null> {
    const rows = await tx.$queryRaw<SampleAdmission[]>(Prisma.sql`
      SELECT admission.id, admission.laboratory_org_id AS "laboratoryOrgId"
      FROM labs.sample_admissions admission
      WHERE admission.tenant_id = ${context.tenantId}
        AND admission.deal_id = ${dealId}
        AND admission.shipment_id = ${shipmentId}
        AND admission.acceptance_id = ${acceptanceId}
        AND admission.status = 'ACTIVE'
        AND admission.valid_from <= now()
        AND (admission.valid_until IS NULL OR admission.valid_until > now())
        AND (
          admission.laboratory_org_id = ${context.orgId}
          OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER', 'ADMIN')
        )
      FOR UPDATE
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async requireLaboratoryAuthority(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    laboratoryOrgId: string,
    dealId: string,
  ): Promise<LaboratoryAuthority> {
    if (!laboratoryOrgId) throw new ConflictException({ code: 'LABORATORY_ASSIGNMENT_REQUIRED' });
    const rows = await tx.$queryRaw<LaboratoryAuthority[]>(Prisma.sql`
      SELECT
        laboratory.id AS "laboratoryId",
        laboratory.organization_id AS "laboratoryOrgId",
        organization.name AS "laboratoryName",
        laboratory.accreditation_ref AS "accreditationRef"
      FROM labs.laboratories laboratory
      JOIN public."organizations" organization ON organization."id" = laboratory.organization_id
      WHERE laboratory.tenant_id = ${context.tenantId}
        AND laboratory.organization_id = ${laboratoryOrgId}
        AND laboratory.status = 'ACTIVE'
        AND laboratory.accreditation_status = 'VERIFIED'
        AND laboratory.valid_from <= now()
        AND (laboratory.valid_until IS NULL OR laboratory.valid_until > now())
        AND organization."tenantId" = ${context.tenantId}
        AND organization."status" = 'VERIFIED'
        AND organization."kycStatus" = 'APPROVED'
        AND public.app_labs_evidence_valid(
          laboratory.evidence_file_id, ${context.tenantId}, ${dealId}
        )
        AND (
          current_setting('app.current_role', true) IN ('SUPPORT_MANAGER', 'ADMIN')
          OR (
            laboratory.organization_id = ${context.orgId}
            AND EXISTS (
              SELECT 1 FROM labs.authorized_actors actor
              WHERE actor.tenant_id = laboratory.tenant_id
                AND actor.laboratory_org_id = laboratory.organization_id
                AND actor.user_id = ${context.userId}
                AND actor.status = 'ACTIVE'
                AND actor.valid_from <= now()
                AND (actor.valid_until IS NULL OR actor.valid_until > now())
                AND public.app_labs_evidence_valid(
                  actor.evidence_file_id, ${context.tenantId}, ${dealId}
                )
            )
          )
        )
      LIMIT 1
    `);
    const authority = rows[0];
    if (!authority) throw new ForbiddenException({ code: 'LABORATORY_AUTHORITY_DENIED' });
    return authority;
  }

  private async requireMethod(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    laboratoryOrgId: string,
    methodCode: string,
    metric: string,
    unit: string,
    dealId: string,
  ): Promise<MethodAuthority> {
    const rows = await tx.$queryRaw<MethodAuthority[]>(Prisma.sql`
      SELECT method.id, method.parameter, method.unit,
             method.norm_min::text AS "normMin", method.norm_max::text AS "normMax",
             method.standard_ref AS "standardRef"
      FROM labs.methods method
      WHERE method.tenant_id = ${context.tenantId}
        AND method.laboratory_org_id = ${laboratoryOrgId}
        AND method.code = ${methodCode}
        AND lower(method.parameter) = lower(${metric})
        AND method.unit = ${unit}
        AND method.status = 'ACTIVE'
        AND method.valid_from <= now()
        AND (method.valid_until IS NULL OR method.valid_until > now())
        AND public.app_labs_evidence_valid(method.evidence_file_id, ${context.tenantId}, ${dealId})
      LIMIT 1
    `);
    if (!rows[0]) throw new ConflictException({ code: 'LAB_METHOD_AUTHORITY_REQUIRED' });
    if (rows[0].normMin === null && rows[0].normMax === null) {
      throw new ConflictException({ code: 'LAB_METHOD_NORM_REQUIRED' });
    }
    return rows[0];
  }

  private async requireEquipment(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    laboratoryOrgId: string,
    equipmentCode: string,
    dealId: string,
  ): Promise<EquipmentAuthority> {
    const rows = await tx.$queryRaw<EquipmentAuthority[]>(Prisma.sql`
      SELECT equipment.id
      FROM labs.equipment equipment
      WHERE equipment.tenant_id = ${context.tenantId}
        AND equipment.laboratory_org_id = ${laboratoryOrgId}
        AND equipment.code = ${equipmentCode}
        AND equipment.status = 'ACTIVE'
        AND equipment.calibration_valid_until > now()
        AND public.app_labs_evidence_valid(equipment.evidence_file_id, ${context.tenantId}, ${dealId})
      LIMIT 1
    `);
    if (!rows[0]) throw new ConflictException({ code: 'LAB_EQUIPMENT_AUTHORITY_REQUIRED' });
    return rows[0];
  }

  private async requireEvidence(
    tx: Prisma.TransactionClient,
    evidenceId: string,
    tenantId: string,
    dealId: string,
    shipmentId?: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT public.app_labs_evidence_valid(${evidenceId}, ${tenantId}, ${dealId}) AS valid
    `);
    if (!rows[0]?.valid) throw new ConflictException({ code: 'VERIFIED_LAB_EVIDENCE_REQUIRED' });
    if (shipmentId) {
      const evidence = await tx.dealDocument.findUnique({ where: { id: evidenceId } });
      const metadata = jsonObject(evidence?.metadata ?? null);
      if (typeof metadata.shipmentId === 'string' && metadata.shipmentId !== shipmentId) {
        throw new ConflictException({ code: 'LAB_EVIDENCE_SHIPMENT_MISMATCH' });
      }
    }
  }

  private async requireShipmentAndAcceptance(
    tx: Prisma.TransactionClient,
    dealId: string,
    shipmentId: string,
    acceptanceId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM public."shipments" shipment
        JOIN public."acceptance_records" acceptance
          ON acceptance."id" = ${acceptanceId}
         AND acceptance."dealId" = shipment."dealId"
         AND acceptance."shipmentId" = shipment."id"
        WHERE shipment."id" = ${shipmentId}
          AND shipment."dealId" = ${dealId}
          AND shipment."status" IN ('ARRIVED', 'AT_UNLOADING', 'DELIVERED', 'COMPLETED')
      ) AS valid
    `);
    if (!rows[0]?.valid) throw new ConflictException({ code: 'LAB_SAMPLE_BASIS_INVALID' });
  }

  private async insertCustodyEvent(
    tx: Prisma.TransactionClient,
    input: {
      sample: LabSampleRow;
      context: TrustedRlsContext;
      eventType: string;
      fromStatus: string;
      toStatus: string;
      evidenceRef: string;
      commandId: string;
      persistentKey: string;
      correlationId: string;
      occurredAt: Date;
      note?: string;
    },
  ): Promise<LabCustodyEventRecord> {
    const previous = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT hash FROM labs.sample_custody_events
      WHERE sample_id = ${input.sample.id}
      ORDER BY occurred_at DESC, id DESC
      LIMIT 1
    `);
    const eventId = `lab-custody-${randomUUID()}`;
    const material = {
      id: eventId,
      sampleId: input.sample.id,
      tenantId: input.context.tenantId,
      eventType: input.eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorUserId: input.context.userId,
      laboratoryOrgId: input.sample.labId,
      evidenceFileId: input.evidenceRef,
      commandId: input.commandId,
      idempotencyKey: `${input.persistentKey}:custody`,
      correlationId: input.correlationId,
      occurredAt: input.occurredAt.toISOString(),
      note: input.note ?? null,
      prevHash: previous[0]?.hash ?? null,
    };
    const eventHash = digest(material);
    const rows = await tx.$queryRaw<LabCustodyEventRecord[]>(Prisma.sql`
      INSERT INTO labs.sample_custody_events (
        id, sample_id, tenant_id, event_type, from_status, to_status,
        actor_user_id, laboratory_org_id, evidence_file_id, command_id,
        idempotency_key, correlation_id, occurred_at, note, prev_hash, hash
      ) VALUES (
        ${eventId}, ${input.sample.id}, ${input.context.tenantId}, ${input.eventType},
        ${input.fromStatus}, ${input.toStatus}, ${input.context.userId},
        ${input.sample.labId as string}, ${input.evidenceRef}, ${input.commandId},
        ${`${input.persistentKey}:custody`}, ${input.correlationId}, ${input.occurredAt},
        ${input.note ?? null}, ${previous[0]?.hash ?? null}, ${eventHash}
      )
      RETURNING
        id, sample_id AS "sampleId", tenant_id AS "tenantId", event_type AS "eventType",
        from_status AS "fromStatus", to_status AS "toStatus", actor_user_id AS "actorUserId",
        laboratory_org_id AS "laboratoryOrgId", evidence_file_id AS "evidenceFileId",
        command_id AS "commandId", idempotency_key AS "idempotencyKey",
        correlation_id AS "correlationId", occurred_at AS "occurredAt", note,
        prev_hash AS "prevHash", hash, created_at AS "createdAt"
    `);
    if (!rows[0]) throw new ConflictException('Custody event insert returned no authoritative row.');
    return rows[0];
  }

  private async casSampleUpdate(
    tx: Prisma.TransactionClient,
    sample: LabSampleRow,
    expectedVersion: bigint,
    patch: {
      status: string;
      custodyStatus: string;
      collectedAt?: Date;
      latestEvidenceFileId: string;
    },
  ): Promise<LabSampleRow> {
    if (sample.version !== expectedVersion) throw staleVersion(sample.version);
    const rows = await tx.$queryRaw<LabSampleRow[]>(Prisma.sql`
      UPDATE public."lab_samples"
      SET "status" = ${patch.status}, "custodyStatus" = ${patch.custodyStatus},
          "collectedAt" = COALESCE(${patch.collectedAt ?? null}, "collectedAt"),
          "latestEvidenceFileId" = ${patch.latestEvidenceFileId},
          "version" = "version" + 1, "updatedAt" = now()
      WHERE "id" = ${sample.id} AND "version" = ${expectedVersion}
      RETURNING *
    `);
    if (!rows[0]) throw new ConflictException({ code: 'CONCURRENT_LAB_SAMPLE_UPDATE' });
    return rows[0];
  }

  private persistentKey(context: TrustedRlsContext, clientKey: string): string {
    return `labs:${context.tenantId}:${context.userId}:${clientKey}`;
  }

  private assertOperationalRole(user: RequestUser): void {
    if (!OPERATIONAL_ROLES.has(String(user.role))) {
      throw new ForbiddenException({ code: 'LAB_OPERATION_ROLE_DENIED' });
    }
  }
}

function normalizeVersionedCommand(
  sampleId: string,
  command: {
    commandId: string;
    idempotencyKey: string;
    correlationId?: string;
    expectedVersion: string;
  },
  fields: Record<string, unknown>,
): NormalizedCommand {
  return {
    sampleId: requiredIdentifier(sampleId, 'sampleId'),
    commandId: requiredIdentifier(command.commandId, 'commandId'),
    idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
    correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
    expectedVersion: requiredVersion(command.expectedVersion),
    ...fields,
  };
}

function publicSample(sample: LabSampleRow): LabSampleRecord {
  return { ...sample, version: sample.version.toString() };
}

function sampleState(sample: LabSampleRow): Prisma.InputJsonObject {
  return {
    id: sample.id,
    dealId: sample.dealId,
    status: sample.status,
    custodyStatus: sample.custodyStatus,
    labId: sample.labId,
    assignedActorUserId: sample.assignedActorUserId,
    latestEvidenceFileId: sample.latestEvidenceFileId,
    version: sample.version.toString(),
  };
}

function custodyTransition(
  sample: LabSampleRow,
  eventType: string,
): { status: string; custodyStatus: string } {
  if (eventType === 'SEALED') {
    if (!['COLLECTED', 'IN_TRANSIT', 'RECEIVED'].includes(sample.status)) {
      throw invalidTransition(sample.status, 'SEALED');
    }
    return { status: sample.status, custodyStatus: 'SEALED' };
  }
  if (eventType === 'HANDOFF') {
    if (sample.status !== 'COLLECTED' || !['COLLECTED', 'SEALED'].includes(sample.custodyStatus)) {
      throw invalidTransition(sample.status, 'IN_TRANSIT');
    }
    return { status: 'IN_TRANSIT', custodyStatus: 'IN_TRANSIT' };
  }
  if (eventType === 'RECEIVED') {
    if (sample.status !== 'IN_TRANSIT') throw invalidTransition(sample.status, 'RECEIVED');
    return { status: 'RECEIVED', custodyStatus: 'RECEIVED' };
  }
  if (eventType === 'OPENED') {
    if (!['RECEIVED', 'ANALYSIS_IN_PROGRESS'].includes(sample.status)) {
      throw invalidTransition(sample.status, 'OPENED');
    }
    return { status: sample.status, custodyStatus: 'OPENED' };
  }
  throw new BadRequestException({ code: 'INVALID_CUSTODY_EVENT' });
}

function requiredCustodyEvent(value: string): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!['SEALED', 'HANDOFF', 'RECEIVED', 'OPENED'].includes(normalized)) {
    throw new BadRequestException({ code: 'INVALID_CUSTODY_EVENT' });
  }
  return normalized;
}

function requiredIdentifier(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 200 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function optionalIdentifier(value: unknown, field: string): string | undefined {
  return value === undefined || value === null ? undefined : requiredIdentifier(value, field);
}

function requiredVersion(value: unknown): bigint {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) throw new BadRequestException({ code: 'INVALID_EXPECTED_VERSION' });
  return BigInt(normalized);
}

function requiredDate(value: unknown, field: string): Date {
  const date = new Date(String(value ?? ''));
  if (!value || Number.isNaN(date.getTime())) throw new BadRequestException({ code: 'INVALID_DATE', field });
  return date;
}

function requiredText(value: unknown, field: string, max: number): string {
  const normalized = String(value ?? '').normalize('NFKC').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_TEXT', field });
  }
  return normalized;
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  return value === undefined || value === null ? undefined : requiredText(value, field, max);
}

function requiredFiniteNumber(value: unknown, field: string, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new BadRequestException({ code: 'INVALID_NUMBER', field });
  }
  return number;
}

function decimalSix(value: number, field: string): string {
  if (!Number.isFinite(value)) throw new BadRequestException({ code: 'INVALID_DECIMAL', field });
  return value.toFixed(6);
}

function withinNorm(value: string, min: string | null, max: string | null): boolean {
  const valueMicro = decimalMicro(value);
  const minMicro = min === null ? null : decimalMicro(min);
  const maxMicro = max === null ? null : decimalMicro(max);
  return (minMicro === null || valueMicro >= minMicro) && (maxMicro === null || valueMicro <= maxMicro);
}

function decimalMicro(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,6}))?$/.exec(String(value));
  if (!match) throw new BadRequestException({ code: 'INVALID_DECIMAL' });
  const fraction = (match[3] ?? '').padEnd(6, '0');
  const absolute = BigInt(match[2]) * 1_000_000n + BigInt(fraction);
  return match[1] === '-' ? -absolute : absolute;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function scopedNotFound(): NotFoundException {
  return new NotFoundException('Laboratory sample is not available in the authenticated scope.');
}

function staleVersion(currentVersion: bigint): ConflictException {
  return new ConflictException({
    code: 'STALE_LAB_SAMPLE_VERSION',
    currentVersion: currentVersion.toString(),
  });
}

function invalidTransition(from: string, to: string): ConflictException {
  return new ConflictException({ code: 'INVALID_LAB_STATE_TRANSITION', from, to });
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2002') return true;
  if (error.code !== 'P2010') return false;
  const meta = error.meta as Record<string, unknown> | undefined;
  return meta?.code === '23505';
}
