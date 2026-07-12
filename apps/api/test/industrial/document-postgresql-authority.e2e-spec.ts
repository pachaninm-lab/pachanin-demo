import { createHash } from 'crypto';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { PrismaDocumentRepository } from '../../src/modules/documents/prisma-document.repository';

const DEAL_ID = 'DEAL-DOCUMENT-AUTHORITY-E2E';
const TENANT_ID = 'tenant-document-authority-e2e';
const OTHER_TENANT_ID = 'tenant-document-authority-foreign';
const SOURCE_ID = 'file-document-authority-contract';
const CORRECTION_SOURCE_ID = 'file-document-authority-contract-correction';
const SIGNATURE_ID = 'file-document-authority-signature';

const owner: RequestUser = {
  id: 'user-document-authority-owner',
  orgId: 'org-document-authority-owner',
  tenantId: TENANT_ID,
  role: Role.FARMER,
  email: 'document-owner@industrial.test',
  sessionId: 'session-document-authority-owner',
};

const foreignTenant: RequestUser = {
  ...owner,
  id: 'user-document-authority-foreign',
  orgId: 'org-document-authority-foreign',
  tenantId: OTHER_TENANT_ID,
  email: 'document-foreign@industrial.test',
  sessionId: 'session-document-authority-foreign',
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function createInstance() {
  const prisma = new PrismaService();
  await prisma.$connect();
  return {
    prisma,
    repository: new PrismaDocumentRepository(new RlsTransactionService(prisma)),
  };
}

describe('Documents PostgreSQL authority', () => {
  const admin = new PrismaService();

  beforeAll(async () => {
    await admin.$connect();
    await admin.deal.upsert({
      where: { id: DEAL_ID },
      update: { tenantId: TENANT_ID },
      create: {
        id: DEAL_ID,
        status: 'DRAFT',
        tenantId: TENANT_ID,
        sellerOrgId: owner.orgId,
        buyerOrgId: owner.orgId,
        currency: 'RUB',
      },
    });
    for (const file of [
      { id: SOURCE_ID, name: 'contract.pdf', mimeType: 'application/pdf' },
      { id: CORRECTION_SOURCE_ID, name: 'contract-v2.pdf', mimeType: 'application/pdf' },
      { id: SIGNATURE_ID, name: 'contract.p7s', mimeType: 'application/pkcs7-signature' },
    ]) {
      await admin.dealDocument.upsert({
        where: { id: file.id },
        update: {
          tenantId: TENANT_ID,
          status: 'VERIFIED',
          hash: sha256(file.id),
          isImmutable: true,
        },
        create: {
          id: file.id,
          dealId: DEAL_ID,
          tenantId: TENANT_ID,
          type: 'EVIDENCE_FILE',
          status: 'VERIFIED',
          name: file.name,
          mimeType: file.mimeType,
          s3Key: `tenant/${TENANT_ID}/deal/${DEAL_ID}/${file.id}/${file.name}`,
          sizeBytes: 256,
          hash: sha256(file.id),
          uploadedByUserId: owner.id,
          version: 2,
          isImmutable: true,
        },
      });
    }
  });

  afterAll(async () => {
    await admin.$disconnect();
  });

  it('persists immutable versions, audit and pending outbox atomically across instances', async () => {
    const first = await createInstance();
    const second = await createInstance();
    const command = {
      sourceFileId: SOURCE_ID,
      type: 'contract',
      name: 'Договор поставки.pdf',
      commandId: 'document-command-create-1',
      idempotencyKey: 'document-idempotency-create-1',
      correlationId: 'document-correlation-create-1',
    };
    try {
      const concurrent = await Promise.all([
        first.repository.createVersion(command, owner),
        second.repository.createVersion(command, owner),
      ]);
      const ids = new Set(concurrent.map((result) => result.document.id));
      expect(ids.size).toBe(1);
      expect(concurrent.filter((result) => result.duplicate)).toHaveLength(1);
      const created = concurrent[0];
      expect(created.document).toMatchObject({
        tenantId: TENANT_ID,
        dealId: DEAL_ID,
        type: 'contract',
        status: 'PENDING_REVIEW',
        sourceFileId: SOURCE_ID,
        signedAt: null,
        signatories: null,
        isImmutable: true,
      });
      await expect(first.repository.createVersion({
        ...command,
        type: 'sdiz',
      }, owner)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
      });

      const evidence = await admin.$transaction(async (tx) => ({
        documents: await tx.dealDocument.count({
          where: { idempotencyKey: `document:${TENANT_ID}:${owner.id}:${command.idempotencyKey}` },
        }),
        audits: await tx.auditEvent.count({ where: { objectId: created.document.id } }),
        outbox: await tx.outboxEntry.findUnique({
          where: { idempotencyKey: `document:${TENANT_ID}:${owner.id}:${command.idempotencyKey}` },
        }),
      }));
      expect(evidence.documents).toBe(1);
      expect(evidence.audits).toBe(1);
      expect(evidence.outbox).toMatchObject({
        status: 'PENDING',
        auditId: created.auditId,
        confirmedAt: null,
        sentAt: null,
      });

      await first.prisma.$disconnect();
      const restarted = await createInstance();
      try {
        await expect(restarted.repository.getById(created.document.id, owner)).resolves.toMatchObject({
          id: created.document.id,
          hash: sha256(SOURCE_ID),
        });
        await expect(restarted.repository.list(foreignTenant)).resolves.toEqual([]);

        const correction = await restarted.repository.createVersion({
          sourceFileId: CORRECTION_SOURCE_ID,
          type: 'contract',
          supersedesId: created.document.id,
          commandId: 'document-command-correction-1',
          idempotencyKey: 'document-idempotency-correction-1',
        }, owner);
        expect(correction.document).toMatchObject({
          version: 2,
          supersedesId: created.document.id,
          seriesId: created.document.seriesId,
          hash: sha256(CORRECTION_SOURCE_ID),
        });
        await expect(admin.dealDocument.update({
          where: { id: created.document.id },
          data: { status: 'SIGNED' },
        })).rejects.toThrow(/append-only|confirmed document versions/i);

        const signature = await restarted.repository.submitSignature(correction.document.id, {
          signatureFileId: SIGNATURE_ID,
          commandId: 'document-command-signature-1',
          idempotencyKey: 'document-idempotency-signature-1',
        }, owner);
        expect(signature.document).toMatchObject({
          status: 'SIGNATURE_PENDING_VERIFICATION',
          signatureFileId: SIGNATURE_ID,
          signedAt: null,
          signatories: null,
        });

        const documentPackage = await restarted.repository.generateDealPackage(DEAL_ID, {
          commandId: 'document-command-package-1',
          idempotencyKey: 'document-idempotency-package-1',
        }, owner);
        expect(documentPackage.document).toMatchObject({
          type: 'PACKAGE_MANIFEST',
          status: 'PACKAGE_MANIFEST_CREATED',
          isImmutable: true,
          s3Key: null,
        });
      } finally {
        await restarted.prisma.$disconnect();
      }
    } finally {
      await Promise.allSettled([first.prisma.$disconnect(), second.prisma.$disconnect()]);
    }
  });

  it('rolls back the document and audit when the outbox insert cannot commit', async () => {
    const idempotencyKey = 'document-idempotency-forced-rollback';
    const persistentKey = `document:${TENANT_ID}:${owner.id}:${idempotencyKey}`;
    await admin.outboxEntry.upsert({
      where: { idempotencyKey: persistentKey },
      update: {},
      create: {
        id: 'outbox-document-forced-rollback-collision',
        type: 'test.collision',
        dealId: DEAL_ID,
        status: 'PENDING',
        idempotencyKey: persistentKey,
        correlationId: 'document-correlation-forced-rollback',
        payload: { fixture: true },
      },
    });
    const instance = await createInstance();
    try {
      await expect(instance.repository.createVersion({
        sourceFileId: SOURCE_ID,
        type: 'contract',
        commandId: 'document-command-forced-rollback',
        idempotencyKey,
        correlationId: 'document-correlation-forced-rollback',
      }, owner)).rejects.toThrow();
      expect(await admin.dealDocument.count({ where: { idempotencyKey: persistentKey } })).toBe(0);
      expect(await admin.auditEvent.count({
        where: { correlationId: 'document-correlation-forced-rollback' },
      })).toBe(0);
    } finally {
      await instance.prisma.$disconnect();
    }
  });
});
