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
import { RequestUser, Role } from '../../common/types/request-user';

export type LabActorType = 'SAMPLER' | 'COURIER' | 'RECEIVER' | 'ANALYST' | 'SIGNATORY';

export type ProvisionLabAuthorityCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId?: string;
  dealId: string;
  laboratoryOrgId: string;
  accreditationRef: string;
  evidenceRef: string;
  validUntil?: string;
  actors: ReadonlyArray<Readonly<{
    userId: string;
    actorType: LabActorType;
    evidenceRef: string;
    validUntil?: string;
  }>>;
  methods: ReadonlyArray<Readonly<{
    code: string;
    parameter: string;
    unit: string;
    standardRef: string;
    normMin?: string;
    normMax?: string;
    evidenceRef: string;
    validUntil?: string;
  }>>;
  equipment: ReadonlyArray<Readonly<{
    code: string;
    name: string;
    serialNumber?: string;
    calibrationValidUntil: string;
    evidenceRef: string;
  }>>;
}>;

export type IssueLabSampleAdmissionCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId?: string;
  dealId: string;
  shipmentId: string;
  acceptanceId: string;
  laboratoryOrgId: string;
  evidenceRef: string;
  validUntil?: string;
}>;

type AuthorityReceipt = Readonly<{
  auditId: string;
  outboxId: string;
  duplicate: boolean;
  laboratoryOrgId: string;
  admissionId?: string;
}>;

const PRIVILEGED_ROLES = new Set<Role>([
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
]);
const ACTOR_TYPES = new Set<LabActorType>([
  'SAMPLER',
  'COURIER',
  'RECEIVER',
  'ANALYST',
  'SIGNATORY',
]);

@Injectable()
export class LabAuthorityService {
  constructor(private readonly rls: RlsTransactionService) {}

  async provision(
    command: ProvisionLabAuthorityCommand,
    user: RequestUser,
  ): Promise<AuthorityReceipt> {
    this.assertPrivileged(user);
    const normalized = normalizeProvision(command);
    const requestFingerprint = digest({ action: 'lab.authority.provision', ...normalized });
    const persistentKey = authorityKey(user, normalized.idempotencyKey);

    return this.executeIdempotent(
      user,
      normalized.dealId,
      persistentKey,
      requestFingerprint,
      async (tx, context) => {
        await this.requireDeal(tx, normalized.dealId, context);
        await this.requireVerifiedOrganization(tx, normalized.laboratoryOrgId, context);
        await this.requirePurposeEvidence(
          tx,
          normalized.evidenceRef,
          context,
          normalized.dealId,
          'LAB_AUTHORITY',
          { laboratoryOrgId: normalized.laboratoryOrgId },
        );

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO labs.laboratories (
            id, tenant_id, organization_id, status, accreditation_status,
            accreditation_ref, evidence_file_id, valid_from, valid_until, version
          ) VALUES (
            ${`laboratory-${randomUUID()}`}, ${context.tenantId},
            ${normalized.laboratoryOrgId}, 'ACTIVE', 'VERIFIED',
            ${normalized.accreditationRef}, ${normalized.evidenceRef}, now(),
            ${normalized.validUntil}, 0
          )
          ON CONFLICT (tenant_id, organization_id) DO UPDATE SET
            status = 'ACTIVE',
            accreditation_status = 'VERIFIED',
            accreditation_ref = EXCLUDED.accreditation_ref,
            evidence_file_id = EXCLUDED.evidence_file_id,
            valid_until = EXCLUDED.valid_until,
            version = labs.laboratories.version + 1,
            updated_at = now()
        `);

        for (const actor of normalized.actors) {
          await this.requireActiveParticipant(tx, normalized.dealId, actor.userId, context);
          await this.requirePurposeEvidence(
            tx,
            actor.evidenceRef,
            context,
            normalized.dealId,
            'ACTOR_AUTHORITY',
            { laboratoryOrgId: normalized.laboratoryOrgId },
          );
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO labs.authorized_actors (
              id, tenant_id, laboratory_org_id, user_id, actor_type, status,
              evidence_file_id, valid_from, valid_until, version
            ) VALUES (
              ${`lab-actor-${randomUUID()}`}, ${context.tenantId},
              ${normalized.laboratoryOrgId}, ${actor.userId}, ${actor.actorType},
              'ACTIVE', ${actor.evidenceRef}, now(), ${actor.validUntil}, 0
            )
            ON CONFLICT (tenant_id, laboratory_org_id, user_id, actor_type) DO UPDATE SET
              status = 'ACTIVE',
              evidence_file_id = EXCLUDED.evidence_file_id,
              valid_until = EXCLUDED.valid_until,
              version = labs.authorized_actors.version + 1,
              updated_at = now()
          `);
        }

        for (const method of normalized.methods) {
          await this.requirePurposeEvidence(
            tx,
            method.evidenceRef,
            context,
            normalized.dealId,
            'METHOD_AUTHORITY',
            { laboratoryOrgId: normalized.laboratoryOrgId },
          );
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO labs.methods (
              id, tenant_id, laboratory_org_id, code, parameter, unit,
              standard_ref, norm_min, norm_max, status, evidence_file_id,
              valid_from, valid_until, version
            ) VALUES (
              ${`lab-method-${randomUUID()}`}, ${context.tenantId},
              ${normalized.laboratoryOrgId}, ${method.code}, ${method.parameter},
              ${method.unit}, ${method.standardRef}, ${method.normMin}, ${method.normMax},
              'ACTIVE', ${method.evidenceRef}, now(), ${method.validUntil}, 0
            )
            ON CONFLICT (tenant_id, laboratory_org_id, code) DO UPDATE SET
              parameter = EXCLUDED.parameter,
              unit = EXCLUDED.unit,
              standard_ref = EXCLUDED.standard_ref,
              norm_min = EXCLUDED.norm_min,
              norm_max = EXCLUDED.norm_max,
              status = 'ACTIVE',
              evidence_file_id = EXCLUDED.evidence_file_id,
              valid_until = EXCLUDED.valid_until,
              version = labs.methods.version + 1,
              updated_at = now()
          `);
        }

        for (const equipment of normalized.equipment) {
          await this.requirePurposeEvidence(
            tx,
            equipment.evidenceRef,
            context,
            normalized.dealId,
            'EQUIPMENT_AUTHORITY',
            { laboratoryOrgId: normalized.laboratoryOrgId },
          );
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO labs.equipment (
              id, tenant_id, laboratory_org_id, code, name, serial_number,
              status, calibration_valid_until, evidence_file_id, version
            ) VALUES (
              ${`lab-equipment-${randomUUID()}`}, ${context.tenantId},
              ${normalized.laboratoryOrgId}, ${equipment.code}, ${equipment.name},
              ${equipment.serialNumber}, 'ACTIVE', ${equipment.calibrationValidUntil},
              ${equipment.evidenceRef}, 0
            )
            ON CONFLICT (tenant_id, laboratory_org_id, code) DO UPDATE SET
              name = EXCLUDED.name,
              serial_number = EXCLUDED.serial_number,
              status = 'ACTIVE',
              calibration_valid_until = EXCLUDED.calibration_valid_until,
              evidence_file_id = EXCLUDED.evidence_file_id,
              version = labs.equipment.version + 1,
              updated_at = now()
          `);
        }

        return this.commitReceipt(tx, context, {
          persistentKey,
          requestFingerprint,
          commandId: normalized.commandId,
          correlationId: normalized.correlationId,
          dealId: normalized.dealId,
          action: 'lab.authority.provision',
          eventType: 'lab.authority.provisioned',
          objectId: normalized.laboratoryOrgId,
          payload: {
            laboratoryOrgId: normalized.laboratoryOrgId,
            actorCount: normalized.actors.length,
            methodCount: normalized.methods.length,
            equipmentCount: normalized.equipment.length,
          },
        });
      },
    );
  }

  async issueSampleAdmission(
    command: IssueLabSampleAdmissionCommand,
    user: RequestUser,
  ): Promise<AuthorityReceipt> {
    this.assertPrivileged(user);
    const normalized = normalizeAdmission(command);
    const requestFingerprint = digest({ action: 'lab.sample.admission.issue', ...normalized });
    const persistentKey = authorityKey(user, normalized.idempotencyKey);

    return this.executeIdempotent(
      user,
      normalized.dealId,
      persistentKey,
      requestFingerprint,
      async (tx, context) => {
        await this.requireDeal(tx, normalized.dealId, context);
        await this.requireShipmentAcceptance(
          tx,
          normalized.dealId,
          normalized.shipmentId,
          normalized.acceptanceId,
        );
        await this.requireActiveLaboratory(
          tx,
          normalized.dealId,
          normalized.laboratoryOrgId,
          context,
        );
        await this.requirePurposeEvidence(
          tx,
          normalized.evidenceRef,
          context,
          normalized.dealId,
          'ADMISSION',
          {
            shipmentId: normalized.shipmentId,
            acceptanceId: normalized.acceptanceId,
            laboratoryOrgId: normalized.laboratoryOrgId,
          },
        );

        const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id FROM labs.sample_admissions
          WHERE tenant_id = ${context.tenantId}
            AND deal_id = ${normalized.dealId}
            AND shipment_id = ${normalized.shipmentId}
            AND acceptance_id = ${normalized.acceptanceId}
            AND status = 'ACTIVE'
          FOR UPDATE
        `);
        if (existing.length > 0) {
          throw new ConflictException({ code: 'ACTIVE_LAB_SAMPLE_ADMISSION_EXISTS' });
        }

        const admissionId = `lab-admission-${randomUUID()}`;
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO labs.sample_admissions (
            id, tenant_id, deal_id, shipment_id, acceptance_id,
            laboratory_org_id, status, evidence_file_id, valid_from,
            valid_until, version
          ) VALUES (
            ${admissionId}, ${context.tenantId}, ${normalized.dealId},
            ${normalized.shipmentId}, ${normalized.acceptanceId},
            ${normalized.laboratoryOrgId}, 'ACTIVE', ${normalized.evidenceRef},
            now(), ${normalized.validUntil}, 0
          )
        `);

        return this.commitReceipt(tx, context, {
          persistentKey,
          requestFingerprint,
          commandId: normalized.commandId,
          correlationId: normalized.correlationId,
          dealId: normalized.dealId,
          action: 'lab.sample.admission.issue',
          eventType: 'lab.sample.admission.issued',
          objectId: admissionId,
          payload: {
            admissionId,
            laboratoryOrgId: normalized.laboratoryOrgId,
            shipmentId: normalized.shipmentId,
            acceptanceId: normalized.acceptanceId,
          },
        });
      },
    );
  }

  private async executeIdempotent(
    user: RequestUser,
    dealId: string,
    persistentKey: string,
    requestFingerprint: string,
    work: (
      tx: Prisma.TransactionClient,
      context: TrustedRlsContext,
    ) => Promise<AuthorityReceipt>,
  ): Promise<AuthorityReceipt> {
    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (replay) return replay;
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${dealId}, 83)) IS NULL AS locked
        `);
        const lockedReplay = await this.replay(tx, persistentKey, requestFingerprint);
        if (lockedReplay) return lockedReplay;
        return work(tx, context);
      }, { timeout: 20_000 });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return this.rls.withTrustedContext(user, async (tx) => {
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (!replay) throw error;
        return replay;
      });
    }
  }

  private async commitReceipt(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    input: {
      persistentKey: string;
      requestFingerprint: string;
      commandId: string;
      correlationId: string;
      dealId: string;
      action: string;
      eventType: string;
      objectId: string;
      payload: Prisma.InputJsonObject;
    },
  ): Promise<AuthorityReceipt> {
    const auditId = `audit-${randomUUID()}`;
    const outboxId = `outbox-${randomUUID()}`;
    const previousAudit = await tx.auditEvent.findFirst({
      where: { dealId: input.dealId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const auditMaterial = {
      id: auditId,
      action: input.action,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      dealId: input.dealId,
      objectType: 'lab_authority',
      objectId: input.objectId,
      beforeState: Prisma.JsonNull,
      afterState: input.payload,
      outcome: 'SUCCESS',
      correlationId: input.correlationId,
      metadata: {
        commandId: input.commandId,
        idempotencyKey: input.persistentKey,
        requestFingerprint: input.requestFingerprint,
      },
      prevHash: previousAudit?.hash ?? null,
    };
    await tx.auditEvent.create({
      data: {
        ...auditMaterial,
        afterState: input.payload,
        metadata: auditMaterial.metadata,
        hash: digest(auditMaterial),
      },
    });
    await tx.outboxEntry.create({
      data: {
        id: outboxId,
        type: input.eventType,
        dealId: input.dealId,
        status: 'PENDING',
        idempotencyKey: input.persistentKey,
        correlationId: input.correlationId,
        auditId,
        payload: {
          schemaVersion: 'lab-authority.v1',
          requestFingerprint: input.requestFingerprint,
          laboratoryOrgId: input.payload.laboratoryOrgId,
          admissionId: input.payload.admissionId ?? null,
          ...input.payload,
        },
      },
    });
    return {
      auditId,
      outboxId,
      duplicate: false,
      laboratoryOrgId: String(input.payload.laboratoryOrgId),
      admissionId: typeof input.payload.admissionId === 'string'
        ? input.payload.admissionId
        : undefined,
    };
  }

  private async replay(
    tx: Prisma.TransactionClient,
    persistentKey: string,
    requestFingerprint: string,
  ): Promise<AuthorityReceipt | null> {
    const outbox = await tx.outboxEntry.findUnique({ where: { idempotencyKey: persistentKey } });
    if (!outbox) return null;
    const payload = jsonObject(outbox.payload);
    if (payload.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED' });
    }
    if (!outbox.auditId || typeof payload.laboratoryOrgId !== 'string') {
      throw new ConflictException('Laboratory authority receipt is incomplete.');
    }
    return {
      auditId: outbox.auditId,
      outboxId: outbox.id,
      duplicate: true,
      laboratoryOrgId: payload.laboratoryOrgId,
      admissionId: typeof payload.admissionId === 'string' ? payload.admissionId : undefined,
    };
  }

  private async requireDeal(
    tx: Prisma.TransactionClient,
    dealId: string,
    context: TrustedRlsContext,
  ): Promise<void> {
    const deal = await tx.deal.findFirst({
      where: { id: dealId, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!deal) throw new NotFoundException('Deal is not available in the authenticated scope.');
  }

  private async requireVerifiedOrganization(
    tx: Prisma.TransactionClient,
    organizationId: string,
    context: TrustedRlsContext,
  ): Promise<void> {
    const organization = await tx.organization.findFirst({
      where: {
        id: organizationId,
        tenantId: context.tenantId,
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
      },
      select: { id: true },
    });
    if (!organization) throw new ConflictException({ code: 'LAB_ORGANIZATION_NOT_VERIFIED' });
  }

  private async requireActiveParticipant(
    tx: Prisma.TransactionClient,
    dealId: string,
    userId: string,
    context: TrustedRlsContext,
  ): Promise<void> {
    const participant = await tx.dealParticipant.findFirst({
      where: {
        dealId,
        tenantId: context.tenantId,
        userId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!participant) throw new ConflictException({ code: 'LAB_ACTOR_NOT_ACTIVE_DEAL_PARTICIPANT' });
  }

  private async requireShipmentAcceptance(
    tx: Prisma.TransactionClient,
    dealId: string,
    shipmentId: string,
    acceptanceId: string,
  ): Promise<void> {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, dealId },
      select: { id: true },
    });
    const acceptance = await tx.acceptanceRecord.findFirst({
      where: { id: acceptanceId, dealId, shipmentId },
      select: { id: true },
    });
    if (!shipment || !acceptance) {
      throw new ConflictException({ code: 'LAB_ADMISSION_SHIPMENT_ACCEPTANCE_MISMATCH' });
    }
  }

  private async requireActiveLaboratory(
    tx: Prisma.TransactionClient,
    dealId: string,
    laboratoryOrgId: string,
    context: TrustedRlsContext,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM labs.laboratories laboratory
        WHERE laboratory.tenant_id = ${context.tenantId}
          AND laboratory.organization_id = ${laboratoryOrgId}
          AND laboratory.status = 'ACTIVE'
          AND laboratory.accreditation_status = 'VERIFIED'
          AND laboratory.valid_from <= now()
          AND (laboratory.valid_until IS NULL OR laboratory.valid_until > now())
          AND public.app_labs_evidence_purpose_valid(
            laboratory.evidence_file_id, ${context.tenantId}, ${dealId},
            'LAB_AUTHORITY', NULL, NULL, NULL, ${laboratoryOrgId}, NULL
          )
      ) AS valid
    `);
    if (rows[0]?.valid !== true) {
      throw new ConflictException({ code: 'ACTIVE_ACCREDITED_LABORATORY_REQUIRED' });
    }
  }

  private async requirePurposeEvidence(
    tx: Prisma.TransactionClient,
    evidenceRef: string,
    context: TrustedRlsContext,
    dealId: string,
    purpose: string,
    binding: {
      sampleId?: string;
      shipmentId?: string;
      acceptanceId?: string;
      laboratoryOrgId?: string;
      protocolNumber?: string;
    },
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT public.app_labs_evidence_purpose_valid(
        ${evidenceRef}, ${context.tenantId}, ${dealId}, ${purpose},
        ${binding.sampleId ?? null}, ${binding.shipmentId ?? null},
        ${binding.acceptanceId ?? null}, ${binding.laboratoryOrgId ?? null},
        ${binding.protocolNumber ?? null}
      ) AS valid
    `);
    if (rows[0]?.valid !== true) {
      throw new ConflictException({
        code: 'LAB_EVIDENCE_PURPOSE_MISMATCH',
        purpose,
      });
    }
  }

  private assertPrivileged(user: RequestUser): void {
    if (!user.id || !user.orgId || !user.tenantId || !user.sessionId) {
      throw new ForbiddenException({ code: 'TRUSTED_CONTEXT_REQUIRED' });
    }
    if (!PRIVILEGED_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'LAB_AUTHORITY_ADMIN_ROLE_REQUIRED' });
    }
  }
}

function normalizeProvision(command: ProvisionLabAuthorityCommand) {
  if (!Array.isArray(command.actors) || command.actors.length === 0) {
    throw new BadRequestException({ code: 'LAB_AUTHORITY_ACTORS_REQUIRED' });
  }
  if (!Array.isArray(command.methods) || command.methods.length === 0) {
    throw new BadRequestException({ code: 'LAB_AUTHORITY_METHODS_REQUIRED' });
  }
  if (!Array.isArray(command.equipment) || command.equipment.length === 0) {
    throw new BadRequestException({ code: 'LAB_AUTHORITY_EQUIPMENT_REQUIRED' });
  }
  const normalized = {
    commandId: identifier(command.commandId, 'commandId'),
    idempotencyKey: identifier(command.idempotencyKey, 'idempotencyKey'),
    correlationId: command.correlationId
      ? identifier(command.correlationId, 'correlationId')
      : identifier(command.commandId, 'commandId'),
    dealId: identifier(command.dealId, 'dealId'),
    laboratoryOrgId: identifier(command.laboratoryOrgId, 'laboratoryOrgId'),
    accreditationRef: text(command.accreditationRef, 'accreditationRef', 240),
    evidenceRef: identifier(command.evidenceRef, 'evidenceRef'),
    validUntil: optionalFutureDate(command.validUntil, 'validUntil'),
    actors: command.actors.map((actor) => {
      if (!ACTOR_TYPES.has(actor.actorType)) {
        throw new BadRequestException({ code: 'INVALID_LAB_ACTOR_TYPE' });
      }
      return {
        userId: identifier(actor.userId, 'actor.userId'),
        actorType: actor.actorType,
        evidenceRef: identifier(actor.evidenceRef, 'actor.evidenceRef'),
        validUntil: optionalFutureDate(actor.validUntil, 'actor.validUntil'),
      };
    }),
    methods: command.methods.map((method) => {
      const normMin = optionalDecimal(method.normMin, 'method.normMin');
      const normMax = optionalDecimal(method.normMax, 'method.normMax');
      if (normMin === null && normMax === null) {
        throw new BadRequestException({ code: 'LAB_METHOD_NORM_REQUIRED' });
      }
      if (normMin !== null && normMax !== null && Number(normMin) > Number(normMax)) {
        throw new BadRequestException({ code: 'LAB_METHOD_NORM_RANGE_INVALID' });
      }
      return {
        code: identifier(method.code, 'method.code').toUpperCase(),
        parameter: text(method.parameter, 'method.parameter', 120),
        unit: text(method.unit, 'method.unit', 32),
        standardRef: text(method.standardRef, 'method.standardRef', 240),
        normMin,
        normMax,
        evidenceRef: identifier(method.evidenceRef, 'method.evidenceRef'),
        validUntil: optionalFutureDate(method.validUntil, 'method.validUntil'),
      };
    }),
    equipment: command.equipment.map((equipment) => ({
      code: identifier(equipment.code, 'equipment.code').toUpperCase(),
      name: text(equipment.name, 'equipment.name', 240),
      serialNumber: equipment.serialNumber
        ? text(equipment.serialNumber, 'equipment.serialNumber', 120)
        : null,
      calibrationValidUntil: futureDate(equipment.calibrationValidUntil, 'equipment.calibrationValidUntil'),
      evidenceRef: identifier(equipment.evidenceRef, 'equipment.evidenceRef'),
    })),
  };
  return normalized;
}

function normalizeAdmission(command: IssueLabSampleAdmissionCommand) {
  return {
    commandId: identifier(command.commandId, 'commandId'),
    idempotencyKey: identifier(command.idempotencyKey, 'idempotencyKey'),
    correlationId: command.correlationId
      ? identifier(command.correlationId, 'correlationId')
      : identifier(command.commandId, 'commandId'),
    dealId: identifier(command.dealId, 'dealId'),
    shipmentId: identifier(command.shipmentId, 'shipmentId'),
    acceptanceId: identifier(command.acceptanceId, 'acceptanceId'),
    laboratoryOrgId: identifier(command.laboratoryOrgId, 'laboratoryOrgId'),
    evidenceRef: identifier(command.evidenceRef, 'evidenceRef'),
    validUntil: optionalFutureDate(command.validUntil, 'validUntil'),
  };
}

function authorityKey(user: RequestUser, idempotencyKey: string): string {
  return `lab-authority:${user.tenantId}:${user.id}:${idempotencyKey}`;
}

function identifier(value: string, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 240 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function text(value: string, field: string, max: number): string {
  const normalized = String(value ?? '').normalize('NFKC').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_TEXT', field });
  }
  return normalized;
}

function optionalDecimal(value: string | undefined, field: string): string | null {
  if (value === undefined) return null;
  const normalized = String(value).trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d{1,6})?$/.test(normalized) || !Number.isFinite(Number(normalized))) {
    throw new BadRequestException({ code: 'INVALID_DECIMAL', field });
  }
  return normalized;
}

function optionalFutureDate(value: string | undefined, field: string): Date | null {
  return value === undefined ? null : futureDate(value, field);
}

function futureDate(value: string, field: string): Date {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new BadRequestException({ code: 'INVALID_FUTURE_DATE', field });
  }
  return date;
}

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
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
