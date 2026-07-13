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
  FinalizeLabSampleCommand,
  HandoffLabSampleCommand,
  LabCustodyEventRecord,
  LabMutationResult,
  LabRepository,
  LabSampleRecord,
  LabSampleStatus,
  LabTestRecord,
  LabWorkspace,
  ReceiveLabSampleCommand,
  RecordLabTestCommand,
} from './lab.repository';

type DbSample = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  labId: string;
  assignedLabUserId: string;
  samplerUserId: string | null;
  currentCustodianOrgId: string;
  currentCustodianUserId: string;
  status: LabSampleStatus;
  culture: string | null;
  protocol: string | null;
  gost: string | null;
  labName: string | null;
  accreditationId: string | null;
  collectedAt: Date | null;
  finalizedAt: Date | null;
  finalizedByUserId: string | null;
  protocolHash: string | null;
  moneyDeltaRub: number | null;
  moneyDeltaKopecks: bigint | null;
  certificateDocId: string | null;
  version: bigint;
  createdAt: Date;
  updatedAt: Date;
}>;

type DbTest = Readonly<{
  id: string;
  sampleId: string;
  tenantId: string;
  parameter: string;
  value: Prisma.Decimal;
  unit: string | null;
  normMin: Prisma.Decimal | null;
  normMax: Prisma.Decimal | null;
  passed: boolean;
  gradeDelta: number | null;
  methodId: string;
  equipmentId: string;
  actorUserId: string;
  correctionOfTestId: string | null;
  commandId: string;
  idempotencyKey: string;
  correlationId: string | null;
  note: string | null;
  recordedAt: Date;
  createdAt: Date;
}>;

type DbCustody = Readonly<{
  id: string;
  sampleId: string;
  tenantId: string;
  eventType: string;
  fromOrgId: string | null;
  fromUserId: string | null;
  toOrgId: string;
  toUserId: string;
  evidenceRef: string;
  occurredAt: Date;
  commandId: string;
  idempotencyKey: string;
  correlationId: string | null;
  createdAt: Date;
}>;

type DbDeal = Readonly<{
  id: string;
  tenantId: string;
  culture: string | null;
}>;

type DbAssignment = Readonly<{
  id: string;
  tenantId: string;
  dealId: string;
  labOrgId: string;
  labUserId: string;
  evidenceRef: string;
}>;

type NormalizedCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  expectedVersion?: bigint;
}> & Record<string, unknown>;

type MutationArtifacts = Readonly<{
  sample: DbSample;
  test?: DbTest;
  custody?: DbCustody;
  eventPayload: Prisma.InputJsonObject;
}>;

const REGISTRATION_ROLES = new Set<string>([
  Role.ELEVATOR,
  Role.SURVEYOR,
  Role.LAB,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);
const COLLECTION_ROLES = new Set<string>(REGISTRATION_ROLES);
const HANDOFF_ROLES = new Set<string>([
  Role.ELEVATOR,
  Role.SURVEYOR,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);

@Injectable()
export class PrismaLabRepository implements LabRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<LabSampleRecord[]> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<DbSample[]>(Prisma.sql`
        SELECT sample.*
        FROM public."lab_samples" sample
        ORDER BY sample."updatedAt" DESC, sample."id" ASC
        LIMIT 500
      `);
      return rows.map(publicSample);
    });
  }

  async getById(id: string, user: RequestUser): Promise<LabWorkspace> {
    const sampleId = requiredIdentifier(id, 'sampleId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const sample = await this.findSample(tx, sampleId);
      if (!sample) throw scopedNotFound();
      const [tests, custody] = await Promise.all([
        this.findTests(tx, sampleId),
        this.findCustody(tx, sampleId),
      ]);
      return {
        sample: publicSample(sample),
        tests: tests.map(publicTest),
        custody: custody.map(publicCustody),
      };
    });
  }

  async create(command: CreateLabSampleCommand, user: RequestUser): Promise<LabMutationResult> {
    if (!REGISTRATION_ROLES.has(user.role)) {
      throw new ForbiddenException('Role cannot register a laboratory sample.');
    }
    const normalized: NormalizedCommand = {
      dealId: requiredIdentifier(command.dealId, 'dealId'),
      shipmentId: optionalIdentifier(command.shipmentId, 'shipmentId'),
      acceptanceId: optionalIdentifier(command.acceptanceId, 'acceptanceId'),
      evidenceRef: requiredIdentifier(command.evidenceRef, 'evidenceRef'),
      occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
    };
    const requestFingerprint = digest({ action: 'lab.sample.create', command: normalized });

    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        const persistentKey = this.persistentKey(context, normalized.idempotencyKey as string);
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (replay) return replay;

        const deal = await this.findDeal(tx, normalized.dealId as string);
        if (!deal) throw new NotFoundException({ code: 'DEAL_NOT_VISIBLE' });
        await this.lockDeal(tx, deal.id);
        const lockedReplay = await this.replay(tx, persistentKey, requestFingerprint);
        if (lockedReplay) return lockedReplay;

        const assignment = await this.findActiveAssignment(tx, deal.id, context.tenantId);
        if (!assignment) {
          throw new ConflictException({ code: 'LAB_ASSIGNMENT_REQUIRED' });
        }
        await this.verifyLinkedObjects(
          tx,
          deal.id,
          normalized.shipmentId as string | undefined,
          normalized.acceptanceId as string | undefined,
        );
        await this.verifyEvidence(tx, deal.id, normalized.evidenceRef as string);

        const sampleId = `sample-${randomUUID()}`;
        const samples = await tx.$queryRaw<DbSample[]>(Prisma.sql`
          INSERT INTO public."lab_samples" (
            "id", "dealId", "shipmentId", "acceptanceId", "tenantId", "labId",
            "assignedLabUserId", "currentCustodianOrgId", "currentCustodianUserId",
            "status", "culture", "version", "createdAt", "updatedAt"
          ) VALUES (
            ${sampleId}, ${deal.id}, ${nullableString(normalized.shipmentId)},
            ${nullableString(normalized.acceptanceId)}, ${context.tenantId},
            ${assignment.labOrgId}, ${assignment.labUserId}, ${context.orgId},
            ${context.userId}, 'PENDING', ${deal.culture}, 0, now(), now()
          )
          RETURNING *
        `);
        const sample = samples[0];
        if (!sample) throw new ConflictException('Sample insert did not return an authoritative row.');
        const custody = await this.insertCustody(
          tx,
          sample,
          context,
          'REGISTERED',
          null,
          null,
          context.orgId,
          context.userId,
          normalized.evidenceRef as string,
          normalized.occurredAt as Date,
          normalized.commandId as string,
          `${persistentKey}:custody`,
          normalized.correlationId as string,
        );
        return this.commitReceipt(
          tx,
          context,
          'lab.sample.create',
          'lab.sample.created',
          normalized,
          persistentKey,
          requestFingerprint,
          null,
          { sample, custody, eventPayload: { assignmentId: assignment.id } },
        );
      }, transactionOptions());
    } catch (error) {
      return this.recoverUnique(error, user, normalized, requestFingerprint);
    }
  }

  async collect(
    id: string,
    command: CollectLabSampleCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    if (!COLLECTION_ROLES.has(user.role)) {
      throw new ForbiddenException('Role cannot collect a laboratory sample.');
    }
    const normalized = normalizeCustody(id, command);
    return this.executeExisting(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.sample.collect',
      'lab.sample.collected',
      async (tx, sample, context, persistentKey) => {
        requireState(sample, ['PENDING']);
        requireCustodian(sample, context);
        await this.verifyEvidence(tx, sample.dealId, normalized.evidenceRef as string);
        const updated = await this.casSample(tx, sample, normalized.expectedVersion as bigint, Prisma.sql`
          "status" = 'COLLECTED',
          "samplerUserId" = ${context.userId},
          "collectedAt" = ${normalized.occurredAt as Date},
          "currentCustodianOrgId" = ${context.orgId},
          "currentCustodianUserId" = ${context.userId}
        `);
        const custody = await this.insertCustody(
          tx, updated, context, 'COLLECTED', sample.currentCustodianOrgId,
          sample.currentCustodianUserId, context.orgId, context.userId,
          normalized.evidenceRef as string, normalized.occurredAt as Date,
          normalized.commandId as string, `${persistentKey}:custody`,
          normalized.correlationId as string,
        );
        return { sample: updated, custody, eventPayload: { custodyEventId: custody.id } };
      },
    );
  }

  async handoff(
    id: string,
    command: HandoffLabSampleCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    if (!HANDOFF_ROLES.has(user.role)) {
      throw new ForbiddenException('Role cannot hand off a laboratory sample.');
    }
    const normalized = normalizeCustody(id, command);
    return this.executeExisting(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.sample.handoff',
      'lab.sample.handed_off',
      async (tx, sample, context, persistentKey) => {
        requireState(sample, ['COLLECTED']);
        requireCustodian(sample, context);
        await this.verifyEvidence(tx, sample.dealId, normalized.evidenceRef as string);
        const updated = await this.casSample(tx, sample, normalized.expectedVersion as bigint, Prisma.sql`
          "status" = 'IN_TRANSIT',
          "currentCustodianOrgId" = ${sample.labId},
          "currentCustodianUserId" = ${sample.assignedLabUserId}
        `);
        const custody = await this.insertCustody(
          tx, updated, context, 'HANDED_OFF', sample.currentCustodianOrgId,
          sample.currentCustodianUserId, sample.labId, sample.assignedLabUserId,
          normalized.evidenceRef as string, normalized.occurredAt as Date,
          normalized.commandId as string, `${persistentKey}:custody`,
          normalized.correlationId as string,
        );
        return { sample: updated, custody, eventPayload: { custodyEventId: custody.id } };
      },
    );
  }

  async receive(
    id: string,
    command: ReceiveLabSampleCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    if (user.role !== Role.LAB) {
      throw new ForbiddenException('Only the assigned laboratory actor may receive a sample.');
    }
    const normalized = normalizeCustody(id, command);
    return this.executeExisting(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.sample.receive',
      'lab.sample.received',
      async (tx, sample, context, persistentKey) => {
        requireState(sample, ['IN_TRANSIT']);
        requireAssignedLabActor(sample, context);
        await this.verifyEvidence(tx, sample.dealId, normalized.evidenceRef as string);
        const updated = await this.casSample(tx, sample, normalized.expectedVersion as bigint, Prisma.sql`
          "status" = 'RECEIVED',
          "currentCustodianOrgId" = ${sample.labId},
          "currentCustodianUserId" = ${sample.assignedLabUserId}
        `);
        const custody = await this.insertCustody(
          tx, updated, context, 'RECEIVED', sample.currentCustodianOrgId,
          sample.currentCustodianUserId, sample.labId, sample.assignedLabUserId,
          normalized.evidenceRef as string, normalized.occurredAt as Date,
          normalized.commandId as string, `${persistentKey}:custody`,
          normalized.correlationId as string,
        );
        return { sample: updated, custody, eventPayload: { custodyEventId: custody.id } };
      },
    );
  }

  async recordTest(
    id: string,
    command: RecordLabTestCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    if (user.role !== Role.LAB) {
      throw new ForbiddenException('Only the assigned laboratory actor may record test facts.');
    }
    const normalized: NormalizedCommand = {
      sampleId: requiredIdentifier(id, 'sampleId'),
      metric: requiredText(command.metric, 'metric', 160),
      value: requiredNumber(command.value, 'value'),
      unit: optionalText(command.unit, 'unit', 40),
      normMin: optionalNumber(command.normMin, 'normMin'),
      normMax: optionalNumber(command.normMax, 'normMax'),
      methodId: requiredIdentifier(command.methodId, 'methodId'),
      equipmentId: requiredIdentifier(command.equipmentId, 'equipmentId'),
      correctionOfTestId: optionalIdentifier(command.correctionOfTestId, 'correctionOfTestId'),
      recordedAt: requiredDate(command.recordedAt, 'recordedAt'),
      note: optionalText(command.note, 'note', 1000),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
    };
    if (
      normalized.normMin !== undefined && normalized.normMax !== undefined
      && Number(normalized.normMin) > Number(normalized.normMax)
    ) {
      throw new BadRequestException({ code: 'INVALID_NORM_BOUNDS' });
    }

    return this.executeExisting(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.test.record',
      'lab.test.recorded',
      async (tx, sample, context) => {
        requireState(sample, ['RECEIVED', 'ANALYSIS_IN_PROGRESS', 'READY_FOR_FINALIZATION']);
        requireAssignedLabActor(sample, context);
        const value = normalized.value as number;
        const min = normalized.normMin as number | undefined;
        const max = normalized.normMax as number | undefined;
        const passed = (min === undefined || value >= min) && (max === undefined || value <= max);
        const testId = `lab-test-${randomUUID()}`;
        const tests = await tx.$queryRaw<DbTest[]>(Prisma.sql`
          INSERT INTO public."lab_tests" (
            "id", "sampleId", "tenantId", "parameter", "value", "unit",
            "normMin", "normMax", "passed", "methodId", "equipmentId",
            "actorUserId", "correctionOfTestId", "commandId", "idempotencyKey",
            "correlationId", "note", "recordedAt", "createdAt"
          ) VALUES (
            ${testId}, ${sample.id}, ${context.tenantId}, ${normalized.metric as string},
            CAST(${value} AS NUMERIC(20,6)), ${nullableString(normalized.unit)},
            CAST(${nullableNumber(normalized.normMin)} AS NUMERIC(20,6)),
            CAST(${nullableNumber(normalized.normMax)} AS NUMERIC(20,6)),
            ${passed}, ${normalized.methodId as string}, ${normalized.equipmentId as string},
            ${context.userId}, ${nullableString(normalized.correctionOfTestId)},
            ${normalized.commandId as string}, ${this.persistentKey(context, normalized.idempotencyKey as string)},
            ${normalized.correlationId as string}, ${nullableString(normalized.note)},
            ${normalized.recordedAt as Date}, now()
          )
          RETURNING *
        `);
        const test = tests[0];
        if (!test) throw new ConflictException('Test insert did not return an authoritative row.');
        const updated = await this.casSample(tx, sample, normalized.expectedVersion as bigint, Prisma.sql`
          "status" = 'READY_FOR_FINALIZATION'
        `);
        return {
          sample: updated,
          test,
          eventPayload: {
            testId: test.id,
            metric: test.parameter,
            passed: test.passed,
            correctionOfTestId: test.correctionOfTestId,
          },
        };
      },
    );
  }

  async finalize(
    id: string,
    command: FinalizeLabSampleCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    if (user.role !== Role.LAB) {
      throw new ForbiddenException('Only the assigned laboratory actor may finalize a protocol.');
    }
    const normalized: NormalizedCommand = {
      sampleId: requiredIdentifier(id, 'sampleId'),
      protocolNumber: requiredText(command.protocolNumber, 'protocolNumber', 160),
      applicableStandard: requiredText(command.applicableStandard, 'applicableStandard', 160),
      accreditationId: requiredIdentifier(command.accreditationId, 'accreditationId'),
      signedEvidenceRef: requiredIdentifier(command.signedEvidenceRef, 'signedEvidenceRef'),
      finalizedAt: requiredDate(command.finalizedAt, 'finalizedAt'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
    };

    return this.executeExisting(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.protocol.finalize',
      'lab.protocol.finalized',
      async (tx, sample, context, persistentKey) => {
        requireState(sample, ['READY_FOR_FINALIZATION']);
        requireAssignedLabActor(sample, context);
        const effectiveTests = await this.findEffectiveTests(tx, sample.id);
        if (effectiveTests.length === 0) {
          throw new ConflictException({ code: 'LAB_TESTS_REQUIRED' });
        }
        const latestRecordedAt = effectiveTests.reduce(
          (latest, test) => test.recordedAt > latest ? test.recordedAt : latest,
          effectiveTests[0].recordedAt,
        );
        if ((normalized.finalizedAt as Date) < latestRecordedAt) {
          throw new ConflictException({ code: 'FINALIZATION_PRECEDES_TEST' });
        }
        const accreditation = await this.findAccreditation(
          tx,
          sample,
          normalized.accreditationId as string,
          normalized.finalizedAt as Date,
        );
        if (!accreditation) throw new ConflictException({ code: 'ACTIVE_ACCREDITATION_REQUIRED' });
        const standard = normalized.applicableStandard as string;
        const standards = await this.findMethodStandards(tx, effectiveTests.map((test) => test.methodId));
        if (standards.length !== 1 || standards[0] !== standard) {
          throw new ConflictException({ code: 'LAB_METHOD_STANDARD_MISMATCH' });
        }
        const signedEvidence = await this.findSignedProtocolEvidence(
          tx,
          sample.dealId,
          normalized.signedEvidenceRef as string,
        );
        if (!signedEvidence) {
          throw new ConflictException({ code: 'SIGNED_PROTOCOL_EVIDENCE_REQUIRED' });
        }
        const protocolHash = digest({
          sampleId: sample.id,
          dealId: sample.dealId,
          protocolNumber: normalized.protocolNumber,
          standard,
          accreditationId: accreditation.id,
          signedEvidenceRef: signedEvidence.id,
          tests: effectiveTests.map((test) => ({
            id: test.id,
            parameter: test.parameter,
            value: test.value.toString(),
            unit: test.unit,
            passed: test.passed,
            methodId: test.methodId,
            equipmentId: test.equipmentId,
            correctionOfTestId: test.correctionOfTestId,
            recordedAt: test.recordedAt.toISOString(),
          })),
        });
        const updated = await this.casSample(tx, sample, normalized.expectedVersion as bigint, Prisma.sql`
          "status" = 'FINALIZED',
          "protocol" = ${normalized.protocolNumber as string},
          "gost" = ${standard},
          "accreditationId" = ${accreditation.id},
          "certificateDocId" = ${signedEvidence.id},
          "protocolHash" = ${protocolHash},
          "finalizedAt" = ${normalized.finalizedAt as Date},
          "finalizedByUserId" = ${context.userId},
          "currentCustodianOrgId" = ${sample.labId},
          "currentCustodianUserId" = ${sample.assignedLabUserId}
        `);
        if (!sample.acceptanceId) {
          throw new ConflictException({ code: 'ACCEPTANCE_REQUIRED_FOR_FINALIZATION' });
        }
        const qualityStatus = effectiveTests.every((test) => test.passed) ? 'PASSED' : 'FAILED';
        const acceptance = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          UPDATE public."acceptance_records"
          SET "qualityStatus" = ${qualityStatus}, "gost" = ${standard}, "updatedAt" = now()
          WHERE "id" = ${sample.acceptanceId} AND "dealId" = ${sample.dealId}
          RETURNING "id"
        `);
        if (!acceptance[0]) {
          throw new ConflictException({ code: 'ACCEPTANCE_NOT_VISIBLE_OR_MISSING' });
        }
        const custody = await this.insertCustody(
          tx, updated, context, 'FINALIZED', sample.currentCustodianOrgId,
          sample.currentCustodianUserId, sample.labId, sample.assignedLabUserId,
          signedEvidence.id, normalized.finalizedAt as Date,
          normalized.commandId as string, `${persistentKey}:custody`,
          normalized.correlationId as string,
        );
        return {
          sample: updated,
          custody,
          eventPayload: {
            custodyEventId: custody.id,
            protocolHash,
            qualityStatus,
            effectiveTestCount: effectiveTests.length,
          },
        };
      },
    );
  }

  private async executeExisting(
    sampleId: string,
    command: NormalizedCommand,
    user: RequestUser,
    action: string,
    eventType: string,
    work: (
      tx: Prisma.TransactionClient,
      sample: DbSample,
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
        await this.lockDeal(tx, candidate.dealId);
        const lockedReplay = await this.replay(tx, persistentKey, requestFingerprint);
        if (lockedReplay) return lockedReplay;
        const sample = await this.findSample(tx, sampleId);
        if (!sample) throw scopedNotFound();
        const artifacts = await work(tx, sample, context, persistentKey);
        return this.commitReceipt(
          tx,
          context,
          action,
          eventType,
          command,
          persistentKey,
          requestFingerprint,
          sample,
          artifacts,
        );
      }, transactionOptions());
    } catch (error) {
      return this.recoverUnique(error, user, command, requestFingerprint);
    }
  }

  private async commitReceipt(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    action: string,
    eventType: string,
    command: NormalizedCommand,
    persistentKey: string,
    requestFingerprint: string,
    before: DbSample | null,
    artifacts: MutationArtifacts,
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
      beforeState: before ? sampleState(before) : null,
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
        id: auditId,
        action,
        actorUserId: context.userId,
        actorRole: context.role,
        tenantId: context.tenantId,
        orgId: context.orgId,
        dealId: artifacts.sample.dealId,
        objectType: 'lab_sample',
        objectId: artifacts.sample.id,
        beforeState: before ? sampleState(before) : Prisma.JsonNull,
        afterState: sampleState(artifacts.sample),
        outcome: 'SUCCESS',
        correlationId: command.correlationId,
        metadata: auditMaterial.metadata as Prisma.InputJsonValue,
        prevHash: previousAudit?.hash ?? null,
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
          schemaVersion: 'labs-event.v1',
          requestFingerprint,
          sampleId: artifacts.sample.id,
          testId: artifacts.test?.id ?? null,
          custodyEventId: artifacts.custody?.id ?? null,
          ...artifacts.eventPayload,
        } as Prisma.InputJsonValue,
      },
    });
    return {
      sample: publicSample(artifacts.sample),
      auditId,
      outboxId,
      duplicate: false,
      test: artifacts.test ? publicTest(artifacts.test) : undefined,
      custodyEvent: artifacts.custody ? publicCustody(artifacts.custody) : undefined,
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
    const custody = typeof payload.custodyEventId === 'string'
      ? await this.findCustodyEvent(tx, payload.custodyEventId)
      : undefined;
    return {
      sample: publicSample(sample),
      auditId: outbox.auditId,
      outboxId: outbox.id,
      duplicate: true,
      test: test ? publicTest(test) : undefined,
      custodyEvent: custody ? publicCustody(custody) : undefined,
    };
  }

  private async recoverUnique(
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

  private async findDeal(tx: Prisma.TransactionClient, dealId: string): Promise<DbDeal | null> {
    const rows = await tx.$queryRaw<DbDeal[]>(Prisma.sql`
      SELECT deal."id", deal."tenantId", deal."culture"
      FROM public."deals" deal
      WHERE deal."id" = ${dealId}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findSample(tx: Prisma.TransactionClient, sampleId: string): Promise<DbSample | null> {
    const rows = await tx.$queryRaw<DbSample[]>(Prisma.sql`
      SELECT sample.*
      FROM public."lab_samples" sample
      WHERE sample."id" = ${sampleId}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findTests(tx: Prisma.TransactionClient, sampleId: string): Promise<DbTest[]> {
    return tx.$queryRaw<DbTest[]>(Prisma.sql`
      SELECT test.*
      FROM public."lab_tests" test
      WHERE test."sampleId" = ${sampleId}
      ORDER BY test."recordedAt" ASC, test."id" ASC
      LIMIT 2000
    `);
  }

  private async findEffectiveTests(tx: Prisma.TransactionClient, sampleId: string): Promise<DbTest[]> {
    return tx.$queryRaw<DbTest[]>(Prisma.sql`
      SELECT test.*
      FROM public."lab_tests" test
      WHERE test."sampleId" = ${sampleId}
        AND NOT EXISTS (
          SELECT 1 FROM public."lab_tests" correction
          WHERE correction."correctionOfTestId" = test."id"
        )
      ORDER BY test."recordedAt" ASC, test."id" ASC
      LIMIT 2000
    `);
  }

  private async findTest(tx: Prisma.TransactionClient, testId: string): Promise<DbTest | undefined> {
    const rows = await tx.$queryRaw<DbTest[]>(Prisma.sql`
      SELECT test.* FROM public."lab_tests" test WHERE test."id" = ${testId} LIMIT 1
    `);
    return rows[0];
  }

  private async findCustody(tx: Prisma.TransactionClient, sampleId: string): Promise<DbCustody[]> {
    return tx.$queryRaw<DbCustody[]>(Prisma.sql`
      SELECT custody.*
      FROM public."lab_custody_events" custody
      WHERE custody."sampleId" = ${sampleId}
      ORDER BY custody."occurredAt" ASC, custody."id" ASC
      LIMIT 2000
    `);
  }

  private async findCustodyEvent(
    tx: Prisma.TransactionClient,
    custodyId: string,
  ): Promise<DbCustody | undefined> {
    const rows = await tx.$queryRaw<DbCustody[]>(Prisma.sql`
      SELECT custody.*
      FROM public."lab_custody_events" custody
      WHERE custody."id" = ${custodyId}
      LIMIT 1
    `);
    return rows[0];
  }

  private async findActiveAssignment(
    tx: Prisma.TransactionClient,
    dealId: string,
    tenantId: string,
  ): Promise<DbAssignment | null> {
    const rows = await tx.$queryRaw<DbAssignment[]>(Prisma.sql`
      SELECT assignment."id", assignment."tenantId", assignment."dealId",
             assignment."labOrgId", assignment."labUserId", assignment."evidenceRef"
      FROM public."lab_assignments" assignment
      WHERE assignment."tenantId" = ${tenantId}
        AND assignment."dealId" = ${dealId}
        AND assignment."status" = 'ACTIVE'
        AND assignment."validFrom" <= now()
        AND (assignment."validUntil" IS NULL OR assignment."validUntil" > now())
      ORDER BY assignment."validFrom" DESC, assignment."id" ASC
      LIMIT 2
    `);
    if (rows.length > 1) throw new ConflictException({ code: 'AMBIGUOUS_LAB_ASSIGNMENT' });
    return rows[0] ?? null;
  }

  private async findAccreditation(
    tx: Prisma.TransactionClient,
    sample: DbSample,
    accreditationId: string,
    at: Date,
  ): Promise<{ id: string; reference: string } | null> {
    const rows = await tx.$queryRaw<Array<{ id: string; reference: string }>>(Prisma.sql`
      SELECT accreditation."id", accreditation."reference"
      FROM public."lab_accreditations" accreditation
      WHERE accreditation."id" = ${accreditationId}
        AND accreditation."tenantId" = ${sample.tenantId}
        AND accreditation."labOrgId" = ${sample.labId}
        AND accreditation."status" = 'ACTIVE'
        AND accreditation."verifiedAt" IS NOT NULL
        AND accreditation."validFrom" <= ${at}
        AND (accreditation."validUntil" IS NULL OR accreditation."validUntil" > ${at})
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findMethodStandards(
    tx: Prisma.TransactionClient,
    methodIds: string[],
  ): Promise<string[]> {
    if (methodIds.length === 0) return [];
    const rows = await tx.$queryRaw<Array<{ standard: string }>>(Prisma.sql`
      SELECT DISTINCT method."applicableStandard" AS standard
      FROM public."lab_methods" method
      WHERE method."id" IN (${Prisma.join(methodIds)})
        AND method."status" = 'ACTIVE'
    `);
    return rows.map((row) => row.standard).sort();
  }

  private async findSignedProtocolEvidence(
    tx: Prisma.TransactionClient,
    dealId: string,
    documentId: string,
  ): Promise<{ id: string; hash: string } | null> {
    const rows = await tx.$queryRaw<Array<{ id: string; hash: string }>>(Prisma.sql`
      SELECT document."id", document."hash"
      FROM public."deal_documents" document
      WHERE document."id" = ${documentId}
        AND document."dealId" = ${dealId}
        AND document."type" = 'LAB_PROTOCOL'
        AND document."status" = 'SIGNED'
        AND document."signedAt" IS NOT NULL
        AND document."isImmutable" = true
        AND document."hash" IS NOT NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async verifyEvidence(
    tx: Prisma.TransactionClient,
    dealId: string,
    evidenceRef: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT evidence."id"
      FROM public."evidence_files" evidence
      WHERE evidence."id" = ${evidenceRef}
        AND evidence."dealId" = ${dealId}
        AND evidence."hash" IS NOT NULL
      LIMIT 1
    `);
    if (!rows[0]) throw new ConflictException({ code: 'LAB_EVIDENCE_REQUIRED' });
  }

  private async verifyLinkedObjects(
    tx: Prisma.TransactionClient,
    dealId: string,
    shipmentId?: string,
    acceptanceId?: string,
  ): Promise<void> {
    if (shipmentId) {
      const shipment = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT shipment."id" FROM public."shipments" shipment
        WHERE shipment."id" = ${shipmentId} AND shipment."dealId" = ${dealId}
        LIMIT 1
      `);
      if (!shipment[0]) throw new ConflictException({ code: 'SHIPMENT_NOT_VISIBLE_OR_FOREIGN' });
    }
    if (acceptanceId) {
      const acceptance = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT acceptance."id" FROM public."acceptance_records" acceptance
        WHERE acceptance."id" = ${acceptanceId} AND acceptance."dealId" = ${dealId}
        LIMIT 1
      `);
      if (!acceptance[0]) throw new ConflictException({ code: 'ACCEPTANCE_NOT_VISIBLE_OR_FOREIGN' });
    }
  }

  private async insertCustody(
    tx: Prisma.TransactionClient,
    sample: DbSample,
    context: TrustedRlsContext,
    eventType: string,
    fromOrgId: string | null,
    fromUserId: string | null,
    toOrgId: string,
    toUserId: string,
    evidenceRef: string,
    occurredAt: Date,
    commandId: string,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<DbCustody> {
    const custodyId = `lab-custody-${randomUUID()}`;
    const rows = await tx.$queryRaw<DbCustody[]>(Prisma.sql`
      INSERT INTO public."lab_custody_events" (
        "id", "sampleId", "tenantId", "eventType", "fromOrgId", "fromUserId",
        "toOrgId", "toUserId", "evidenceRef", "occurredAt", "commandId",
        "idempotencyKey", "correlationId", "createdAt"
      ) VALUES (
        ${custodyId}, ${sample.id}, ${context.tenantId}, ${eventType}, ${fromOrgId},
        ${fromUserId}, ${toOrgId}, ${toUserId}, ${evidenceRef}, ${occurredAt},
        ${commandId}, ${idempotencyKey}, ${correlationId}, now()
      )
      RETURNING *
    `);
    const custody = rows[0];
    if (!custody) throw new ConflictException('Custody insert did not return an authoritative row.');
    return custody;
  }

  private async casSample(
    tx: Prisma.TransactionClient,
    sample: DbSample,
    expectedVersion: bigint,
    assignments: Prisma.Sql,
  ): Promise<DbSample> {
    if (sample.version !== expectedVersion) throw staleVersion(sample.version);
    const rows = await tx.$queryRaw<DbSample[]>(Prisma.sql`
      UPDATE public."lab_samples"
      SET ${assignments}, "version" = "version" + 1, "updatedAt" = now()
      WHERE "id" = ${sample.id} AND "version" = ${expectedVersion}
      RETURNING *
    `);
    if (!rows[0]) throw new ConflictException({ code: 'CONCURRENT_LAB_SAMPLE_UPDATE' });
    return rows[0];
  }

  private async lockDeal(tx: Prisma.TransactionClient, dealId: string): Promise<void> {
    await tx.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${dealId}, 43)) IS NULL AS locked
    `);
  }

  private persistentKey(context: TrustedRlsContext, clientKey: string): string {
    return `labs:${context.tenantId}:${context.userId}:${clientKey}`;
  }
}

function normalizeCustody(
  id: string,
  command: CollectLabSampleCommand | HandoffLabSampleCommand | ReceiveLabSampleCommand,
): NormalizedCommand {
  return {
    sampleId: requiredIdentifier(id, 'sampleId'),
    evidenceRef: requiredIdentifier(command.evidenceRef, 'evidenceRef'),
    occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
    note: optionalText(command.note, 'note', 1000),
    commandId: requiredIdentifier(command.commandId, 'commandId'),
    idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
    correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
    expectedVersion: requiredVersion(command.expectedVersion),
  };
}

function publicSample(sample: DbSample): LabSampleRecord {
  return {
    id: sample.id,
    dealId: sample.dealId,
    shipmentId: sample.shipmentId,
    acceptanceId: sample.acceptanceId,
    tenantId: sample.tenantId,
    labOrgId: sample.labId,
    assignedLabUserId: sample.assignedLabUserId,
    samplerUserId: sample.samplerUserId,
    currentCustodianOrgId: sample.currentCustodianOrgId,
    currentCustodianUserId: sample.currentCustodianUserId,
    status: sample.status,
    culture: sample.culture,
    protocol: sample.protocol,
    gost: sample.gost,
    accreditationId: sample.accreditationId,
    finalizedAt: sample.finalizedAt,
    finalizedByUserId: sample.finalizedByUserId,
    certificateDocId: sample.certificateDocId,
    protocolHash: sample.protocolHash,
    version: sample.version.toString(),
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt,
  };
}

function publicTest(test: DbTest): LabTestRecord {
  return {
    id: test.id,
    sampleId: test.sampleId,
    tenantId: test.tenantId,
    parameter: test.parameter,
    value: Number(test.value),
    unit: test.unit,
    normMin: test.normMin === null ? null : Number(test.normMin),
    normMax: test.normMax === null ? null : Number(test.normMax),
    passed: test.passed,
    methodId: test.methodId,
    equipmentId: test.equipmentId,
    actorUserId: test.actorUserId,
    correctionOfTestId: test.correctionOfTestId,
    recordedAt: test.recordedAt,
  };
}

function publicCustody(custody: DbCustody): LabCustodyEventRecord {
  return {
    id: custody.id,
    sampleId: custody.sampleId,
    tenantId: custody.tenantId,
    eventType: custody.eventType,
    fromOrgId: custody.fromOrgId,
    fromUserId: custody.fromUserId,
    toOrgId: custody.toOrgId,
    toUserId: custody.toUserId,
    evidenceRef: custody.evidenceRef,
    occurredAt: custody.occurredAt,
    commandId: custody.commandId,
    createdAt: custody.createdAt,
  };
}

function sampleState(sample: DbSample): Prisma.InputJsonObject {
  return {
    id: sample.id,
    dealId: sample.dealId,
    tenantId: sample.tenantId,
    labId: sample.labId,
    assignedLabUserId: sample.assignedLabUserId,
    currentCustodianOrgId: sample.currentCustodianOrgId,
    currentCustodianUserId: sample.currentCustodianUserId,
    status: sample.status,
    protocol: sample.protocol,
    accreditationId: sample.accreditationId,
    certificateDocId: sample.certificateDocId,
    protocolHash: sample.protocolHash,
    version: sample.version.toString(),
    finalizedAt: sample.finalizedAt?.toISOString() ?? null,
  };
}

function requireState(sample: DbSample, allowed: LabSampleStatus[]): void {
  if (!allowed.includes(sample.status)) {
    throw new ConflictException({
      code: 'INVALID_LAB_SAMPLE_STATE',
      currentStatus: sample.status,
      allowed,
    });
  }
}

function requireCustodian(sample: DbSample, context: TrustedRlsContext): void {
  if (
    sample.currentCustodianUserId !== context.userId
    && context.role !== Role.SUPPORT_MANAGER
    && context.role !== Role.ADMIN
  ) {
    throw new ForbiddenException('Only the current custodian may change sample custody.');
  }
}

function requireAssignedLabActor(sample: DbSample, context: TrustedRlsContext): void {
  if (sample.assignedLabUserId !== context.userId || sample.labId !== context.orgId) {
    throw new ForbiddenException('User is not the assigned laboratory actor for this sample.');
  }
}

function transactionOptions() {
  return {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    timeout: 20_000,
  } as const;
}

function requiredIdentifier(value: unknown, field: string): string {
  const normalized = String(value ?? '').normalize('NFKC').trim();
  if (!normalized || normalized.length > 200 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function optionalIdentifier(value: unknown, field: string): string | undefined {
  return value === undefined || value === null || value === ''
    ? undefined
    : requiredIdentifier(value, field);
}

function requiredText(value: unknown, field: string, max: number): string {
  const normalized = String(value ?? '').normalize('NFKC').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_TEXT', field });
  }
  return normalized;
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  return value === undefined || value === null || value === ''
    ? undefined
    : requiredText(value, field, max);
}

function requiredDate(value: unknown, field: string): Date {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) throw new BadRequestException({ code: 'INVALID_DATE', field });
  if (date.getTime() > Date.now() + 5 * 60_000) {
    throw new BadRequestException({ code: 'FUTURE_DATE_FORBIDDEN', field });
  }
  return date;
}

function requiredVersion(value: unknown): bigint {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_EXPECTED_VERSION' });
  }
  return BigInt(normalized);
}

function requiredNumber(value: unknown, field: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > 1_000_000_000_000) {
    throw new BadRequestException({ code: 'INVALID_NUMBER', field });
  }
  return numeric;
}

function optionalNumber(value: unknown, field: string): number | undefined {
  return value === undefined || value === null ? undefined : requiredNumber(value, field);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function staleVersion(current: bigint): ConflictException {
  return new ConflictException({
    code: 'STALE_LAB_SAMPLE_VERSION',
    currentVersion: current.toString(),
  });
}

function scopedNotFound(): NotFoundException {
  return new NotFoundException({ code: 'LAB_SAMPLE_NOT_VISIBLE' });
}
