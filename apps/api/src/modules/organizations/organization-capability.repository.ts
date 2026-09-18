import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  organizationCapabilityDefinition,
  type OrganizationCapabilityCode,
} from './organization-capability.registry';
import type {
  OrganizationCapabilityMutationInput,
  OrganizationCapabilityMutationResult,
  OrganizationCapabilityRecord,
  OrganizationCapabilityStatus,
} from './organization-capability.types';

type AssignmentRow = Readonly<{
  id: string;
  tenantId: string;
  organizationId: string;
  capabilityCode: OrganizationCapabilityCode;
  status: OrganizationCapabilityStatus;
  evidenceKind: 'DECLARATION_ONLY' | 'ROLE_ELIGIBILITY' | 'SERVER_EVIDENCE_REQUIRED';
  evidenceRef: string | null;
  version: bigint;
  createdAt: Date;
  updatedAt: Date;
}>;

type ReceiptRow = Readonly<{
  requestFingerprint: string;
  resultPayload: unknown;
}>;

type EvidenceRow = Readonly<{
  evidenceRef: string;
  verdictId: string;
}>;

type ResultEnvelope = Readonly<{
  assignment: OrganizationCapabilityRecord;
  reasonCode: string;
  auditId: string;
  outboxId: string;
}>;

@Injectable()
export class OrganizationCapabilityRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser): Promise<OrganizationCapabilityRecord[]> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const rows = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
        SELECT
          id,
          tenant_id AS "tenantId",
          organization_id AS "organizationId",
          capability_code AS "capabilityCode",
          status,
          evidence_kind AS "evidenceKind",
          evidence_ref AS "evidenceRef",
          version,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM capability.organization_assignments
        ORDER BY capability_code ASC
      `);
      return rows.map(publicAssignment);
    });
  }

  async mutate(
    command: OrganizationCapabilityMutationInput,
    user: RequestUser,
  ): Promise<OrganizationCapabilityMutationResult> {
    const requestFingerprint = sha256(stableJson({
      capabilityCode: command.capabilityCode,
      intent: command.intent,
      expectedVersion: command.expectedVersion.toString(),
    }));

    return this.rls.withTrustedContext(
      user,
      async (tx, context) => {
        await this.requireOrganizationAdmin(tx, context);

        const replay = await this.findReplay(
          tx,
          context,
          command.idempotencyKey,
          requestFingerprint,
        );
        if (replay) return replay;

        // Serialize the complete organization capability audit chain, not only
        // one capability row. CAS remains authoritative after the lock.
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`${context.tenantId}:${context.orgId}:organization-capability`}, 4997)
          ) IS NULL AS locked
        `);

        const lockedReplay = await this.findReplay(
          tx,
          context,
          command.idempotencyKey,
          requestFingerprint,
        );
        if (lockedReplay) return lockedReplay;

        const current = await this.findAssignment(tx, command.capabilityCode);
        const currentVersion = current?.version ?? 0n;
        if (currentVersion !== command.expectedVersion) {
          throw versionConflict(currentVersion);
        }

        const definition = organizationCapabilityDefinition(command.capabilityCode);
        const evidence = command.intent === 'ENABLE'
          ? await this.resolveEvidence(tx, command.capabilityCode, definition.evidencePolicy.kind)
          : null;

        const nextStatus = resolveNextStatus(command.intent, definition.evidencePolicy.kind, evidence);
        const reasonCode = resolveReasonCode(command.intent, definition.evidencePolicy.kind, evidence);
        const nextEvidenceRef = command.intent === 'DISABLE'
          ? current?.evidenceRef ?? null
          : evidence?.evidenceRef ?? null;

        const assignment = current
          ? await this.updateAssignment(
              tx,
              context,
              current,
              command.expectedVersion,
              nextStatus,
              definition.evidencePolicy.kind,
              nextEvidenceRef,
            )
          : await this.insertAssignment(
              tx,
              context,
              command.capabilityCode,
              command.expectedVersion,
              nextStatus,
              definition.evidencePolicy.kind,
              nextEvidenceRef,
            );

        const beforeState = current ? publicAssignment(current) : null;
        const afterState = publicAssignment(assignment);
        const auditId = `org-cap-audit-${randomUUID()}`;
        const outboxId = `org-cap-outbox-${randomUUID()}`;
        const receiptId = `org-cap-receipt-${randomUUID()}`;
        const previousAudit = await tx.auditEvent.findFirst({
          where: {
            tenantId: context.tenantId,
            orgId: context.orgId,
            objectType: 'OrganizationCapability',
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { hash: true },
        });
        const previousHash = previousAudit?.hash || null;
        const auditMaterial = {
          action: 'organization.capability.change',
          tenantId: context.tenantId,
          organizationId: context.orgId,
          actorUserId: context.userId,
          actorRole: context.role,
          capabilityCode: command.capabilityCode,
          intent: command.intent,
          beforeState,
          afterState,
          reasonCode,
          evidenceRef: nextEvidenceRef,
          requestFingerprint,
          correlationId: command.correlationId,
          previousHash,
        };
        const auditHash = sha256(stableJson(auditMaterial));

        await tx.auditEvent.create({
          data: {
            id: auditId,
            action: 'organization.capability.change',
            actorUserId: context.userId,
            actorRole: context.role,
            tenantId: context.tenantId,
            orgId: context.orgId,
            objectType: 'OrganizationCapability',
            objectId: command.capabilityCode,
            beforeState: beforeState as Prisma.InputJsonValue | undefined,
            afterState: afterState as unknown as Prisma.InputJsonValue,
            outcome: 'SUCCESS',
            reason: reasonCode,
            metadata: {
              intent: command.intent,
              evidenceRef: nextEvidenceRef,
              evidenceKind: definition.evidencePolicy.kind,
              requestFingerprint,
              assignmentVersion: afterState.version,
              shadowMode: true,
            },
            correlationId: command.correlationId,
            hash: auditHash,
            prevHash: previousHash,
          },
        });

        const outboxIdempotencyKey = sha256(
          `organization-capability:${context.tenantId}:${context.orgId}:${command.idempotencyKey}`,
        );
        await tx.outboxEntry.create({
          data: {
            id: outboxId,
            type: 'organization.capability.changed.v1',
            dealId: null,
            payload: {
              tenantId: context.tenantId,
              organizationId: context.orgId,
              capabilityCode: command.capabilityCode,
              status: afterState.status,
              version: afterState.version,
              evidenceKind: afterState.evidenceKind,
              evidenceRef: afterState.evidenceRef,
              reasonCode,
              auditId,
              correlationId: command.correlationId,
              shadowMode: true,
            },
            status: 'PENDING',
            triggeredByUserId: context.userId,
            idempotencyKey: outboxIdempotencyKey,
            correlationId: command.correlationId,
            auditId,
          },
        });

        const envelope: ResultEnvelope = {
          assignment: afterState,
          reasonCode,
          auditId,
          outboxId,
        };
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO capability.command_receipts (
            id,
            tenant_id,
            organization_id,
            capability_code,
            idempotency_key,
            request_fingerprint,
            result_payload,
            audit_id,
            outbox_id,
            created_by_user_id,
            created_at
          ) VALUES (
            ${receiptId},
            ${context.tenantId},
            ${context.orgId},
            ${command.capabilityCode},
            ${command.idempotencyKey},
            ${requestFingerprint},
            ${JSON.stringify(envelope)}::jsonb,
            ${auditId},
            ${outboxId},
            ${context.userId},
            clock_timestamp()
          )
        `);

        return { ...envelope, replayed: false };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20_000,
        maxConflictRetries: 3,
      },
    );
  }

  private async requireOrganizationAdmin(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT membership.id
      FROM public.user_orgs AS membership
      WHERE membership."userId" = ${context.userId}
        AND membership."organizationId" = ${context.orgId}
        AND membership.status = 'ACTIVE'
        AND membership.is_org_admin = TRUE
      LIMIT 1
    `);
    if (!rows[0]) {
      throw new ForbiddenException({ code: 'ORGANIZATION_CAPABILITY_ADMIN_REQUIRED' });
    }
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<OrganizationCapabilityMutationResult | null> {
    const rows = await tx.$queryRaw<ReceiptRow[]>(Prisma.sql`
      SELECT
        request_fingerprint AS "requestFingerprint",
        result_payload AS "resultPayload"
      FROM capability.command_receipts
      WHERE tenant_id = ${context.tenantId}
        AND organization_id = ${context.orgId}
        AND idempotency_key = ${idempotencyKey}
      LIMIT 1
    `);
    const receipt = rows[0];
    if (!receipt) return null;
    if (receipt.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({ code: 'ORGANIZATION_CAPABILITY_IDEMPOTENCY_PAYLOAD_MISMATCH' });
    }
    const parsed = parseResultEnvelope(receipt.resultPayload);
    return { ...parsed, replayed: true };
  }

  private async findAssignment(
    tx: Prisma.TransactionClient,
    capabilityCode: OrganizationCapabilityCode,
  ): Promise<AssignmentRow | null> {
    const rows = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        organization_id AS "organizationId",
        capability_code AS "capabilityCode",
        status,
        evidence_kind AS "evidenceKind",
        evidence_ref AS "evidenceRef",
        version,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM capability.organization_assignments
      WHERE capability_code = ${capabilityCode}
      LIMIT 1
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async resolveEvidence(
    tx: Prisma.TransactionClient,
    capabilityCode: OrganizationCapabilityCode,
    evidenceKind: 'DECLARATION_ONLY' | 'ROLE_ELIGIBILITY' | 'SERVER_EVIDENCE_REQUIRED',
  ): Promise<EvidenceRow | null> {
    if (evidenceKind !== 'ROLE_ELIGIBILITY') return null;
    const rows = await tx.$queryRaw<EvidenceRow[]>(Prisma.sql`
      SELECT
        evidence_ref AS "evidenceRef",
        verdict_id AS "verdictId"
      FROM capability.resolve_server_evidence(${capabilityCode})
    `);
    return rows[0] ?? null;
  }

  private async insertAssignment(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    capabilityCode: OrganizationCapabilityCode,
    expectedVersion: bigint,
    status: OrganizationCapabilityStatus,
    evidenceKind: 'DECLARATION_ONLY' | 'ROLE_ELIGIBILITY' | 'SERVER_EVIDENCE_REQUIRED',
    evidenceRef: string | null,
  ): Promise<AssignmentRow> {
    if (expectedVersion !== 0n) throw versionConflict(0n);
    const id = `org-cap-${randomUUID()}`;
    const rows = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
      INSERT INTO capability.organization_assignments (
        id,
        tenant_id,
        organization_id,
        capability_code,
        status,
        evidence_kind,
        evidence_ref,
        version,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      ) VALUES (
        ${id},
        ${context.tenantId},
        ${context.orgId},
        ${capabilityCode},
        ${status},
        ${evidenceKind},
        ${evidenceRef},
        1,
        ${context.userId},
        ${context.userId},
        clock_timestamp(),
        clock_timestamp()
      )
      RETURNING
        id,
        tenant_id AS "tenantId",
        organization_id AS "organizationId",
        capability_code AS "capabilityCode",
        status,
        evidence_kind AS "evidenceKind",
        evidence_ref AS "evidenceRef",
        version,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);
    const row = rows[0];
    if (!row) throw new ConflictException({ code: 'ORGANIZATION_CAPABILITY_INSERT_FAILED' });
    return row;
  }

  private async updateAssignment(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    current: AssignmentRow,
    expectedVersion: bigint,
    status: OrganizationCapabilityStatus,
    evidenceKind: 'DECLARATION_ONLY' | 'ROLE_ELIGIBILITY' | 'SERVER_EVIDENCE_REQUIRED',
    evidenceRef: string | null,
  ): Promise<AssignmentRow> {
    const rows = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
      UPDATE capability.organization_assignments
      SET
        status = ${status},
        evidence_kind = ${evidenceKind},
        evidence_ref = ${evidenceRef},
        version = version + 1,
        updated_by_user_id = ${context.userId},
        updated_at = clock_timestamp()
      WHERE id = ${current.id}
        AND version = ${expectedVersion}
      RETURNING
        id,
        tenant_id AS "tenantId",
        organization_id AS "organizationId",
        capability_code AS "capabilityCode",
        status,
        evidence_kind AS "evidenceKind",
        evidence_ref AS "evidenceRef",
        version,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);
    const row = rows[0];
    if (!row) throw versionConflict(current.version);
    return row;
  }
}

function resolveNextStatus(
  intent: OrganizationCapabilityMutationInput['intent'],
  evidenceKind: 'DECLARATION_ONLY' | 'ROLE_ELIGIBILITY' | 'SERVER_EVIDENCE_REQUIRED',
  evidence: EvidenceRow | null,
): OrganizationCapabilityStatus {
  if (intent === 'DISABLE') return 'DISABLED';
  if (evidenceKind === 'DECLARATION_ONLY') return 'ACTIVE';
  return evidence ? 'ACTIVE' : 'PENDING';
}

function resolveReasonCode(
  intent: OrganizationCapabilityMutationInput['intent'],
  evidenceKind: 'DECLARATION_ONLY' | 'ROLE_ELIGIBILITY' | 'SERVER_EVIDENCE_REQUIRED',
  evidence: EvidenceRow | null,
): string {
  if (intent === 'DISABLE') return 'CAPABILITY_DISABLED_BY_ORGANIZATION_ADMIN';
  if (evidenceKind === 'DECLARATION_ONLY') return 'DECLARATION_ONLY_CAPABILITY_ENABLED';
  if (evidence) return 'CURRENT_SERVER_HELD_EVIDENCE_CONFIRMED';
  return 'SERVER_HELD_EVIDENCE_REQUIRED';
}

function publicAssignment(row: AssignmentRow): OrganizationCapabilityRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    capabilityCode: row.capabilityCode,
    status: row.status,
    evidenceKind: row.evidenceKind,
    evidenceRef: row.evidenceRef,
    version: row.version.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseResultEnvelope(value: unknown): ResultEnvelope {
  if (!value || typeof value !== 'object') throw corruptReceipt();
  const record = value as Record<string, unknown>;
  if (
    !record.assignment
    || typeof record.assignment !== 'object'
    || typeof record.reasonCode !== 'string'
    || typeof record.auditId !== 'string'
    || typeof record.outboxId !== 'string'
  ) {
    throw corruptReceipt();
  }
  const assignment = record.assignment as Record<string, unknown>;
  if (
    typeof assignment.id !== 'string'
    || typeof assignment.tenantId !== 'string'
    || typeof assignment.organizationId !== 'string'
    || typeof assignment.capabilityCode !== 'string'
    || typeof assignment.status !== 'string'
    || typeof assignment.evidenceKind !== 'string'
    || !(assignment.evidenceRef === null || typeof assignment.evidenceRef === 'string')
    || typeof assignment.version !== 'string'
    || typeof assignment.createdAt !== 'string'
    || typeof assignment.updatedAt !== 'string'
  ) {
    throw corruptReceipt();
  }
  return value as ResultEnvelope;
}

function corruptReceipt(): ConflictException {
  return new ConflictException({ code: 'ORGANIZATION_CAPABILITY_RECEIPT_CORRUPT' });
}

function versionConflict(currentVersion: bigint): ConflictException {
  return new ConflictException({
    code: 'ORGANIZATION_CAPABILITY_VERSION_CONFLICT',
    currentVersion: currentVersion.toString(),
  });
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortJson(nested)]),
  );
}
