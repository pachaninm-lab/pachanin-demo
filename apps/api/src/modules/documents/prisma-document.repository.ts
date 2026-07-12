import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DealDocument, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { RlsTransactionService, TrustedRlsContext } from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';
import {
  CreateDocumentVersionCommand,
  DocumentMutationResult,
  DocumentRepository,
  DocumentTransaction,
  GenerateDocumentPackageCommand,
  SubmitDocumentSignatureCommand,
} from './document.repository';
import { DOCUMENT_REQUIREMENTS, DocType } from './document-matrix.service';

const STORAGE_DOCUMENT_TYPE = 'EVIDENCE_FILE';
const PACKAGE_DOCUMENT_TYPE = 'PACKAGE_MANIFEST';
const VERIFIED_STORAGE_STATUS = 'VERIFIED';
const DOCUMENT_PENDING_REVIEW = 'PENDING_REVIEW';
const SIGNATURE_PENDING_VERIFICATION = 'SIGNATURE_PENDING_VERIFICATION';
const PACKAGE_MANIFEST_CREATED = 'PACKAGE_MANIFEST_CREATED';
const SIGNATURE_MIME_TYPE = 'application/pkcs7-signature';

const DOCUMENT_TYPES = new Set(DOCUMENT_REQUIREMENTS.map((requirement) => requirement.docType));
const DOCUMENT_WRITE_ROLES = new Set<Role>([
  Role.FARMER,
  Role.BUYER,
  Role.LOGISTICIAN,
  Role.SURVEYOR,
  Role.LAB,
  Role.ELEVATOR,
  Role.ACCOUNTING,
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
  Role.ADMIN,
]);
const PRIVILEGED_SOURCE_ROLES = new Set<Role>([
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
  Role.ADMIN,
]);

type MutationPlan = Readonly<{
  commandId: string;
  correlationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  action: string;
  eventType: string;
  dealId: string;
  beforeState: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  create: Prisma.DealDocumentUncheckedCreateInput;
  eventPayload: Prisma.InputJsonObject;
}>;

@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser, dealId?: string): Promise<DealDocument[]> {
    const normalizedDealId = dealId === undefined ? undefined : requiredIdentifier(dealId, 'dealId');
    return this.rls.withTrustedContext(user, async (tx, context) => {
      if (normalizedDealId) {
        const deal = await tx.deal.findFirst({
          where: { id: normalizedDealId, tenantId: context.tenantId },
          select: { id: true },
        });
        if (!deal) throw new NotFoundException('Deal is not available in the authenticated scope.');
      }
      return tx.dealDocument.findMany({
        where: {
          tenantId: context.tenantId,
          type: { not: STORAGE_DOCUMENT_TYPE },
          ...(normalizedDealId ? { dealId: normalizedDealId } : {}),
        },
        orderBy: [{ uploadedAt: 'desc' }, { id: 'asc' }],
      });
    });
  }

  async getById(id: string, user: RequestUser): Promise<DealDocument> {
    const documentId = requiredIdentifier(id, 'documentId');
    const document = await this.rls.withTrustedContext(user, (tx, context) => tx.dealDocument.findFirst({
      where: {
        id: documentId,
        tenantId: context.tenantId,
        type: { not: STORAGE_DOCUMENT_TYPE },
      },
    }));
    if (!document) throw new NotFoundException('Document is not available in the authenticated scope.');
    return document;
  }

  async createVersion(
    command: CreateDocumentVersionCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult> {
    this.assertWriteRole(user);
    const normalized = {
      sourceFileId: requiredIdentifier(command.sourceFileId, 'sourceFileId'),
      type: requiredDocumentType(command.type),
      name: optionalName(command.name),
      supersedesId: optionalIdentifier(command.supersedesId, 'supersedesId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
    };
    const requestFingerprint = digest({ action: 'document.version.create', ...normalized });

    return this.executeIdempotent(user, normalized.idempotencyKey, requestFingerprint, async (
      tx,
      context,
      persistentKey,
    ) => {
      const source = await this.requireVerifiedSource(tx, normalized.sourceFileId, context, user);
      let version = 1;
      let seriesId: string;
      let supersedes: DealDocument | null = null;
      if (normalized.supersedesId) {
        supersedes = await tx.dealDocument.findFirst({
          where: {
            id: normalized.supersedesId,
            dealId: source.dealId,
            type: normalized.type,
            isImmutable: true,
          },
        });
        if (!supersedes || supersedes.type === STORAGE_DOCUMENT_TYPE) {
          throw new ConflictException({
            code: 'INVALID_SUPERSESSION',
            message: 'Correction must reference an immutable visible version of the same document type.',
          });
        }
        version = supersedes.version + 1;
        seriesId = supersedes.seriesId ?? supersedes.id;
      } else {
        seriesId = `document-series-${randomUUID()}`;
      }

      const documentId = `document-${randomUUID()}`;
      return this.persistMutation(tx, context, {
        commandId: normalized.commandId,
        correlationId: normalized.correlationId,
        idempotencyKey: persistentKey,
        requestFingerprint,
        action: normalized.supersedesId ? 'document.version.correct' : 'document.version.create',
        eventType: 'document.version.created',
        dealId: source.dealId,
        beforeState: supersedes ? documentState(supersedes) : Prisma.JsonNull,
        create: {
          id: documentId,
          dealId: source.dealId,
          tenantId: context.tenantId,
          type: normalized.type,
          status: DOCUMENT_PENDING_REVIEW,
          name: normalized.name ?? source.name,
          mimeType: source.mimeType,
          s3Key: source.s3Key,
          sizeBytes: source.sizeBytes,
          hash: source.hash,
          uploadedByUserId: context.userId,
          version,
          isImmutable: true,
          sourceFileId: source.id,
          supersedesId: supersedes?.id,
          seriesId,
          idempotencyKey: persistentKey,
          correlationId: normalized.correlationId,
          createdByOrgId: context.orgId,
        },
        eventPayload: {
          documentId,
          sourceFileId: source.id,
          sourceHash: source.hash,
          documentType: normalized.type,
          version,
          status: DOCUMENT_PENDING_REVIEW,
          supersedesId: supersedes?.id ?? null,
        },
      });
    });
  }

  async submitSignature(
    id: string,
    command: SubmitDocumentSignatureCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult> {
    this.assertWriteRole(user);
    const normalized = {
      id: requiredIdentifier(id, 'documentId'),
      signatureFileId: requiredIdentifier(command.signatureFileId, 'signatureFileId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
    };
    const requestFingerprint = digest({ action: 'document.signature.submit', ...normalized });

    return this.executeIdempotent(user, normalized.idempotencyKey, requestFingerprint, async (
      tx,
      context,
      persistentKey,
    ) => {
      const document = await tx.dealDocument.findFirst({
        where: { id: normalized.id, type: { not: STORAGE_DOCUMENT_TYPE }, isImmutable: true },
      });
      if (!document) {
        throw new NotFoundException('Immutable document version is not available in the authenticated scope.');
      }
      const signature = await this.requireVerifiedSource(
        tx,
        normalized.signatureFileId,
        context,
        user,
      );
      if (signature.dealId !== document.dealId || signature.mimeType !== SIGNATURE_MIME_TYPE) {
        throw new ConflictException({
          code: 'INVALID_SIGNATURE_EVIDENCE',
          message: 'Signature evidence must be a verified PKCS#7 object from the same deal.',
        });
      }

      const documentId = `document-${randomUUID()}`;
      const version = document.version + 1;
      return this.persistMutation(tx, context, {
        commandId: normalized.commandId,
        correlationId: normalized.correlationId,
        idempotencyKey: persistentKey,
        requestFingerprint,
        action: 'document.signature.submit',
        eventType: 'document.signature.verification.requested',
        dealId: document.dealId,
        beforeState: documentState(document),
        create: {
          id: documentId,
          dealId: document.dealId,
          tenantId: context.tenantId,
          type: document.type,
          status: SIGNATURE_PENDING_VERIFICATION,
          name: document.name,
          mimeType: document.mimeType,
          s3Key: document.s3Key,
          sizeBytes: document.sizeBytes,
          hash: document.hash,
          uploadedByUserId: context.userId,
          bankRequired: document.bankRequired,
          releaseRequired: document.releaseRequired,
          bankAcceptance: 'PENDING',
          version,
          isImmutable: true,
          sourceFileId: document.sourceFileId,
          signatureFileId: signature.id,
          supersedesId: document.id,
          seriesId: document.seriesId ?? document.id,
          idempotencyKey: persistentKey,
          correlationId: normalized.correlationId,
          createdByOrgId: context.orgId,
        },
        eventPayload: {
          documentId,
          priorDocumentId: document.id,
          signatureFileId: signature.id,
          signatureHash: signature.hash,
          version,
          status: SIGNATURE_PENDING_VERIFICATION,
        },
      });
    });
  }

  async generateDealPackage(
    dealId: string,
    command: GenerateDocumentPackageCommand,
    user: RequestUser,
  ): Promise<DocumentMutationResult> {
    this.assertWriteRole(user);
    const normalized = {
      dealId: requiredIdentifier(dealId, 'dealId'),
      commandId: requiredIdentifier(command.commandId, 'commandId'),
      idempotencyKey: requiredIdentifier(command.idempotencyKey, 'idempotencyKey'),
      correlationId: optionalIdentifier(command.correlationId, 'correlationId') ?? command.commandId,
    };
    const requestFingerprint = digest({ action: 'document.package.generate', ...normalized });

    return this.executeIdempotent(user, normalized.idempotencyKey, requestFingerprint, async (
      tx,
      context,
      persistentKey,
    ) => {
      const deal = await tx.deal.findFirst({
        where: { id: normalized.dealId, tenantId: context.tenantId },
        select: { id: true },
      });
      if (!deal) throw new NotFoundException('Deal is not available in the authenticated scope.');

      const documents = await tx.dealDocument.findMany({
        where: {
          dealId: deal.id,
          type: { notIn: [STORAGE_DOCUMENT_TYPE, PACKAGE_DOCUMENT_TYPE] },
          isImmutable: true,
        },
        orderBy: [{ type: 'asc' }, { seriesId: 'asc' }, { version: 'asc' }, { id: 'asc' }],
      });
      if (documents.length === 0) {
        throw new ConflictException({
          code: 'PACKAGE_HAS_NO_DOCUMENTS',
          message: 'A package manifest requires at least one immutable document version.',
        });
      }

      const manifest = {
        schemaVersion: 'document-package-manifest.v1',
        dealId: deal.id,
        documents: documents.map((document) => ({
          id: document.id,
          type: document.type,
          status: document.status,
          version: document.version,
          hash: document.hash,
          sourceFileId: document.sourceFileId,
          signatureFileId: document.signatureFileId,
          supersedesId: document.supersedesId,
        })),
      };
      const manifestHash = digest(manifest);
      const documentId = `document-package-${randomUUID()}`;
      return this.persistMutation(tx, context, {
        commandId: normalized.commandId,
        correlationId: normalized.correlationId,
        idempotencyKey: persistentKey,
        requestFingerprint,
        action: 'document.package.manifest.create',
        eventType: 'document.package.manifest.created',
        dealId: deal.id,
        beforeState: Prisma.JsonNull,
        create: {
          id: documentId,
          dealId: deal.id,
          tenantId: context.tenantId,
          type: PACKAGE_DOCUMENT_TYPE,
          status: PACKAGE_MANIFEST_CREATED,
          name: `package-${deal.id}.manifest.json`,
          mimeType: 'application/json',
          hash: manifestHash,
          uploadedByUserId: context.userId,
          version: 1,
          isImmutable: true,
          seriesId: `document-series-${randomUUID()}`,
          idempotencyKey: persistentKey,
          correlationId: normalized.correlationId,
          createdByOrgId: context.orgId,
          metadata: manifest as Prisma.InputJsonValue,
        },
        eventPayload: {
          documentId,
          manifestHash,
          documentCount: documents.length,
          schemaVersion: manifest.schemaVersion,
          status: PACKAGE_MANIFEST_CREATED,
        },
      });
    });
  }

  private async executeIdempotent(
    user: RequestUser,
    clientKey: string,
    requestFingerprint: string,
    work: (
      tx: DocumentTransaction,
      context: TrustedRlsContext,
      persistentKey: string,
    ) => Promise<DocumentMutationResult>,
  ): Promise<DocumentMutationResult> {
    const persistentKey = `document:${user.tenantId}:${user.id}:${clientKey}`;
    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (replay) return replay;
        return work(tx, context, persistentKey);
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20_000,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return this.rls.withTrustedContext(user, async (tx) => {
        const replay = await this.replay(tx, persistentKey, requestFingerprint);
        if (!replay) throw error;
        return replay;
      });
    }
  }

  private async replay(
    tx: DocumentTransaction,
    persistentKey: string,
    requestFingerprint: string,
  ): Promise<DocumentMutationResult | null> {
    const document = await tx.dealDocument.findUnique({ where: { idempotencyKey: persistentKey } });
    if (!document) return null;
    const metadata = jsonObject(document.metadata);
    if (metadata.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The idempotency key is already bound to a different document command.',
      });
    }
    const outbox = await tx.outboxEntry.findUnique({ where: { idempotencyKey: persistentKey } });
    if (!outbox?.auditId) {
      throw new ConflictException('Atomic document receipt is incomplete.');
    }
    return {
      document,
      auditId: outbox.auditId,
      outboxId: outbox.id,
      duplicate: true,
    };
  }

  private async persistMutation(
    tx: DocumentTransaction,
    context: TrustedRlsContext,
    plan: MutationPlan,
  ): Promise<DocumentMutationResult> {
    // Seed 42 is shared with the canonical Deal command pipeline so the audit
    // hash chain is ordered across domains, not merely inside Documents.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${plan.dealId}, 42))`;
    const auditId = `audit-${randomUUID()}`;
    const outboxId = `outbox-${randomUUID()}`;
    const documentId = String(plan.create.id);
    const metadata = {
      ...jsonObject(plan.create.metadata),
      commandId: plan.commandId,
      requestFingerprint: plan.requestFingerprint,
      auditId,
      outboxId,
      createdByRole: context.role,
    };
    const document = await tx.dealDocument.create({
      data: {
        ...plan.create,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    const previousAudit = await tx.auditEvent.findFirst({
      where: { dealId: plan.dealId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const auditMaterial = {
      id: auditId,
      action: plan.action,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      dealId: plan.dealId,
      objectType: 'deal_document',
      objectId: documentId,
      beforeState: plan.beforeState,
      afterState: documentState(document),
      outcome: 'SUCCESS',
      correlationId: plan.correlationId,
      metadata: {
        commandId: plan.commandId,
        idempotencyKey: plan.idempotencyKey,
        eventType: plan.eventType,
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
        type: plan.eventType,
        dealId: plan.dealId,
        status: 'PENDING',
        idempotencyKey: plan.idempotencyKey,
        correlationId: plan.correlationId,
        auditId,
        payload: {
          schemaVersion: 'document-event.v1',
          commandId: plan.commandId,
          requestFingerprint: plan.requestFingerprint,
          ...plan.eventPayload,
        } as Prisma.InputJsonValue,
      },
    });

    return { document, auditId, outboxId, duplicate: false };
  }

  private async requireVerifiedSource(
    tx: DocumentTransaction,
    sourceFileId: string,
    context: TrustedRlsContext,
    user: RequestUser,
  ): Promise<DealDocument & { hash: string; s3Key: string; mimeType: string }> {
    const source = await tx.dealDocument.findFirst({
      where: {
        id: sourceFileId,
        tenantId: context.tenantId,
        type: STORAGE_DOCUMENT_TYPE,
        status: VERIFIED_STORAGE_STATUS,
        isImmutable: true,
      },
    });
    if (!source || !source.hash || !source.s3Key || !source.mimeType || !source.sizeBytes) {
      throw new ConflictException({
        code: 'SOURCE_FILE_NOT_VERIFIED',
        message: 'Document commands require a complete verified immutable storage object.',
      });
    }
    if (source.uploadedByUserId !== context.userId && !PRIVILEGED_SOURCE_ROLES.has(user.role)) {
      throw new ForbiddenException('Only the source uploader or a privileged control role may use this object.');
    }
    return source as DealDocument & { hash: string; s3Key: string; mimeType: string };
  }

  private assertWriteRole(user: RequestUser): void {
    if (!DOCUMENT_WRITE_ROLES.has(user.role)) {
      throw new ForbiddenException('Role is read-only for document commands.');
    }
  }
}

function documentState(document: DealDocument): Prisma.InputJsonObject {
  return {
    id: document.id,
    dealId: document.dealId,
    tenantId: document.tenantId,
    type: document.type,
    status: document.status,
    version: document.version,
    hash: document.hash,
    sourceFileId: document.sourceFileId,
    signatureFileId: document.signatureFileId,
    supersedesId: document.supersedesId,
    immutable: document.isImmutable,
  };
}

function jsonObject(value: unknown): Record<string, Prisma.InputJsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return value as Record<string, Prisma.InputJsonValue>;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
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

function requiredDocumentType(value: string): DocType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!isDocumentType(normalized)) {
    throw new BadRequestException({ code: 'INVALID_DOCUMENT_TYPE' });
  }
  return normalized;
}

function isDocumentType(value: string): value is DocType {
  return DOCUMENT_TYPES.has(value as DocType);
}

function requiredIdentifier(value: string, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 200 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function optionalIdentifier(value: string | undefined, field: string): string | undefined {
  return value === undefined ? undefined : requiredIdentifier(value, field);
}

function optionalName(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_DOCUMENT_NAME' });
  }
  return normalized;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
