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
  LabCustodyRecord,
  LabMutationResult,
  LabProtocolRecord,
  LabRepository,
  LabSampleRecord,
  LabTestRecord,
  LabWorkspace,
  RecordLabTestCommand,
} from './lab.repository';

type LabSampleAuthorityRow = Omit<LabSampleRecord, 'version' | 'moneyDeltaKopecks'> & Readonly<{
  version: number;
  moneyDeltaKopecks: bigint | null;
}>;

type LabTestAuthorityRow = Omit<LabTestRecord, 'value' | 'normMin' | 'normMax' | 'gradeDelta'> & Readonly<{
  value: Prisma.Decimal | number;
  normMin: Prisma.Decimal | number | null;
  normMax: Prisma.Decimal | number | null;
  gradeDelta: Prisma.Decimal | number | null;
}>;

type NormalizedLabCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  expectedVersion?: number;
  expectedDealUpdatedAt?: Date;
}> & Record<string, unknown>;

type LabAuthority = Readonly<{
  laboratoryId: string;
  laboratoryOrgId: string;
  laboratoryName: string;
  accreditationId: string;
  accreditationRef: string;
  personnelId: string;
}>;

type MutationArtifacts = Readonly<{
  sample: LabSampleAuthorityRow;
  test?: LabTestAuthorityRow;
  custodyEvent?: LabCustodyRecord;
  protocol?: LabProtocolRecord;
  eventPayload: Prisma.InputJsonObject;
}>;

const LAB_MUTATION_ROLES = new Set<string>([
  Role.LAB,
  Role.SUPPORT_MANAGER,
  Role.ADMIN,
]);

@Injectable()
export class PrismaLabRepository implements LabRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<LabSampleRecord[]> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<LabSampleAuthorityRow[]>(Prisma.sql`
        SELECT sample.*
        FROM public."lab_samples" sample
        ORDER BY sample."createdAt" DESC, sample."id" ASC
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
      const [tests, custody, protocols] = await Promise.all([
        this.findTests(tx, sampleId),
        this.findCustody(tx, sampleId),
        this.findProtocols(tx, sampleId),
      ]);
      return {
        sample: publicSample(sample),
        tests: tests.map(publicTest),
        custody,
        protocols: protocols.map(publicProtocol),
      };
    });
  }

  async create(command: CreateLabSampleCommand, user: RequestUser): Promise<LabMutationResult> {
    this.assertLabMutationRole(user);
    const normalized: NormalizedLabCommand = {
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      dealId: requiredIdentifier(command.dealId, 'dealId'),
      shipmentId: optionalIdentifier(command.shipmentId, 'shipmentId'),
      note: optionalText(command.note, 'note', 1000),
      expectedDealUpdatedAt: requiredDate(command.expectedDealUpdatedAt, 'expectedDealUpdatedAt'),
    };

    return this.executeMutation(
      null,
      normalized,
      user,
      'lab.sample.create',
      'lab.sample.created',
      async (tx, _sample, context) => {
        const dealId = normalized.dealId as string;
        const deal = await tx.deal.findUnique({
          where: { id: dealId },
          select: {
            id: true,
            tenantId: true,
            culture: true,
            updatedAt: true,
          },
        });
        if (!deal || deal.tenantId !== context.tenantId) throw scopedNotFound();
        if (deal.updatedAt.getTime() !== (normalized.expectedDealUpdatedAt as Date).getTime()) {
          throw new ConflictException({
            code: 'STALE_DEAL_VERSION',
            currentUpdatedAt: deal.updatedAt.toISOString(),
          });
        }
        const shipmentId = normalized.shipmentId as string | undefined;
        if (shipmentId) {
          const shipment = await tx.shipment.findUnique({ where: { id: shipmentId } });
          if (!shipment || shipment.dealId !== deal.id) {
            throw new BadRequestException({ code: 'SHIPMENT_NOT_IN_DEAL' });
          }
        }
        const authority = await this.requireAuthority(tx, context, undefined);
        const sampleId = `lab-sample-${randomUUID()}`;
        const rows = await tx.$queryRaw<LabSampleAuthorityRow[]>(Prisma.sql`
          INSERT INTO public."lab_samples" (
            "id", "dealId", "shipmentId", "status", "culture", "labId",
            "labName", "version", "createdAt"
          ) VALUES (
            ${sampleId}, ${deal.id}, ${nullableString(shipmentId)}, 'PENDING',
            ${nullableString(deal.culture)}, ${authority.laboratoryOrgId},
            ${authority.laboratoryName}, 1, now()
          )
          RETURNING *
        `);
        const sample = rows[0];
        if (!sample) throw new ConflictException('Sample insert did not return an authoritative row.');
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO labs.sample_authorities (
            id, tenant_id, deal_id, sample_id, laboratory_id,
            assigned_user_id, status, created_by_command_id, version, created_at, updated_at
          ) VALUES (
            ${`sample-authority-${randomUUID()}`}, ${context.tenantId}, ${deal.id},
            ${sample.id}, ${authority.laboratoryId}, ${context.userId}, 'ACTIVE',
            ${normalized.commandId as string}, 1, now(), now()
          )
        `);
        return {
          sample,
          eventPayload: {
            sampleId: sample.id,
            laboratoryOrgId: authority.laboratoryOrgId,
            shipmentId: shipmentId ?? null,
            note: (normalized.note as string | undefined) ?? null,
          },
        };
      },
    );
  }

  async collect(
    id: string,
    command: CollectLabSampleCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    this.assertLabMutationRole(user);
    const normalized: NormalizedLabCommand = {
      sampleId: requiredIdentifier(id, 'sampleId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      occurredAt: requiredDate(command.occurredAt, 'occurredAt'),
      evidenceRef: requiredIdentifier(command.evidenceRef, 'evidenceRef'),
      sealCode: optionalIdentifier(command.sealCode, 'sealCode'),
    };

    return this.executeMutation(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.sample.collect',
      'lab.sample.collected',
      async (tx, sample, context) => {
        if (!sample) throw scopedNotFound();
        if (sample.status !== 'PENDING') {
          throw new ConflictException({ code: 'SAMPLE_NOT_PENDING', status: sample.status });
        }
        this.assertVersion(sample, normalized.expectedVersion as number);
        const authority = await this.requireAuthority(tx, context, sample.id);
        await this.requireEvidence(
          tx,
          normalized.evidenceRef as string,
          sample.dealId,
          sample.shipmentId ?? undefined,
        );
        const custody = await this.insertCustody(tx, sample, context, normalized, 'COLLECTED');
        const rows = await tx.$queryRaw<LabSampleAuthorityRow[]>(Prisma.sql`
          UPDATE public."lab_samples"
          SET "status" = 'COLLECTED', "collectedAt" = ${normalized.occurredAt as Date},
              "labId" = ${authority.laboratoryOrgId}, "labName" = ${authority.laboratoryName},
              "version" = "version" + 1
          WHERE "id" = ${sample.id} AND "version" = ${sample.version}
          RETURNING *
        `);
        if (!rows[0]) throw concurrentUpdate();
        return {
          sample: rows[0],
          custodyEvent: custody,
          eventPayload: {
            custodyEventId: custody.id,
            evidenceRef: normalized.evidenceRef as string,
            occurredAt: (normalized.occurredAt as Date).toISOString(),
          },
        };
      },
    );
  }

  async recordTest(
    id: string,
    command: RecordLabTestCommand,
    user: RequestUser,
  ): Promise<LabMutationResult> {
    this.assertLabMutationRole(user);
    const normalized: NormalizedLabCommand = {
      sampleId: requiredIdentifier(id, 'sampleId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      metric: requiredIdentifier(command.metric, 'metric'),
      value: requiredFinite(command.value, 'value'),
      unit: optionalText(command.unit, 'unit', 50),
      normMin: optionalFinite(command.normMin, 'normMin'),
      normMax: optionalFinite(command.normMax, 'normMax'),
      methodId: requiredIdentifier(command.methodId, 'methodId'),
      equipmentId: requiredIdentifier(command.equipmentId, 'equipmentId'),
      recordedAt: requiredDate(command.recordedAt, 'recordedAt'),
      note: optionalText(command.note, 'note', 1000),
    };
    if (normalized.normMin === undefined && normalized.normMax === undefined) {
      throw new BadRequestException({ code: 'LAB_NORM_REQUIRED' });
    }

    return this.executeMutation(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.test.record',
      'lab.test.recorded',
      async (tx, sample, context) => {
        if (!sample) throw scopedNotFound();
        if (!['COLLECTED', 'ANALYSIS_IN_PROGRESS'].includes(sample.status)) {
          throw new ConflictException({ code: 'SAMPLE_NOT_TESTABLE', status: sample.status });
        }
        this.assertVersion(sample, normalized.expectedVersion as number);
        await this.requireAuthority(tx, context, sample.id);
        await this.requireMethodEquipment(
          tx,
          context,
          normalized.methodId as string,
          normalized.equipmentId as string,
          normalized.metric as string,
        );
        const value = normalized.value as number;
        const normMin = normalized.normMin as number | undefined;
        const normMax = normalized.normMax as number | undefined;
        const passed = (normMin === undefined || value >= normMin)
          && (normMax === undefined || value <= normMax);
        const publicTestId = `lab-test-${randomUUID()}`;
        const testRows = await tx.$queryRaw<LabTestAuthorityRow[]>(Prisma.sql`
          INSERT INTO public."lab_tests" (
            "id", "sampleId", "parameter", "value", "unit", "normMin",
            "normMax", "passed", "recordedAt"
          ) VALUES (
            ${publicTestId}, ${sample.id}, ${normalized.metric as string}, ${value},
            ${nullableString(normalized.unit)}, ${nullableNumber(normMin)},
            ${nullableNumber(normMax)}, ${passed}, ${normalized.recordedAt as Date}
          )
          RETURNING *
        `);
        const test = testRows[0];
        if (!test) throw new ConflictException('Lab test insert did not return an authoritative row.');
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO labs.test_facts (
            id, tenant_id, deal_id, sample_id, public_test_id, method_id,
            equipment_id, actor_user_id, parameter, value, unit, norm_min,
            norm_max, result, occurred_at, command_id, idempotency_key,
            correlation_id, note, created_at
          ) VALUES (
            ${`test-fact-${randomUUID()}`}, ${context.tenantId}, ${sample.dealId},
            ${sample.id}, ${test.id}, ${normalized.methodId as string},
            ${normalized.equipmentId as string}, ${context.userId},
            ${normalized.metric as string}, ${value}, ${nullableString(normalized.unit)},
            ${nullableNumber(normMin)}, ${nullableNumber(normMax)},
            ${passed ? 'PASSED' : 'FAILED'}, ${normalized.recordedAt as Date},
            ${normalized.commandId as string},
            ${this.persistentKey(context, normalized.idempotencyKey as string)},
            ${normalized.correlationId as string}, ${nullableString(normalized.note)}, now()
          )
        `);
        const sampleRows = await tx.$queryRaw<LabSampleAuthorityRow[]>(Prisma.sql`
          UPDATE public."lab_samples"
          SET "status" = 'ANALYSIS_IN_PROGRESS', "version" = "version" + 1
          WHERE "id" = ${sample.id} AND "version" = ${sample.version}
          RETURNING *
        `);
        if (!sampleRows[0]) throw concurrentUpdate();
        return {
          sample: sampleRows[0],
          test,
          eventPayload: {
            testId: test.id,
            methodId: normalized.methodId as string,
            equipmentId: normalized.equipmentId as string,
            result: passed ? 'PASSED' : 'FAILED',
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
    this.assertLabMutationRole(user);
    const normalized: NormalizedLabCommand = {
      sampleId: requiredIdentifier(id, 'sampleId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
      expectedVersion: requiredVersion(command.expectedVersion),
      protocolNumber: requiredIdentifier(command.protocolNumber, 'protocolNumber'),
      applicableStandard: requiredIdentifier(command.applicableStandard, 'applicableStandard'),
      accreditationRef: requiredIdentifier(command.accreditationRef, 'accreditationRef'),
      signedEvidenceRef: requiredIdentifier(command.signedEvidenceRef, 'signedEvidenceRef'),
      finalizedAt: requiredDate(command.finalizedAt, 'finalizedAt'),
    };

    return this.executeMutation(
      normalized.sampleId as string,
      normalized,
      user,
      'lab.protocol.finalize',
      'lab.protocol.finalized',
      async (tx, sample, context) => {
        if (!sample) throw scopedNotFound();
        if (!['COLLECTED', 'ANALYSIS_IN_PROGRESS'].includes(sample.status)) {
          throw new ConflictException({ code: 'SAMPLE_NOT_FINALIZABLE', status: sample.status });
        }
        this.assertVersion(sample, normalized.expectedVersion as number);
        const authority = await this.requireAuthority(tx, context, sample.id);
        if (authority.accreditationRef !== normalized.accreditationRef) {
          throw new ForbiddenException('Protocol accreditation does not match the active laboratory authority.');
        }
        await this.requireEvidence(
          tx,
          normalized.signedEvidenceRef as string,
          sample.dealId,
          sample.shipmentId ?? undefined,
        );
        const testCount = await tx.labTest.count({ where: { sampleId: sample.id } });
        if (testCount < 1) throw new ConflictException({ code: 'LAB_TESTS_REQUIRED' });
        const collected = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM labs.custody_events
          WHERE sample_id = ${sample.id} AND event_type = 'COLLECTED'
        `);
        if ((collected[0]?.count ?? 0n) < 1n) {
          throw new ConflictException({ code: 'CUSTODY_CHAIN_INCOMPLETE' });
        }
        const protocolRows = await tx.$queryRaw<LabProtocolRecord[]>(Prisma.sql`
          INSERT INTO labs.protocols (
            id, tenant_id, deal_id, sample_id, laboratory_org_id,
            protocol_number, applicable_standard, accreditation_ref,
            evidence_file_id, status, finalized_by_user_id, finalized_at,
            version, created_at
          ) VALUES (
            ${`lab-protocol-${randomUUID()}`}, ${context.tenantId}, ${sample.dealId},
            ${sample.id}, ${authority.laboratoryOrgId},
            ${normalized.protocolNumber as string}, ${normalized.applicableStandard as string},
            ${normalized.accreditationRef as string}, ${normalized.signedEvidenceRef as string},
            'FINALIZED', ${context.userId}, ${normalized.finalizedAt as Date}, 1, now()
          )
          RETURNING *
        `);
        const protocol = protocolRows[0];
        if (!protocol) throw new ConflictException('Protocol insert did not return an authoritative row.');
        const custody = await this.insertCustody(tx, sample, context, normalized, 'FINALIZED');
        const sampleRows = await tx.$queryRaw<LabSampleAuthorityRow[]>(Prisma.sql`
          UPDATE public."lab_samples"
          SET "status" = 'FINALIZED', "protocol" = ${normalized.protocolNumber as string},
              "gost" = ${normalized.applicableStandard as string},
              "labId" = ${authority.laboratoryOrgId}, "labName" = ${authority.laboratoryName},
              "finalizedAt" = ${normalized.finalizedAt as Date},
              "certificateDocId" = ${normalized.signedEvidenceRef as string},
              "version" = "version" + 1
          WHERE "id" = ${sample.id} AND "version" = ${sample.version}
          RETURNING *
        `);
        if (!sampleRows[0]) throw concurrentUpdate();
        return {
          sample: sampleRows[0],
          custodyEvent: custody,
          protocol,
          eventPayload: {
            protocolId: protocol.id,
            protocolNumber: protocol.protocolNumber,
            evidenceRef: protocol.evidenceFileId,
          },
        };
      },
    );
  }

  private async executeMutation(
    sampleId: string | null,
    command: NormalizedLabCommand,
    user: RequestUser,
    action: string,
    eventType: string,
    work: (
      tx: Prisma.TransactionClient,
      sample: LabSampleAuthorityRow | null,
      context: TrustedRlsContext,
    ) => Promise<MutationArtifacts>,
  ): Promise<LabMutationResult> {
    const requestFingerprint = digest({ action, sampleId, command });
    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        const persistentKey = this.persistentKey(context, command.idempotencyKey);
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (replay) return replay;

        let candidate = sampleId ? await this.findSample(tx, sampleId) : null;
        if (sampleId && !candidate) throw scopedNotFound();
        const dealId = candidate?.dealId ?? String(command.dealId ?? '');
        if (!dealId) throw new BadRequestException({ code: 'DEAL_ID_REQUIRED' });
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${dealId}, 73)) IS NULL AS locked
        `);

        const lockedReplay = await this.replay(tx, persistentKey, requestFingerprint);
        if (lockedReplay) return lockedReplay;
        if (sampleId) {
          candidate = await this.findSample(tx, sampleId);
          if (!candidate) throw scopedNotFound();
        }

        const artifacts = await work(tx, candidate, context);
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
          beforeState: candidate ? sampleState(candidate) : null,
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
            beforeState: auditMaterial.beforeState as Prisma.InputJsonValue | undefined,
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
              protocolId: artifacts.protocol?.id ?? null,
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
          custodyEvent: artifacts.custodyEvent,
          protocol: artifacts.protocol ? publicProtocol(artifacts.protocol) : undefined,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20_000,
      });
    } catch (error) {
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
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
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
    const protocol = typeof payload.protocolId === 'string'
      ? await this.findProtocol(tx, payload.protocolId)
      : undefined;
    return {
      sample: publicSample(sample),
      auditId: outbox.auditId,
      outboxId: outbox.id,
      duplicate: true,
      test: test ? publicTest(test) : undefined,
      custodyEvent,
      protocol: protocol ? publicProtocol(protocol) : undefined,
    };
  }

  private async requireAuthority(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    sampleId: string | undefined,
  ): Promise<LabAuthority> {
    const rows = await tx.$queryRaw<LabAuthority[]>(Prisma.sql`
      SELECT
        laboratory.id AS "laboratoryId",
        laboratory.organization_id AS "laboratoryOrgId",
        organization.name AS "laboratoryName",
        accreditation.id AS "accreditationId",
        accreditation.reference AS "accreditationRef",
        personnel.id AS "personnelId"
      FROM labs.laboratories laboratory
      JOIN public.organizations organization
        ON organization.id = laboratory.organization_id
       AND organization."tenantId" = laboratory.tenant_id
       AND organization.status = 'VERIFIED'
       AND organization."kycStatus" = 'APPROVED'
      JOIN labs.accreditations accreditation
        ON accreditation.laboratory_id = laboratory.id
       AND accreditation.status = 'ACTIVE'
       AND accreditation.valid_from <= now()
       AND (accreditation.valid_until IS NULL OR accreditation.valid_until > now())
      JOIN labs.personnel personnel
        ON personnel.laboratory_id = laboratory.id
       AND personnel.user_id = ${context.userId}
       AND personnel.status = 'ACTIVE'
       AND personnel.authorized_from <= now()
       AND (personnel.authorized_until IS NULL OR personnel.authorized_until > now())
      ${sampleId ? Prisma.sql`
        JOIN labs.sample_authorities authority
          ON authority.laboratory_id = laboratory.id
         AND authority.sample_id = ${sampleId}
         AND authority.status = 'ACTIVE'
         AND (authority.assigned_user_id = ${context.userId}
              OR ${context.role} IN ('SUPPORT_MANAGER', 'ADMIN'))
      ` : Prisma.empty}
      WHERE laboratory.tenant_id = ${context.tenantId}
        AND laboratory.organization_id = ${context.orgId}
        AND laboratory.status = 'ACTIVE'
      ORDER BY accreditation.valid_from DESC
      LIMIT 1
    `);
    if (!rows[0]) {
      throw new ForbiddenException('Active laboratory, accreditation and personnel authority are required.');
    }
    return rows[0];
  }

  private async requireMethodEquipment(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    methodId: string,
    equipmentId: string,
    parameter: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ method_ok: boolean; equipment_ok: boolean }>>(Prisma.sql`
      SELECT
        EXISTS (
          SELECT 1
          FROM labs.methods method
          JOIN labs.laboratories laboratory ON laboratory.id = method.laboratory_id
          WHERE method.id = ${methodId}
            AND method.tenant_id = ${context.tenantId}
            AND laboratory.organization_id = ${context.orgId}
            AND method.parameter = ${parameter}
            AND method.status = 'ACTIVE'
        ) AS method_ok,
        EXISTS (
          SELECT 1
          FROM labs.equipment equipment
          JOIN labs.laboratories laboratory ON laboratory.id = equipment.laboratory_id
          WHERE equipment.id = ${equipmentId}
            AND equipment.tenant_id = ${context.tenantId}
            AND laboratory.organization_id = ${context.orgId}
            AND equipment.status = 'ACTIVE'
            AND (equipment.calibration_valid_until IS NULL OR equipment.calibration_valid_until > now())
        ) AS equipment_ok
    `);
    if (!rows[0]?.method_ok) throw new ForbiddenException('Laboratory method is not active for this parameter.');
    if (!rows[0]?.equipment_ok) throw new ForbiddenException('Laboratory equipment is not active or calibrated.');
  }

  private async requireEvidence(
    tx: Prisma.TransactionClient,
    evidenceId: string,
    dealId: string,
    shipmentId?: string,
  ): Promise<void> {
    const evidence = await tx.evidenceFile.findUnique({ where: { id: evidenceId } });
    if (!evidence || evidence.dealId !== dealId) {
      throw new BadRequestException({ code: 'LAB_EVIDENCE_NOT_FOUND' });
    }
    if (shipmentId && evidence.shipmentId && evidence.shipmentId !== shipmentId) {
      throw new BadRequestException({ code: 'LAB_EVIDENCE_SHIPMENT_MISMATCH' });
    }
    if (!evidence.hash || !evidence.s3Key) {
      throw new BadRequestException({ code: 'LAB_EVIDENCE_INCOMPLETE' });
    }
  }

  private async insertCustody(
    tx: Prisma.TransactionClient,
    sample: LabSampleAuthorityRow,
    context: TrustedRlsContext,
    command: NormalizedLabCommand,
    eventType: string,
  ): Promise<LabCustodyRecord> {
    const rows = await tx.$queryRaw<LabCustodyRecord[]>(Prisma.sql`
      INSERT INTO labs.custody_events (
        id, tenant_id, deal_id, sample_id, event_type, actor_user_id,
        actor_org_id, evidence_file_id, seal_code, occurred_at, command_id,
        idempotency_key, correlation_id, created_at
      ) VALUES (
        ${`lab-custody-${randomUUID()}`}, ${context.tenantId}, ${sample.dealId},
        ${sample.id}, ${eventType}, ${context.userId}, ${context.orgId},
        ${nullableString(command.evidenceRef)}, ${nullableString(command.sealCode)},
        ${command.occurredAt instanceof Date ? command.occurredAt : command.finalizedAt as Date},
        ${command.commandId},
        ${this.persistentKey(context, `${command.idempotencyKey}:custody`)},
        ${command.correlationId}, now()
      )
      RETURNING
        id,
        tenant_id AS "tenantId",
        deal_id AS "dealId",
        sample_id AS "sampleId",
        event_type AS "eventType",
        actor_user_id AS "actorUserId",
        actor_org_id AS "actorOrgId",
        evidence_file_id AS "evidenceFileId",
        seal_code AS "sealCode",
        occurred_at AS "occurredAt",
        command_id AS "commandId",
        idempotency_key AS "idempotencyKey",
        correlation_id AS "correlationId",
        created_at AS "createdAt"
    `);
    if (!rows[0]) throw new ConflictException('Custody insert did not return an authoritative row.');
    return rows[0];
  }

  private async findSample(
    tx: Prisma.TransactionClient,
    sampleId: string,
  ): Promise<LabSampleAuthorityRow | null> {
    const rows = await tx.$queryRaw<LabSampleAuthorityRow[]>(Prisma.sql`
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
  ): Promise<LabTestAuthorityRow[]> {
    return tx.$queryRaw<LabTestAuthorityRow[]>(Prisma.sql`
      SELECT test.*
      FROM public."lab_tests" test
      WHERE test."sampleId" = ${sampleId}
      ORDER BY test."recordedAt" ASC, test."id" ASC
      LIMIT 1000
    `);
  }

  private async findTest(
    tx: Prisma.TransactionClient,
    testId: string,
  ): Promise<LabTestAuthorityRow | undefined> {
    const rows = await tx.$queryRaw<LabTestAuthorityRow[]>(Prisma.sql`
      SELECT test.* FROM public."lab_tests" test WHERE test."id" = ${testId} LIMIT 1
    `);
    return rows[0];
  }

  private async findCustody(
    tx: Prisma.TransactionClient,
    sampleId: string,
  ): Promise<LabCustodyRecord[]> {
    return tx.$queryRaw<LabCustodyRecord[]>(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        deal_id AS "dealId",
        sample_id AS "sampleId",
        event_type AS "eventType",
        actor_user_id AS "actorUserId",
        actor_org_id AS "actorOrgId",
        evidence_file_id AS "evidenceFileId",
        seal_code AS "sealCode",
        occurred_at AS "occurredAt",
        command_id AS "commandId",
        idempotency_key AS "idempotencyKey",
        correlation_id AS "correlationId",
        created_at AS "createdAt"
      FROM labs.custody_events
      WHERE sample_id = ${sampleId}
      ORDER BY occurred_at ASC, id ASC
      LIMIT 1000
    `);
  }

  private async findCustodyEvent(
    tx: Prisma.TransactionClient,
    eventId: string,
  ): Promise<LabCustodyRecord | undefined> {
    const rows = await tx.$queryRaw<LabCustodyRecord[]>(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        deal_id AS "dealId",
        sample_id AS "sampleId",
        event_type AS "eventType",
        actor_user_id AS "actorUserId",
        actor_org_id AS "actorOrgId",
        evidence_file_id AS "evidenceFileId",
        seal_code AS "sealCode",
        occurred_at AS "occurredAt",
        command_id AS "commandId",
        idempotency_key AS "idempotencyKey",
        correlation_id AS "correlationId",
        created_at AS "createdAt"
      FROM labs.custody_events
      WHERE id = ${eventId}
      LIMIT 1
    `);
    return rows[0];
  }

  private async findProtocols(
    tx: Prisma.TransactionClient,
    sampleId: string,
  ): Promise<LabProtocolRecord[]> {
    return tx.$queryRaw<LabProtocolRecord[]>(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        deal_id AS "dealId",
        sample_id AS "sampleId",
        laboratory_org_id AS "laboratoryOrgId",
        protocol_number AS "protocolNumber",
        applicable_standard AS "applicableStandard",
        accreditation_ref AS "accreditationRef",
        evidence_file_id AS "evidenceFileId",
        status,
        finalized_by_user_id AS "finalizedByUserId",
        finalized_at AS "finalizedAt",
        supersedes_protocol_id AS "supersedesProtocolId",
        version,
        created_at AS "createdAt"
      FROM labs.protocols
      WHERE sample_id = ${sampleId}
      ORDER BY finalized_at ASC, id ASC
      LIMIT 100
    `);
  }

  private async findProtocol(
    tx: Prisma.TransactionClient,
    protocolId: string,
  ): Promise<LabProtocolRecord | undefined> {
    const rows = await tx.$queryRaw<LabProtocolRecord[]>(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        deal_id AS "dealId",
        sample_id AS "sampleId",
        laboratory_org_id AS "laboratoryOrgId",
        protocol_number AS "protocolNumber",
        applicable_standard AS "applicableStandard",
        accreditation_ref AS "accreditationRef",
        evidence_file_id AS "evidenceFileId",
        status,
        finalized_by_user_id AS "finalizedByUserId",
        finalized_at AS "finalizedAt",
        supersedes_protocol_id AS "supersedesProtocolId",
        version,
        created_at AS "createdAt"
      FROM labs.protocols
      WHERE id = ${protocolId}
      LIMIT 1
    `);
    return rows[0];
  }

  private assertLabMutationRole(user: RequestUser): void {
    if (!LAB_MUTATION_ROLES.has(user.role)) {
      throw new ForbiddenException('Role cannot mutate laboratory facts.');
    }
  }

  private assertVersion(sample: LabSampleAuthorityRow, expectedVersion: number): void {
    if (sample.version !== expectedVersion) {
      throw new ConflictException({
        code: 'STALE_LAB_SAMPLE_VERSION',
        currentVersion: String(sample.version),
      });
    }
  }

  private persistentKey(context: TrustedRlsContext, idempotencyKey: string): string {
    return `lab:${digest({ tenantId: context.tenantId, userId: context.userId, idempotencyKey })}`;
  }
}

function publicSample(row: LabSampleAuthorityRow): LabSampleRecord {
  return {
    ...row,
    version: String(row.version),
    moneyDeltaKopecks: row.moneyDeltaKopecks === null ? null : String(row.moneyDeltaKopecks),
  };
}

function publicTest(row: LabTestAuthorityRow): LabTestRecord {
  return {
    ...row,
    value: Number(row.value),
    normMin: row.normMin === null ? null : Number(row.normMin),
    normMax: row.normMax === null ? null : Number(row.normMax),
    gradeDelta: row.gradeDelta === null ? null : Number(row.gradeDelta),
  };
}

function publicProtocol(row: LabProtocolRecord): LabProtocolRecord {
  return { ...row, version: String(row.version) };
}

function sampleState(sample: LabSampleAuthorityRow): Prisma.InputJsonObject {
  return {
    id: sample.id,
    dealId: sample.dealId,
    shipmentId: sample.shipmentId,
    status: sample.status,
    protocol: sample.protocol,
    gost: sample.gost,
    labId: sample.labId,
    collectedAt: sample.collectedAt?.toISOString() ?? null,
    finalizedAt: sample.finalizedAt?.toISOString() ?? null,
    certificateDocId: sample.certificateDocId,
    version: String(sample.version),
  };
}

function requiredIdentifier(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 200) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function optionalIdentifier(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredIdentifier(value, field);
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > max) {
    throw new BadRequestException({ code: 'INVALID_TEXT', field });
  }
  return normalized;
}

function requiredDate(value: unknown, field: string): Date {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) throw new BadRequestException({ code: 'INVALID_DATE', field });
  return date;
}

function requiredVersion(value: unknown): number {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) throw new BadRequestException({ code: 'INVALID_VERSION' });
  const version = Number(normalized);
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new BadRequestException({ code: 'INVALID_VERSION' });
  }
  return version;
}

function requiredFinite(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new BadRequestException({ code: 'INVALID_NUMBER', field });
  return number;
}

function optionalFinite(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredFinite(value, field);
}

function nullableString(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === undefined || value === null || value === '' ? null : Number(value);
}

function scopedNotFound(): NotFoundException {
  return new NotFoundException('Laboratory sample was not found in the current authority scope.');
}

function concurrentUpdate(): ConflictException {
  return new ConflictException({ code: 'CONCURRENT_LAB_SAMPLE_UPDATE' });
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
