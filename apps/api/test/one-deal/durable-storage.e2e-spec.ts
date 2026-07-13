import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../src/common/types/request-user';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';
import { LocalFilesystemStorageAdapter } from '../../src/modules/storage/object-storage.adapter';
import { StorageFinalizationRepository } from '../../src/modules/storage/storage-finalization.repository';
import { StorageService } from '../../src/modules/storage/storage.service';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const AUTH_URL = String(process.env.ONE_DEAL_AUTH_URL ?? '');
const STORAGE_URL = String(process.env.STORAGE_DATABASE_URL ?? '');
const PASSWORD = 'Storage-E2E-9!';
const DEAL_ID = 'DEAL-STORAGE-E2E-001';
const TENANT_A = 'tenant-storage-a';
const TENANT_B = 'tenant-storage-b';
const ORG_A = 'org-storage-a';
const ORG_B = 'org-storage-b';
const USER_A = 'user-storage-a';
const USER_B = 'user-storage-b';

function prisma(url?: string): PrismaService {
  return url ? new PrismaService({ datasources: { db: { url } } }) : new PrismaService();
}

async function seedIdentity(
  admin: PrismaService,
  input: { userId: string; email: string; orgId: string; tenantId: string; inn: string },
): Promise<void> {
  await admin.organization.upsert({
    where: { id: input.orgId },
    update: {
      tenantId: input.tenantId,
      status: 'VERIFIED',
      kycStatus: 'APPROVED',
      amlStatus: 'CLEAR',
    },
    create: {
      id: input.orgId,
      inn: input.inn,
      name: input.orgId,
      tenantId: input.tenantId,
      status: 'VERIFIED',
      kycStatus: 'APPROVED',
      amlStatus: 'CLEAR',
      verifiedAt: new Date(),
    },
  });
  await admin.user.upsert({
    where: { id: input.userId },
    update: {
      email: input.email,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      fullName: input.userId,
      status: 'ACTIVE',
      mfaEnabled: false,
      deletedAt: null,
    },
    create: {
      id: input.userId,
      email: input.email,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      fullName: input.userId,
      status: 'ACTIVE',
      mfaEnabled: false,
    },
  });
  await admin.userOrg.upsert({
    where: { userId_organizationId: { userId: input.userId, organizationId: input.orgId } },
    update: { role: Role.FARMER, isDefault: true },
    create: {
      userId: input.userId,
      organizationId: input.orgId,
      role: Role.FARMER,
      isDefault: true,
    },
  });
  const repository = new PersistentAuthRepository(admin);
  await repository.ensureCredentialState(admin, input.userId, '1.2', new Date());
}

async function login(auth: AuthService, email: string): Promise<RequestUser> {
  const result = await auth.login({ email, password: PASSWORD }) as any;
  expect(result.mfaRequired).toBe(false);
  expect(result.accessToken).toEqual(expect.any(String));
  return auth.verifyAccessToken(result.accessToken);
}

describe('durable evidence object storage', () => {
  const admin = prisma(ADMIN_URL);
  const authPrisma = prisma(AUTH_URL);
  const auth = new AuthService(new PersistentAuthRepository(authPrisma));
  const appOne = prisma();
  const appTwo = prisma();
  const storageOne = prisma(STORAGE_URL);
  const storageTwo = prisma(STORAGE_URL);
  const root = `/tmp/platform-v7-storage-e2e-${randomUUID()}`;
  const adapterOne = new LocalFilesystemStorageAdapter(root);
  const adapterTwo = new LocalFilesystemStorageAdapter(root);
  const serviceOne = new StorageService(
    new RlsTransactionService(appOne),
    adapterOne,
    new StorageFinalizationRepository(storageOne),
  );
  const serviceTwo = new StorageService(
    new RlsTransactionService(appTwo),
    adapterTwo,
    new StorageFinalizationRepository(storageTwo),
  );
  let owner: RequestUser;
  let attacker: RequestUser;

  beforeAll(async () => {
    if (!ADMIN_URL || !AUTH_URL || !STORAGE_URL) {
      throw new Error('ONE_DEAL_ADMIN_URL, ONE_DEAL_AUTH_URL and STORAGE_DATABASE_URL are required.');
    }
    await Promise.all([
      admin.$connect(),
      authPrisma.$connect(),
      appOne.$connect(),
      appTwo.$connect(),
      storageOne.$connect(),
      storageTwo.$connect(),
    ]);
    await seedIdentity(admin, {
      userId: USER_A,
      email: 'storage-owner@auth.test',
      orgId: ORG_A,
      tenantId: TENANT_A,
      inn: '770000088891',
    });
    await seedIdentity(admin, {
      userId: USER_B,
      email: 'storage-attacker@auth.test',
      orgId: ORG_B,
      tenantId: TENANT_B,
      inn: '770000088892',
    });
    await admin.deal.upsert({
      where: { id: DEAL_ID },
      update: { tenantId: TENANT_A, sellerOrgId: ORG_A, buyerOrgId: ORG_A },
      create: {
        id: DEAL_ID,
        dealNumber: 'ТП-STORAGE-001',
        status: 'DRAFT',
        tenantId: TENANT_A,
        sellerOrgId: ORG_A,
        buyerOrgId: ORG_A,
        totalKopecks: 100_000,
      },
    });
    await admin.dealParticipant.upsert({
      where: { dealId_userId_role: { dealId: DEAL_ID, userId: USER_A, role: Role.FARMER } },
      update: { tenantId: TENANT_A, organizationId: ORG_A, status: 'ACTIVE', accessLevel: 'WORK' },
      create: {
        id: 'participant-storage-owner',
        dealId: DEAL_ID,
        tenantId: TENANT_A,
        organizationId: ORG_A,
        userId: USER_A,
        role: Role.FARMER,
        status: 'ACTIVE',
        accessLevel: 'WORK',
      },
    });
    owner = await login(auth, 'storage-owner@auth.test');
    attacker = await login(auth, 'storage-attacker@auth.test');
  });

  afterAll(async () => {
    await Promise.allSettled([
      admin.$disconnect(),
      authPrisma.$disconnect(),
      appOne.$disconnect(),
      appTwo.$disconnect(),
      storageOne.$disconnect(),
      storageTwo.$disconnect(),
      fs.rm(root, { recursive: true, force: true }),
    ]);
  });

  it('persists metadata, verifies bytes, rejects races and enforces scope/immutability', async () => {
    await expect(serviceOne.requestUpload({
      filename: 'malware.exe',
      mimeType: 'application/x-msdownload',
      sizeBytes: 10,
      dealId: DEAL_ID,
    }, owner)).rejects.toBeInstanceOf(BadRequestException);

    await expect(serviceOne.requestUpload({
      filename: 'oversize.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 500_000_000,
      dealId: DEAL_ID,
    }, owner)).rejects.toBeInstanceOf(BadRequestException);

    const content = Buffer.from('%PDF-1.7\nverified evidence\n');
    const expectedHash = createHash('sha256').update(content).digest('hex');
    const requested = await serviceOne.requestUpload({
      filename: '../Акт приёмки.pdf',
      mimeType: 'application/pdf',
      sizeBytes: content.length,
      dealId: DEAL_ID,
    }, owner);
    expect(requested.objectKey).toContain(`tenant/${TENANT_A}/deal/${DEAL_ID}/`);
    expect(requested.objectKey).not.toContain('..');
    await adapterOne.putObjectForTest(requested.objectKey, content, 'application/pdf');

    const concurrent = await Promise.allSettled([
      serviceOne.confirmUpload(requested.fileId, expectedHash, owner),
      serviceTwo.confirmUpload(requested.fileId, expectedHash, owner),
    ]);
    expect(concurrent.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((item) => item.status === 'rejected')).toHaveLength(1);

    const freshPrisma = prisma();
    const freshStoragePrisma = prisma(STORAGE_URL);
    await Promise.all([freshPrisma.$connect(), freshStoragePrisma.$connect()]);
    const freshAdapter = new LocalFilesystemStorageAdapter(root);
    const freshService = new StorageService(
      new RlsTransactionService(freshPrisma),
      freshAdapter,
      new StorageFinalizationRepository(freshStoragePrisma),
    );
    try {
      const persisted = await freshService.getRecord(requested.fileId, owner);
      expect(persisted).toMatchObject({
        status: 'VERIFIED',
        sha256: expectedHash,
        immutable: true,
        uploadedBy: USER_A,
      });
      await expect(freshService.verifyIntegrity(requested.fileId, owner)).resolves.toMatchObject({
        valid: true,
        storedHash: expectedHash,
        actualHash: expectedHash,
        sizeBytes: content.length,
      });
      await expect(freshService.getDownloadUrl(requested.fileId, 900, attacker))
        .rejects.toBeInstanceOf(NotFoundException);
      await expect(freshService.listByDeal(DEAL_ID, attacker))
        .rejects.toBeInstanceOf(NotFoundException);
      await expect(freshService.delete(requested.fileId, owner))
        .rejects.toBeInstanceOf(ConflictException);
    } finally {
      await Promise.all([freshPrisma.$disconnect(), freshStoragePrisma.$disconnect()]);
    }

    const tamperedContent = Buffer.from('%PDF-1.7\ntampered evidence\n');
    const tampered = await serviceOne.requestUpload({
      filename: 'tampered.pdf',
      mimeType: 'application/pdf',
      sizeBytes: tamperedContent.length,
      dealId: DEAL_ID,
    }, owner);
    await adapterOne.putObjectForTest(tampered.objectKey, tamperedContent, 'application/pdf');
    await expect(serviceOne.confirmUpload(tampered.fileId, '0'.repeat(64), owner))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(serviceTwo.getRecord(tampered.fileId, owner)).resolves.toMatchObject({
      status: 'QUARANTINED_CLIENT_HASH_MISMATCH',
      immutable: true,
    });
    await expect(serviceTwo.getDownloadUrl(tampered.fileId, 900, owner))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
