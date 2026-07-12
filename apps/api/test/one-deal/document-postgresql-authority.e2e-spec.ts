import { createHash } from 'crypto';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { PrismaDocumentRepository } from '../../src/modules/documents/prisma-document.repository';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const DEAL_ID = 'DEAL-DOCUMENT-RLS-001';
const TENANT_ID = 'tenant-canonical-test';
const SOURCE_ID = 'file-document-rls-contract';

const seller: RequestUser = {
  id: 'farmer-e2e',
  email: 'farmer@demo.ru',
  role: Role.FARMER,
  orgId: 'org-canonical-seller',
  tenantId: TENANT_ID,
  sessionId: 'document-rls-seller-session',
};

const otherTenant: RequestUser = {
  ...seller,
  tenantId: 'tenant-other',
  sessionId: 'document-rls-cross-tenant-session',
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function databaseErrorText(error: unknown): string {
  const candidate = error as { code?: unknown; message?: unknown; meta?: unknown };
  return JSON.stringify(candidate);
}

describe('Documents PostgreSQL authority under NOBYPASSRLS principal', () => {
  const admin = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
  const app = new PrismaService();
  const rls = new RlsTransactionService(app);
  const repository = new PrismaDocumentRepository(rls);

  beforeAll(async () => {
    if (!ADMIN_URL) throw new Error('ONE_DEAL_ADMIN_URL is required.');
    await Promise.all([admin.$connect(), app.$connect()]);
    await admin.deal.upsert({
      where: { id: DEAL_ID },
      update: { tenantId: TENANT_ID },
      create: {
        id: DEAL_ID,
        dealNumber: 'ТП-DOCUMENT-RLS-001',
        status: 'DRAFT',
        tenantId: TENANT_ID,
        sellerOrgId: seller.orgId,
        buyerOrgId: 'org-canonical-buyer',
        currency: 'RUB',
      },
    });
    await admin.dealParticipant.upsert({
      where: { dealId_userId_role: { dealId: DEAL_ID, userId: seller.id, role: seller.role } },
      update: {
        tenantId: TENANT_ID,
        organizationId: seller.orgId,
        status: 'ACTIVE',
        accessLevel: 'WORK',
      },
      create: {
        id: 'participant-document-rls-seller',
        dealId: DEAL_ID,
        tenantId: TENANT_ID,
        organizationId: seller.orgId,
        userId: seller.id,
        role: seller.role,
        status: 'ACTIVE',
        accessLevel: 'WORK',
      },
    });
    await admin.dealDocument.upsert({
      where: { id: SOURCE_ID },
      update: { tenantId: TENANT_ID, status: 'VERIFIED', isImmutable: true },
      create: {
        id: SOURCE_ID,
        dealId: DEAL_ID,
        tenantId: TENANT_ID,
        type: 'EVIDENCE_FILE',
        status: 'VERIFIED',
        name: 'contract.pdf',
        mimeType: 'application/pdf',
        s3Key: `tenant/${TENANT_ID}/deal/${DEAL_ID}/${SOURCE_ID}/contract.pdf`,
        sizeBytes: 128,
        hash: sha256(SOURCE_ID),
        uploadedByUserId: seller.id,
        version: 2,
        isImmutable: true,
      },
    });
  });

  afterAll(async () => {
    await Promise.allSettled([admin.$disconnect(), app.$disconnect()]);
  });

  it('proves FORCE RLS, cross-tenant denial and append-only server commands', async () => {
    const authority = await app.$queryRaw<Array<{
      current_user: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>`
      SELECT current_user, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE oid = 'public.deal_documents'::regclass
    `;
    expect(authority).toEqual([expect.objectContaining({
      current_user: 'one_deal_app',
      relrowsecurity: true,
      relforcerowsecurity: true,
    })]);

    const created = await repository.createVersion({
      sourceFileId: SOURCE_ID,
      type: 'contract',
      commandId: 'document-rls-command-1',
      idempotencyKey: 'document-rls-idempotency-1',
    }, seller);
    expect(created.document).toMatchObject({
      tenantId: TENANT_ID,
      status: 'PENDING_REVIEW',
      isImmutable: true,
    });
    await expect(repository.createVersion({
      sourceFileId: SOURCE_ID,
      type: 'contract',
      commandId: 'document-rls-command-1',
      idempotencyKey: 'document-rls-idempotency-1',
    }, seller)).resolves.toMatchObject({
      document: { id: created.document.id },
      duplicate: true,
    });
    await expect(repository.list(otherTenant)).resolves.toEqual([]);
    await expect(repository.getById(created.document.id, otherTenant)).rejects.toThrow(/not available/i);

    let forgedError = '';
    try {
      await rls.withTrustedContext(seller, (tx) => tx.dealDocument.create({
        data: {
          id: 'document-forged-signed',
          dealId: DEAL_ID,
          tenantId: TENANT_ID,
          type: 'contract',
          status: 'SIGNED',
          name: 'forged.pdf',
          uploadedByUserId: seller.id,
          createdByOrgId: seller.orgId,
          idempotencyKey: 'document-forged-idempotency',
          isImmutable: true,
        },
      }));
    } catch (error) {
      forgedError = databaseErrorText(error);
    }
    expect(forgedError).toMatch(/row-level security|42501|policy/i);

    await expect(rls.withTrustedContext(seller, (tx) => tx.dealDocument.update({
      where: { id: created.document.id },
      data: { status: 'SIGNED' },
    }))).rejects.toThrow(/append-only|23514|confirmed document versions/i);

    await app.$disconnect();
    const restarted = new PrismaService();
    await restarted.$connect();
    try {
      const restartedRepository = new PrismaDocumentRepository(new RlsTransactionService(restarted));
      await expect(restartedRepository.getById(created.document.id, seller)).resolves.toMatchObject({
        id: created.document.id,
        hash: sha256(SOURCE_ID),
      });
      const receipt = await new RlsTransactionService(restarted).withTrustedContext(seller, (tx) =>
        tx.outboxEntry.findUnique({
          where: { idempotencyKey: `document:${TENANT_ID}:${seller.id}:document-rls-idempotency-1` },
        }),
      );
      expect(receipt).toMatchObject({ status: 'PENDING', confirmedAt: null, sentAt: null });
    } finally {
      await restarted.$disconnect();
    }
  });
});
